import { eq, asc } from "drizzle-orm";
import type { DB } from "./index.ts";
import { jobs, ads, type JobRow, type AdRow } from "./schema.ts";
import type { Ad, Job, JobResponse } from "../../shared/types.ts";

export function rowToJob(r: JobRow): Job {
  return {
    id: r.id,
    url: r.url,
    language: r.language,
    status: r.status,
    renderMode: r.renderMode,
    degradationReasons: r.degradationReasons ?? [],
    brief: r.brief ?? null,
    colors: r.colors ?? [],
    images: r.images ?? [],
    costUsd: r.costUsd,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    durationMs: r.durationMs,
    createdAt: r.createdAt,
  };
}

export function rowToAd(r: AdRow): Ad {
  return {
    id: r.id,
    jobId: r.jobId,
    version: r.version,
    creativeConcept: r.creativeConcept,
    primaryText: r.primaryText,
    headline: r.headline,
    description: r.description,
    cta: r.cta,
    imageUrl: r.imageUrl ?? null,
    edited: r.edited,
    updatedAt: r.updatedAt,
  };
}

export async function getJobResponse(d: DB, jobId: string): Promise<JobResponse | null> {
  const jobRows = await d.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  const job = jobRows[0];
  if (!job) return null;
  const adRows = await d.select().from(ads).where(eq(ads.jobId, jobId)).orderBy(asc(ads.id));
  return { job: rowToJob(job), ads: adRows.map(rowToAd) };
}

export async function getAd(d: DB, adId: string): Promise<AdRow | null> {
  const rows = await d.select().from(ads).where(eq(ads.id, adId)).limit(1);
  return rows[0] ?? null;
}

export async function getJobRow(d: DB, jobId: string): Promise<JobRow | null> {
  const rows = await d.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}
