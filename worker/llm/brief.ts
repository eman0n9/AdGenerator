import type Anthropic from "@anthropic-ai/sdk";
import type { Budget } from "../lib/budget.ts";
import type { ExtractedContent } from "../pipeline/extract.ts";
import { BrandBriefSchema, type BrandBrief } from "../../shared/types.ts";
import { callStructured } from "./client.ts";
import { BRIEF_SCHEMA, BRIEF_SYSTEM, buildBriefUser } from "./schemas.ts";

const MODEL = "claude-haiku-4-5";

export async function generateBrief(
  client: Anthropic,
  budget: Budget,
  content: ExtractedContent,
  url: string,
  langInstruction: string,
): Promise<BrandBrief> {
  const raw = await callStructured(client, budget, {
    model: MODEL,
    system: BRIEF_SYSTEM + " " + langInstruction,
    user: buildBriefUser(content, url),
    schema: BRIEF_SCHEMA,
    maxTokens: 1500,
  });
  return BrandBriefSchema.parse(raw);
}
