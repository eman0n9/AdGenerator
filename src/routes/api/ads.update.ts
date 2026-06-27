import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { UpdateAdInput } from "../../../shared/types.ts";
import { db } from "../../../worker/db/index.ts";
import { ads } from "../../../worker/db/schema.ts";
import { getAd, rowToAd } from "../../../worker/db/repo.ts";

/**
 * Edit an ad. Optimistic concurrency: the UPDATE is guarded by the version the
 * client last saw, so concurrent edits/regenerations can't silently overwrite
 * each other (409 with the current state on conflict).
 */
export const Route = createFileRoute("/api/ads/update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = UpdateAdInput.safeParse(body);
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

        await d
          .update(ads)
          .set({
            creativeConcept: data.creativeConcept,
            primaryText: data.primaryText,
            headline: data.headline,
            description: data.description,
            cta: data.cta,
            imageUrl: data.imageUrl,
            edited: true,
            version: current.version + 1,
            updatedAt: Date.now(),
          })
          .where(and(eq(ads.id, data.id), eq(ads.version, data.version)));

        const updated = await getAd(d, data.id);
        return Response.json({ ad: updated ? rowToAd(updated) : null });
      },
    },
  },
});
