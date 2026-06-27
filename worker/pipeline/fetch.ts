
import puppeteer from "@cloudflare/puppeteer";
import type { Env } from "../lib/env.ts";
import type { Budget } from "../lib/budget.ts";

const UA =
  "Mozilla/5.0 (compatible; AdGeneratorBot/0.1; +https://example.com/bot)";

export async function fetchPlain(
  url: string,
  budget: Budget,
): Promise<{ ok: boolean; html: string; reason?: string }> {
  try {
    const res = await budget.race(
      fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        redirect: "follow",
      }),
      "plain fetch",
    );
    if (!res.ok) {
      return { ok: false, html: "", reason: `Fetch returned HTTP ${res.status}.` };
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("xml") && ct !== "") {
      return { ok: false, html: "", reason: `Unexpected content-type "${ct}".` };
    }
    const html = await res.text();
    return { ok: true, html };
  } catch (e) {
    return { ok: false, html: "", reason: `Plain fetch failed: ${errMsg(e)}` };
  }
}

/** Heuristic: does this HTML look like it needs JS to render real content? */
export function looksLikeSpa(html: string, textLength: number): boolean {
  if (textLength > 600) return false; // already has real content
  const scriptCount = (html.match(/<script\b/gi) || []).length;
  const hasAppRoot =
    /<div[^>]+id=["'](root|app|__next|__nuxt|app-root)["']/i.test(html);
  const hasHydration = /__NEXT_DATA__|window\.__NUXT__|data-reactroot|ng-version/i.test(html);
  return hasAppRoot || hasHydration || scriptCount > 8;
}

export async function renderWithBrowser(
  env: Env,
  url: string,
  budget: Budget,
): Promise<{ ok: boolean; html: string; reason?: string }> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await budget.race(puppeteer.launch(env.BROWSER as any), "browser launch");
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    const gotoTimeout = Math.min(budget.remainingMs(), 15_000);
    await page.goto(url, { waitUntil: "networkidle0", timeout: gotoTimeout });
    const html = await page.content();
    return { ok: true, html };
  } catch (e) {
    return {
      ok: false,
      html: "",
      reason: `JavaScript rendering unavailable: ${errMsg(e)}`,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {

      }
    }
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
