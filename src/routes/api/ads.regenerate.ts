import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { RegenerateAdInput } from "../../../shared/types.ts";
import { db } from "../../../worker/db/index.ts";
import { ads, jobs } from "../../../worker/db/schema.ts";
import { getAd, getJobRow, getJobResponse, rowToAd } from "../../../worker/db/repo.ts";
import { Budget } from "../../../worker/lib/budget.ts";
import { makeClient, RefusalError } from "../../../worker/llm/client.ts";
import { regenerateOneAd } from "../../../worker/llm/ads.ts";
import { languageInstruction } from "../../../worker/llm/schemas.ts";
import { imageUrlFor } from "../../../worker/pipeline/run.ts";

export const Route = createFileRoute("/api/ads/regenerate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = RegenerateAdInput.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid request body." }, { status: 400 });
        }
        const data = parsed.data;
        const d = db(env.DB);
        const current = await getAd(d, data.id);
        if (!current) return Response.json({ error: "Ad not found." }, { status: 404 });
        if (current.version !== data.version) {
          return Response.json(
            { error: "Version conflict.", current: rowToAd(current) },
            { status: 409 },
          );
        }

        const key = env.ANTHROPIC_API_KEY;
        if (!key || !key.startsWith("sk-ant-")) {
          return Response.json(
            { error: "Regeneration unavailable: ANTHROPIC_API_KEY not configured." },
            { status: 400 },
          );
        }

        const jobRow = await getJobRow(d, current.jobId);
        if (!jobRow || !jobRow.brief) {
          return Response.json(
            { error: "No brand brief available for this job; cannot regenerate." },
            { status: 400 },
          );
        }

        const siblings = await d.select().from(ads).where(eq(ads.jobId, current.jobId));
        const existing = siblings
          .filter((a) => a.id !== data.id)
          .map((a) => ({ headline: a.headline, primaryText: a.primaryText }));

        const budget = new Budget();
        const client = makeClient(key);
        let draft;
        try {
          draft = await regenerateOneAd(
            client,
            budget,
            jobRow.brief,
            jobRow.images,
            existing,
            languageInstruction(jobRow.language),
          );
        } catch (e) {
          if (e instanceof RefusalError) {
            return Response.json(
              { error: "The model declined to regenerate this ad." },
              { status: 422 },
            );
          }
          console.error("regenerate failed", e);
          return Response.json({ error: "Regeneration failed." }, { status: 500 });
        }

        const now = Date.now();
        await d
          .update(ads)
          .set({
            creativeConcept: draft.creativeConcept,
            primaryText: draft.primaryText,
            headline: draft.headline,
            description: draft.description,
            cta: draft.cta,
            imageUrl: imageUrlFor(draft.imageIndex, jobRow.images),
            edited: false,
            version: current.version + 1,
            updatedAt: now,
          })
          .where(and(eq(ads.id, data.id), eq(ads.version, data.version)));

        await d
          .update(jobs)
          .set({
            costUsd: Math.round((jobRow.costUsd + budget.costUsd) * 1e6) / 1e6,
            tokensIn: jobRow.tokensIn + budget.tokensIn,
            tokensOut: jobRow.tokensOut + budget.tokensOut,
          })
          .where(eq(jobs.id, current.jobId));

        const result = await getJobResponse(d, current.jobId);
        return Response.json(result);
      },
    },
  },
});
