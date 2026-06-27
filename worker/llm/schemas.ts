
import { LANGUAGES, type BrandBrief, type ExtractedImage } from "../../shared/types.ts";
import type { ExtractedContent } from "../pipeline/extract.ts";

export function languageInstruction(code: string | null | undefined): string {
  const lang = LANGUAGES.find((l) => l.code === code);
  if (!lang || !lang.name) {
    return "Write ALL user-facing output fields in the same language as the website content. Keep brand/company/product names unchanged.";
  }
  return [
    `Target language: ${lang.name}.`,
    `Translate ALL user-facing output fields into ${lang.name}, regardless of the source language.`,
    "This includes tagline, valueProps, tone, audience, summary, creativeConcept, primaryText, headline, description, and cta.",
    "Keep only proper nouns, brand/company/product names, URLs, and established acronyms unchanged.",
    `Do not leave Czech, English, or any other source-language prose in the output unless it is a proper noun.`,
  ].join(" ");
}

export const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    tagline: { type: "string" },
    valueProps: { type: "array", items: { type: "string" } },
    tone: { type: "array", items: { type: "string" } },
    audience: { type: "string" },
    summary: { type: "string" },
  },
  required: ["name", "tagline", "valueProps", "tone", "audience", "summary"],
} as const;

export const ADS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          creativeConcept: { type: "string" },
          primaryText: { type: "string" },
          headline: { type: "string" },
          description: { type: "string" },
          cta: { type: "string" },
          imageIndex: { type: ["integer", "null"] },
        },
        required: [
          "creativeConcept",
          "primaryText",
          "headline",
          "description",
          "cta",
          "imageIndex",
        ],
      },
    },
  },
  required: ["ads"],
} as const;

export const BRIEF_SYSTEM =
  "You are a brand analyst. From the scraped website content provided, extract a concise, factual brand brief. " +
  "Use ONLY information present in the content — never invent products, claims, metrics, or audiences. " +
  "If something is unknown, infer conservatively from wording and tone or leave it general. " +
  "`tone` is 3-6 adjectives describing the brand voice (e.g. playful, premium, technical). " +
  "`valueProps` is 2-5 short phrases. Keep everything grounded in the source.";

export function buildBriefUser(c: ExtractedContent, url: string): string {
  const parts = [
    `URL: ${url}`,
    c.siteName ? `Site name: ${c.siteName}` : "",
    c.title ? `Title: ${c.title}` : "",
    c.description ? `Meta description: ${c.description}` : "",
    c.headings.length ? `Headings:\n- ${c.headings.slice(0, 20).join("\n- ")}` : "",
    c.paragraphs.length
      ? `Body text:\n${c.paragraphs.slice(0, 25).join("\n")}`
      : "",
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 12_000);
}

export const ADS_SYSTEM =
  "You are a senior performance copywriter producing Meta/Google-style ad creatives. " +
  "Ground every claim ONLY in the brand brief provided — do NOT invent features, prices, discounts, statistics, or guarantees. " +
  "Match the brand `tone`. For each ad produce:\n" +
  "- creativeConcept: one sentence describing the angle/idea (internal note, not shown in the ad).\n" +
  "- primaryText: the main ad body, 1-3 sentences (<=140 chars ideally).\n" +
  "- headline: punchy, <=60 chars.\n" +
  "- description: a short supporting line, <=90 chars.\n" +
  "- cta: a concrete call to action, <=25 chars (e.g. \"Get started\", \"Learn more\").\n" +
  "If any images are available, every ad MUST set `imageIndex` to one of their indexes; use null only when AVAILABLE IMAGES is (none). " +
  "Make the ads distinct in angle and wording.";


export function buildAdsContext(brief: BrandBrief, images: ExtractedImage[]): string {
  const imgLines = images.length
    ? images
        .map((img, i) => `  [${i}] ${img.alt ? `"${img.alt}" — ` : ""}${img.url}`)
        .join("\n")
    : "  (none)";
  return [
    "BRAND BRIEF:",
    `  Name: ${brief.name}`,
    `  Tagline: ${brief.tagline}`,
    `  Audience: ${brief.audience}`,
    `  Tone: ${brief.tone.join(", ")}`,
    `  Value props:\n${brief.valueProps.map((v) => `    - ${v}`).join("\n")}`,
    `  Summary: ${brief.summary}`,
    "",
    "AVAILABLE IMAGES (index — alt — url):",
    imgLines,
  ].join("\n");
}
