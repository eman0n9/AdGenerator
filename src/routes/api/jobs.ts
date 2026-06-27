import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { CreateJobInput } from "../../../shared/types.ts";
import type { Env } from "../../../worker/lib/env.ts";
import { validateUrl } from "../../../worker/lib/ssrf.ts";
import { runJob } from "../../../worker/pipeline/run.ts";

export const Route = createFileRoute("/api/jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = CreateJobInput.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid request body." }, { status: 400 });
        }
        const ssrf = validateUrl(parsed.data.url);
        if (!ssrf.ok) {
          return Response.json({ error: ssrf.reason ?? "URL not allowed." }, { status: 400 });
        }
        try {
          const result = await runJob(
            env as unknown as Env,
            parsed.data.url,
            parsed.data.count ?? 3,
            parsed.data.language ?? "auto",
          );
          return Response.json(result);
        } catch (e) {
          console.error("runJob failed", e);
          return Response.json(
            { error: "Internal error while processing the URL." },
            { status: 500 },
          );
        }
      },
    },
  },
});
