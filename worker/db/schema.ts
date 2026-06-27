import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { BrandBrief, ExtractedImage, JobStatus, RenderMode } from "../../shared/types.ts";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").$type<JobStatus>().notNull(),
  renderMode: text("render_mode").$type<RenderMode>().notNull(),
  language: text("language").notNull().default("auto"),
  degradationReasons: text("degradation_reasons", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  brief: text("brief", { mode: "json" }).$type<BrandBrief | null>(),
  colors: text("colors", { mode: "json" }).$type<string[]>().notNull().default([]),
  images: text("images", { mode: "json" }).$type<ExtractedImage[]>().notNull().default([]),
  costUsd: real("cost_usd").notNull().default(0),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const ads = sqliteTable("ads", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  version: integer("version").notNull().default(0),
  creativeConcept: text("creative_concept").notNull().default(""),
  primaryText: text("primary_text").notNull().default(""),
  headline: text("headline").notNull(),
  description: text("description").notNull().default(""),
  cta: text("cta").notNull(),
  imageUrl: text("image_url"),
  edited: integer("edited", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
});

export type JobRow = typeof jobs.$inferSelect;
export type AdRow = typeof ads.$inferSelect;
