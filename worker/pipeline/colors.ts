
import type { Budget } from "../lib/budget.ts";

function normalizeHex(hex: string): string | null {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return "#" + h;
}

function rgbToHex(r: number, g: number, b: number): string | null {
  if ([r, g, b].some((v) => v < 0 || v > 255 || Number.isNaN(v))) return null;
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function isBoring(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
  if (lightness > 240 || lightness < 18) return true;
  if (saturation < 0.12) return true;
  return false;
}

export function extractColors(priors: (string | null)[], css: string, max = 5): string[] {
  const counts = new Map<string, number>();

  const add = (norm: string | null, weight: number) => {
    if (norm) counts.set(norm, (counts.get(norm) ?? 0) + weight);
  };

  for (const p of priors) {
    if (p) add(normalizeHex(p.trim()), 1000);
  }

  for (const m of css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
    add(normalizeHex(m), 1);
  }
  for (const m of css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g) ?? []) {
    const nums = m.match(/\d+/g)!.map(Number);
    add(rgbToHex(nums[0], nums[1], nums[2]), 1);
  }

  const ranked = [...counts.entries()]
    .filter(([hex, weight]) => weight >= 1000 || !isBoring(hex))
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);

  return [...new Set(ranked)].slice(0, max);
}

export async function fetchStylesheetText(
  hrefs: string[],
  baseUrl: string,
  budget: Budget,
  maxSheets = 2,
  maxBytesEach = 300_000,
): Promise<string> {
  if (budget.exhausted()) return "";
  const urls = hrefs
    .map((h) => {
      try {
        const u = new URL(h, baseUrl);
        return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
      } catch {
        return null;
      }
    })
    .filter((u): u is string => !!u)
    .slice(0, maxSheets);

  const texts = await Promise.all(
    urls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { signal: controller.signal as any });
        clearTimeout(timer);
        if (!res.ok) return "";
        return (await res.text()).slice(0, maxBytesEach);
      } catch {
        return "";
      }
    }),
  );
  return texts.join("\n");
}
