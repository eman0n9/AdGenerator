import type { D1Database, Fetcher } from "@cloudflare/workers-types";

/** Cloudflare bindings declared in wrangler.jsonc. */
export interface Env {
  DB: D1Database;
  // BrowserWorker binding; typed loosely because @cloudflare/puppeteer owns the real type.
  BROWSER: Fetcher;
  ANTHROPIC_API_KEY: string;
}
