/**
 * Image selection: resolve → filter junk → de-duplicate by URL.
 *
 * Content-hash dedup + R2 caching/serving were dropped with R2 (free-tier deploy
 * without a payment method) — see README "deferred". Images are referenced by
 * their original source URL; the UI falls back to other found images if one
 * can't be displayed, and users can upload their own (stored as a data URL).
 */
import type { ExtractedImage } from "../../shared/types.ts";

const JUNK_PATTERN = /(sprite|pixel|spacer|blank|1x1|tracking|beacon|loader|placeholder)/i;
const MAX_IMAGES = 12;

// Paths/filenames that signal a third-party logo gallery (references, clients,
// partners, "our customers", logo strips, etc.). Generic — not per-domain.
const LOGO_GALLERY =
  /(reference|client|partner|customer|portfolio|case-?stud|\bloga\b|logos?|thumbs?|brands?|screenshot)/i;

const SUBDOMAINS = new Set(["www", "en", "de", "cs", "cz", "app", "shop", "store", "m", "web"]);

function resolve(src: string, baseUrl: string): string | null {
  try {
    const u = new URL(src, baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** The brand's own name token, derived from the hostname (e.g. oxit.cz → "oxit"). */
function brandToken(baseUrl: string): string {
  try {
    const parts = new URL(baseUrl).hostname.toLowerCase().split(".").filter(Boolean);
    while (parts.length > 2 && SUBDOMAINS.has(parts[0])) parts.shift();
    return parts[0] ?? "";
  } catch {
    return "";
  }
}

/**
 * Detects images that are *other companies'* logos (client/reference/partner
 * strips). Heuristic: the image sits in a logo-gallery path AND the brand's own
 * token is absent from its path/filename/alt. The brand's own logo keeps the
 * token (e.g. /layout/oxit-logo.svg) and is preserved.
 */
function isForeignLogo(url: string, alt: string | null, token: string): boolean {
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }
  if (!LOGO_GALLERY.test(path)) return false;
  if (token.length < 3) return false; // can't identify the brand → keep
  const brandPresent = path.includes(token) || (alt ?? "").toLowerCase().includes(token);
  return !brandPresent;
}

/** Resolve + filter + URL-dedup the page's images. */
export function selectImages(
  rawImages: { src: string; alt: string | null }[],
  ogImage: string | null,
  baseUrl: string,
): ExtractedImage[] {
  const token = brandToken(baseUrl);
  const seen = new Set<string>();
  const out: ExtractedImage[] = [];

  const push = (src: string, alt: string | null, exemptLogoFilter = false) => {
    const url = resolve(src, baseUrl);
    if (!url || JUNK_PATTERN.test(url) || seen.has(url)) return;
    if (!exemptLogoFilter && isForeignLogo(url, alt, token)) return; // drop others' logos
    seen.add(url);
    out.push({ url, alt, cacheKey: null });
  };

  // og:image is the brand's own chosen preview — never filter it.
  if (ogImage) push(ogImage, "Open Graph preview image", true);
  for (const img of rawImages) {
    if (out.length >= MAX_IMAGES) break;
    push(img.src, img.alt);
  }
  return out.slice(0, MAX_IMAGES);
}
