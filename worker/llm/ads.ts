import type Anthropic from "@anthropic-ai/sdk";
import type { Budget } from "../lib/budget.ts";
import {
  AdsGenerationSchema,
  AdDraftSchema,
  type AdDraft,
  type BrandBrief,
  type ExtractedImage,
} from "../../shared/types.ts";
import { callStructured } from "./client.ts";
import { ADS_SCHEMA, ADS_SYSTEM, buildAdsContext } from "./schemas.ts";

const MODEL = "claude-sonnet-4-6";

export async function generateAds(
  client: Anthropic,
  budget: Budget,
  brief: BrandBrief,
  images: ExtractedImage[],
  count: number,
  langInstruction: string,
): Promise<AdDraft[]> {
  const raw = await callStructured(client, budget, {
    model: MODEL,
    system: ADS_SYSTEM + " " + langInstruction,
    cachedContext: buildAdsContext(brief, images),
    user: `Generate ${count} distinct ad creatives for this brand.`,
    schema: ADS_SCHEMA,
    maxTokens: 2000,
  });
  const parsed = AdsGenerationSchema.parse(raw);
  return parsed.ads.slice(0, count);
}

/** Regenerate a single fresh ad, distinct from the ones the user already has. */
export async function regenerateOneAd(
  client: Anthropic,
  budget: Budget,
  brief: BrandBrief,
  images: ExtractedImage[],
  existing: { headline: string; primaryText: string }[],
  langInstruction: string,
): Promise<AdDraft> {
  const avoid = existing.map((a) => `- ${a.headline} / ${a.primaryText}`).join("\n");
  const raw = await callStructured(client, budget, {
    model: MODEL,
    system: ADS_SYSTEM + " " + langInstruction,
    cachedContext: buildAdsContext(brief, images),
    user:
      "Generate exactly ONE new ad creative, clearly different in angle and wording " +
      `from these existing ads:\n${avoid}\n\nReturn it as the single element of the "ads" array.`,
    schema: ADS_SCHEMA,
    maxTokens: 800,
  });
  const parsed = AdsGenerationSchema.parse(raw);
  const first = parsed.ads[0];
  if (!first) throw new Error("Model returned no ad.");
  return AdDraftSchema.parse(first);
}
