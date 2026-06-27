/**
 * Job orchestrator: load → extract → analyze → generate → persist.
 *
 * Each stage is wrapped so a failure becomes a recorded degradation reason
 * instead of aborting the whole job. The job's final `status` reflects how
 * complete the result is, and the reasons explain *why* anything is missing.
 */
import type { Env } from "../lib/env.ts";
import { Budget } from "../lib/budget.ts";
import { fetchPlain, looksLikeSpa, renderWithBrowser } from "./fetch.ts";
import { extractContent, type ExtractedContent } from "./extract.ts";
import { extractColors, fetchStylesheetText } from "./colors.ts";
import { selectImages } from "./images.ts";
import { makeClient, RefusalError } from "../llm/client.ts";
import { generateBrief } from "../llm/brief.ts";
import { generateAds } from "../llm/ads.ts";
import { filterBrandImages } from "../llm/filter.ts";
import { languageInstruction } from "../llm/schemas.ts";
import { db } from "../db/index.ts";
import { jobs, ads as adsTable } from "../db/schema.ts";
import { getJobResponse } from "../db/repo.ts";
import {
  servedImageUrl,
  type AdDraft,
  type BrandBrief,
  type ExtractedImage,
  type JobResponse,
  type JobStatus,
  type RenderMode,
} from "../../shared/types.ts";

function hasApiKey(env: Env): boolean {
  const k = env.ANTHROPIC_API_KEY;
  return !!k && k.startsWith("sk-ant-");
}

export async function runJob(
  env: Env,
  url: string,
  count: number,
  language: string,
): Promise<JobResponse> {
  const budget = new Budget();
  const reasons: string[] = [];
  const langInstr = languageInstruction(language);
  let renderMode: RenderMode = "failed";

  // 1. Load the page: plain fetch, with SPA fallback to the browser.
  let html = "";
  const plain = await fetchPlain(url, budget);
  if (plain.ok) {
    html = plain.html;
    renderMode = "plain";
  } else {
    reasons.push(plain.reason ?? "Plain fetch failed.");
  }

  let content: ExtractedContent | null = html ? await extractContent(html) : null;

  const wantBrowser =
    !plain.ok || (content !== null && looksLikeSpa(html, content.textLength));
  if (wantBrowser && !budget.exhausted()) {
    const rendered = await renderWithBrowser(env, url, budget);
    if (rendered.ok) {
      html = rendered.html;
      content = await extractContent(html);
      renderMode = "browser";
      if (plain.ok) reasons.push("Page needed JavaScript rendering; used headless browser.");
    } else {
      reasons.push(rendered.reason ?? "Browser rendering failed.");
      if (!plain.ok) {
        // Nothing loaded at all — persist a failed job and return.
        return persist(env, url, {
          status: "failed",
          renderMode: "failed",
          language,
          reasons,
          brief: null,
          colors: [],
          images: [],
          drafts: [],
          budget,
        });
      }
    }
  }

  if (!content) {
    return persist(env, url, {
      status: "failed",
      renderMode: "failed",
      language,
      reasons: reasons.length ? reasons : ["Could not extract any content."],
      brief: null,
      colors: [],
      images: [],
      drafts: [],
      budget,
    });
  }

  // 2. Colors: inline <style> + linked CSS (best-effort), with strong priors.
  let cssText = content.styleText;
  try {
    const sheetCss = await fetchStylesheetText(content.stylesheets, url, budget);
    if (sheetCss) cssText += "\n" + sheetCss;
  } catch {
    /* best-effort */
  }
  const colors = extractColors([content.themeColor, ...content.colorHints], cssText);

  // 3. Images: resolve + filter + URL dedup (content-hash dedup deferred with R2).
  let images: ExtractedImage[] = [];
  try {
    images = selectImages(content.rawImages, content.ogImage, url);
  } catch (e) {
    reasons.push(`Image processing skipped: ${errMsg(e)}`);
  }

  // 4. LLM brief + ads (tiered: Haiku then Sonnet). Skipped without an API key.
  let brief: BrandBrief | null = null;
  let drafts: AdDraft[] = [];

  if (!hasApiKey(env)) {
    reasons.push("LLM step skipped: ANTHROPIC_API_KEY not configured.");
  } else {
    const client = makeClient(env.ANTHROPIC_API_KEY);
    try {
      brief = await generateBrief(client, budget, content, url, langInstr);
    } catch (e) {
      reasons.push(llmReason("Brand brief", e));
    }
    // Drop other companies' logos (client/partner marks) URL heuristics can't catch.
    if (brief && images.length > 1 && !budget.exhausted()) {
      try {
        images = await filterBrandImages(client, budget, brief.name, url, images);
      } catch {
        /* keep the heuristic-filtered list on failure */
      }
    }
    if (brief && !budget.exhausted()) {
      try {
        drafts = await generateAds(client, budget, brief, images, count, langInstr);
      } catch (e) {
        reasons.push(llmReason("Ad generation", e));
      }
    } else if (brief) {
      reasons.push("Ad generation skipped: time/cost budget reached.");
    }
  }

  // "ok" once we have a brief and at least one ad — benign notes (browser used,
  // a few images dropped) are still listed as context but don't downgrade status.
  const status: JobStatus =
    brief && drafts.length > 0 ? "ok" : "partial";

  return persist(env, url, {
    status,
    renderMode,
    language,
    reasons,
    brief,
    colors,
    images,
    drafts,
    budget,
  });
}

interface PersistInput {
  status: JobStatus;
  renderMode: RenderMode;
  language: string;
  reasons: string[];
  brief: BrandBrief | null;
  colors: string[];
  images: ExtractedImage[];
  drafts: AdDraft[];
  budget: Budget;
}

async function persist(env: Env, url: string, input: PersistInput): Promise<JobResponse> {
  const d = db(env.DB);
  const jobId = crypto.randomUUID();
  const now = Date.now();

  await d.insert(jobs).values({
    id: jobId,
    url,
    status: input.status,
    renderMode: input.renderMode,
    language: input.language,
    degradationReasons: input.reasons,
    brief: input.brief,
    colors: input.colors,
    images: input.images,
    costUsd: round(input.budget.costUsd),
    tokensIn: input.budget.tokensIn,
    tokensOut: input.budget.tokensOut,
    durationMs: input.budget.elapsedMs(),
    createdAt: now,
  });

  if (input.drafts.length) {
    await d.insert(adsTable).values(
      input.drafts.map((dr) => ({
        id: crypto.randomUUID(),
        jobId,
        version: 0,
        creativeConcept: dr.creativeConcept,
        primaryText: dr.primaryText,
        headline: dr.headline,
        description: dr.description,
        cta: dr.cta,
        imageUrl: imageUrlFor(dr.imageIndex, input.images),
        edited: false,
        updatedAt: now,
      })),
    );
  }

  const result = await getJobResponse(d, jobId);
  if (!result) throw new Error("Failed to read back persisted job.");
  return result;
}

/** Resolve an image index to a displayable URL, falling back when the model omits one. */
export function imageUrlFor(idx: number | null, images: ExtractedImage[]): string | null {
  if (images.length === 0) return null;
  if (idx === null || idx < 0 || idx >= images.length) return servedImageUrl(images[0]);
  return servedImageUrl(images[idx]);
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function llmReason(stage: string, e: unknown): string {
  if (e instanceof RefusalError) return `${stage} declined by the model (content safety).`;
  return `${stage} failed: ${errMsg(e)}`;
}
