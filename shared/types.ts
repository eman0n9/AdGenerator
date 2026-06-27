import { z } from "zod";

/**
 * Shared contracts between the server (TanStack Start server functions) and the
 * React client. Pure TypeScript + Zod — no Worker- or Node-specific imports.
 */

// ---------- Brand brief (LLM extraction output, Haiku) ----------

export const BrandBriefSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  valueProps: z.array(z.string()),
  tone: z.array(z.string()),
  audience: z.string(),
  summary: z.string(),
});
export type BrandBrief = z.infer<typeof BrandBriefSchema>;

// ---------- Ad creative (LLM generation output, Sonnet) ----------
// Fields mandated by the brief: creative concept, primary text, headline,
// description, CTA, and a chosen image.

export const AdDraftSchema = z.object({
  creativeConcept: z.string(),
  primaryText: z.string(),
  headline: z.string(),
  description: z.string(),
  cta: z.string(),
  /** Index into the images array we passed the model, or null if none fits. */
  imageIndex: z.number().int().nullable(),
});
export type AdDraft = z.infer<typeof AdDraftSchema>;

export const AdsGenerationSchema = z.object({
  ads: z.array(AdDraftSchema),
});
export type AdsGeneration = z.infer<typeof AdsGenerationSchema>;

// ---------- API resources ----------

export type RenderMode = "plain" | "browser" | "failed";
export type JobStatus = "ok" | "partial" | "failed";

export interface ExtractedImage {
  url: string;
  alt: string | null;
  /** R2 key if we cached the bytes, else null. */
  cacheKey: string | null;
}

/** Cached images are served from our own origin (sidesteps hotlink blocks);
 *  uncached ones use the original source URL. */
export function servedImageUrl(img: ExtractedImage): string {
  return img.cacheKey ? `/api/img/${img.cacheKey}` : img.url;
}

export interface Job {
  id: string;
  url: string;
  language: string;
  status: JobStatus;
  renderMode: RenderMode;
  /** Human-readable reasons the result is incomplete; empty when fully successful. */
  degradationReasons: string[];
  brief: BrandBrief | null;
  colors: string[];
  images: ExtractedImage[];
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  createdAt: number;
}

export interface Ad {
  id: string;
  jobId: string;
  version: number;
  creativeConcept: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imageUrl: string | null;
  edited: boolean;
  updatedAt: number;
}

export interface JobResponse {
  job: Job;
  ads: Ad[];
}

// ---------- Request payloads (validated by server functions) ----------

/** Output-language choices. `name` is the English name used in the LLM prompt;
 *  null name = "auto" (match the site's own language). */
export const LANGUAGES = [
  { code: "auto", label: "Auto (match site)", name: null },
  { code: "en", label: "English", name: "English" },
  { code: "de", label: "Deutsch", name: "German" },
  { code: "es", label: "Español", name: "Spanish" },
  { code: "fr", label: "Français", name: "French" },
  { code: "it", label: "Italiano", name: "Italian" },
  { code: "pt", label: "Português", name: "Portuguese" },
  { code: "uk", label: "Українська", name: "Ukrainian" },
  { code: "ru", label: "Русский", name: "Russian" },
] as const;

export const CreateJobInput = z.object({
  url: z.string().url(),
  count: z.number().int().min(1).max(3).optional(),
  language: z.string().optional(),
});
export type CreateJobInput = z.infer<typeof CreateJobInput>;

export const UpdateAdInput = z.object({
  id: z.string(),
  version: z.number().int().nonnegative(),
  creativeConcept: z.string().max(300),
  primaryText: z.string().max(1200),
  headline: z.string().min(1).max(200),
  description: z.string().max(400),
  cta: z.string().min(1).max(80),
  imageUrl: z.string().nullable(),
});
export type UpdateAdInput = z.infer<typeof UpdateAdInput>;

export const RegenerateAdInput = z.object({
  id: z.string(),
  version: z.number().int().nonnegative(),
});
export type RegenerateAdInput = z.infer<typeof RegenerateAdInput>;
