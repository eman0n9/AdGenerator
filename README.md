# Ad Generator

Paste a URL → get a structured brand profile, suitable images, and editable,
ready-to-run ad creatives. Scrapes unknown sites (including JavaScript-rendered
ones), distils a brand brief, and generates tone-matched ads grounded only in
what's actually on the page — with explicit cost/latency limits and honest
degradation.

Built on the required stack: **TanStack Start + Cloudflare Workers + D1 + TypeScript**.

---

## Approach

The core is a **degrade-gracefully pipeline**. Every stage is wrapped so a
failure becomes a recorded *reason* rather than a crash, and the job's final
`status` (`ok` / `partial` / `failed`) plus a list of `degradationReasons` tell
the user exactly what's missing and why. When a field can't be extracted the UI
shows an explicit **"Not found"** rather than a blank.

```
URL
 → SSRF guard
 → load page:  plain fetch  ──(thin / SPA shell?)──▶  Cloudflare Browser Rendering
 → extract:    HTMLRewriter → title/meta/OG/headings/body, linked CSS, <img>
 → colors:     theme-color + hex/rgb frequency across inline + external CSS
 → images:     OG image + <img> extraction → URL dedup → direct source URLs
 → brief:      Haiku 4.5  → structured BrandBrief   (grounded in scraped facts)
 → ads:        Sonnet 4.6 → structured Ad[]         (tone-matched, no invented claims)
 → persist:    D1 (one row per ad)
```

Each ad has the full creative set: **creative concept, primary text, headline,
description, CTA, and a chosen image**. Preview / edit / replace-image /
upload-image / regenerate then operate on the persisted rows.

## AI tooling & models

Two-tier model strategy, chosen for the cost/latency budget:

| Stage | Model | Why |
|---|---|---|
| Brand brief extraction | **Claude Haiku 4.5** (`claude-haiku-4-5`) | Cheap, fast, structured — it's normalization, not creative work. |
| Ad copy generation / regeneration | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | Best quality/tone-per-dollar. Opus would blow the latency budget for marginal copy gains. |

Both use **structured outputs** (`output_config.format` + JSON schema), validated
again with **Zod** at runtime. SDK: `@anthropic-ai/sdk`.

**Anti-hallucination (the AI layer is graded on this):**
- The model only ever sees *facts extracted from the page* — never its own world knowledge of the brand.
- System prompts forbid inventing features, prices, stats, or guarantees.
- Output is schema-constrained; `imageIndex` can only reference an image we actually found (validated server-side).
- `stop_reason: "refusal"` is handled explicitly; missing content → "Not found", never invented.

**Prompt caching:** the stable context (brand brief + image list + instructions)
is a cached system block, so regenerating one ad reuses it cheaply and stays
consistent in tone.

## Key architectural decisions

- **TanStack Start on a single Cloudflare Worker.** The React app (SSR + hydration)
  and the backend live in one deploy unit. The backend is TanStack Start **server
  routes** under `src/routes/api/*`; Cloudflare bindings (D1, Browser) are
  accessed via `import { env } from "cloudflare:workers"`.
- **Framework-agnostic domain layer.** All scraping / extraction / LLM / DB logic
  lives in `worker/` as plain modules that take an explicit `Env`. The HTTP layer
  is a thin shell over it — which is exactly what made swapping the transport
  cheap (see the AI notes on the mid-project stack migration).
- **Per-job `Budget`** threaded through the pipeline enforces a wall-clock deadline
  (`Promise.race`) and accumulates *real* token cost from the Anthropic `usage`
  field. Cost, tokens, and duration are stored on the job and shown in the UI.
- **No-overwrite persistence.** Each ad is its own row with a `version`. Edits and
  regeneration update only that row, guarded by an optimistic-concurrency
  `WHERE id = ? AND version = ?`; a stale write returns **409** with the current
  state. *Verified: regenerating one ad does not clobber edits to others.*
- **Images are referenced directly from the source site.** The app extracts
  `og:image` and `<img>` URLs, filters obvious tracking/placeholder assets,
  deduplicates by URL, and shows them with a white preview background. If a
  chosen image fails to load, the client falls back to another found image.
  User uploads are stored on the ad row as a data URL rather than in object
  storage.
- **Works without an API key.** If `ANTHROPIC_API_KEY` is unset, scraping / colors
  / images / persistence still run and the LLM step degrades with a reason —
  useful for demos and for isolating the scraping layer.

## What works

- Full scenario end to end: URL → brand profile → images → ads → preview → edit →
  replace/upload image → regenerate, all persisted.
- Plain-fetch + SPA→browser fallback, color extraction (inline + external CSS),
  image extraction from `og:image` / `<img>`, URL dedup, fallback image selection,
  and user upload via data URL.
- SSRF guard, input validation, graceful degradation with explanations, "Not found".
- Cost/latency budget with real cost accounting (incl. across regenerations).
- Optimistic-concurrency edit/regenerate (no lost updates).
- Output-language selector: **Auto** (match the site's own language) or a forced
  language, applied consistently to the brief and the ads and stored on the job.

## Consciously deferred (and why)

- **Async job queue / Cloudflare Workflows.** Jobs run synchronously within the
  request under a ~30s deadline. Fine for the test budget; a durable queue is the
  right move for slow sites and retries. *Top of the "what's next" list.*
- **Automated hallucination check.** Grounding + schema + prompts reduce it, but
  there's no second-pass verifier scoring each claim against the source. Next step
  would be a Haiku "does this ad match the brief?" judge with filtering.
- **Pixel-accurate brand colors** (k-means over the logo / `og:image`).
- **Deeper SSRF hardening** (DNS-rebinding: re-resolve + pin the connection IP).
- **Real image *generation*** (we select from images found on the site or uploaded).
- **Image proxy/cache in R2.** The current version does not proxy or cache source
  images through our origin. It relies on direct image URLs and a data-URL upload
  fallback, which was enough for the vertical slice but is weaker against CDN
  hotlink protection.
- **Multi-URL/batch, auth, multi-tenancy, UI i18n** — interface strings are
  English; the *ad output* language is selectable (Auto/forced).

## Known limitations (what doesn't fully work)

- **JS rendering needs the deployed Worker on a paid plan.** Browser Rendering
  isn't emulated under `vite dev` and isn't on the free plan, so JS-only pages
  degrade with a reason locally and fully render only on the deployed paid Worker.
  This is the documented graceful fallback.
- **No image proxy/cache.** Images are loaded from their original URLs. CDNs that
  block hotlinking or bot traffic can still fail in the browser. The UI falls
  back to another found image where possible, and users can upload their own
  image, but there is no R2-backed `/api/img` proxy/cache in this version.
- **No content-hash image deduplication.** Images are deduplicated by URL only.
- **Brand colors are heuristic**, not pixel-accurate — on near-empty pages an
  incidental accent color (e.g. a link color) can surface as a "brand" color.
- **No automated hallucination check** — grounding + schema + prompts mitigate it
  but don't guarantee it (see deferred).
- **Jobs are synchronous** under a ~30s budget; a very slow site can hit the
  deadline and return a partial result with the reason shown.

## How I'd continue

1. Durable async jobs via **Cloudflare Workflows** (retries, slow sites, progress UI).
2. A cheap-model **verifier** scoring each ad against the brief (tone-match +
   hallucination) and regenerating/filtering low-quality ones.
3. **Pixel-accurate colors** (k-means over the logo / `og:image`).
4. **Stronger SSRF** (re-resolve DNS + pin the connection IP).
5. **Tests + an eval harness** run against the provided test URLs.

---

## Running locally

Prerequisites: Node 20+, a Cloudflare account (free tier is fine for local dev).

```bash
npm install
npm run db:migrate:local                 # 1. local D1
cp .dev.vars.example .dev.vars           # 2. add your Anthropic key (see the file)
npm run dev                              # 3. http://localhost:5173
```

Get a key at https://console.anthropic.com → API Keys (needs billing credit).
Without it the app still scrapes and shows brand data; the ad step degrades with
an explanation.

## Deploying to Cloudflare

```bash
npx wrangler d1 create ad-generator-db        # paste database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put ANTHROPIC_API_KEY     # secret, NOT in .dev.vars
npm run deploy
```

**Browser Rendering** (JS-rendered pages) needs the `browser` binding, which
requires a paid Workers plan. If unavailable, JS-heavy pages degrade with a clear
reason instead of failing — a documented graceful fallback.

## Project layout

```
src/
  router.tsx              TanStack Start router
  routes/
    __root.tsx            HTML shell (SSR document)
    index.tsx             main UI (form, brand panel, editable ad previews)
    api/                  server routes: jobs, ads.update, ads.regenerate
  components/             BrandPanel, AdCard (editable preview)
  api.ts                  typed client for the api routes
worker/                   framework-agnostic domain layer (reused by the server routes)
  pipeline/               fetch, extract, colors, images, run (orchestrator)
  llm/                    client, brief (Haiku), ads (Sonnet), schemas
  lib/                    env, ssrf, budget
  db/                     drizzle schema, repo
shared/types.ts           Zod schemas + types shared by client and server
migrations/               generated D1 SQL
```

See [AI_NOTES.md](./AI_NOTES.md) for how AI agents were used.
