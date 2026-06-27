import type Anthropic from "@anthropic-ai/sdk";
import type { Budget } from "../lib/budget.ts";
import type { ExtractedImage } from "../../shared/types.ts";
import { callStructured } from "./client.ts";

const MODEL = "claude-haiku-4-5";

const FILTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    keep: { type: "array", items: { type: "integer" } },
  },
  required: ["keep"],
} as const;

const FILTER_SYSTEM =
  "You filter images scraped from a brand's website so an ad never uses someone else's mark. " +
  "KEEP only images that belong to THIS brand: its own logo, product screenshots, hero/banner/marketing imagery. " +
  "REMOVE images that are OTHER companies' marks — client, partner, reference or customer logos, and " +
  "screenshots of other companies' products. The filename and alt text usually name the other company. " +
  "When an image is genuinely ambiguous, keep it. Return the indexes to keep.";

function basename(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || url);
  } catch {
    return url;
  }
}

export async function filterBrandImages(
  client: Anthropic,
  budget: Budget,
  brandName: string,
  url: string,
  images: ExtractedImage[],
): Promise<ExtractedImage[]> {
  if (images.length <= 1) return images;

  const lines = images
    .map((im, i) => `[${i}] file="${basename(im.url)}"${im.alt ? ` alt="${im.alt}"` : ""}`)
    .join("\n");
  const user =
    `Brand: ${brandName} (${url})\n\nImages:\n${lines}\n\n` +
    `Return the indexes of images that belong to ${brandName}.`;

  const raw = await callStructured(client, budget, {
    model: MODEL,
    system: FILTER_SYSTEM,
    user,
    schema: FILTER_SCHEMA,
    maxTokens: 300,
  });

  const keep = (raw as { keep?: unknown }).keep;
  if (!Array.isArray(keep)) return images;
  const keepSet = new Set(keep.filter((n): n is number => Number.isInteger(n)));
  const filtered = images.filter((_, i) => keepSet.has(i));


  return filtered.length > 0 ? filtered : images;
}
