
import type { ExtractedImage } from "../../shared/types.ts";

const JUNK_PATTERN = /(sprite|pixel|spacer|blank|1x1|tracking|beacon|loader|placeholder)/i;
const MAX_IMAGES = 12;

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

function brandToken(baseUrl: string): string {
  try {
    const parts = new URL(baseUrl).hostname.toLowerCase().split(".").filter(Boolean);
    while (parts.length > 2 && SUBDOMAINS.has(parts[0])) parts.shift();
    return parts[0] ?? "";
  } catch {
    return "";
  }
}

function isForeignLogo(url: string, alt: string | null, token: string): boolean {
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }
  if (!LOGO_GALLERY.test(path)) return false;
  if (token.length < 3) return false;
  const brandPresent = path.includes(token) || (alt ?? "").toLowerCase().includes(token);
  return !brandPresent;
}

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
    if (!exemptLogoFilter && isForeignLogo(url, alt, token)) return;
    seen.add(url);
    out.push({ url, alt, cacheKey: null });
  };

  if (ogImage) push(ogImage, "Open Graph preview image", true);
  for (const img of rawImages) {
    if (out.length >= MAX_IMAGES) break;
    push(img.src, img.alt);
  }
  return out.slice(0, MAX_IMAGES);
}
