
import Anthropic from "@anthropic-ai/sdk";
import type { Budget } from "../lib/budget.ts";

export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export class RefusalError extends Error {}

interface StructuredCall {
  model: string;

  system: string;

  cachedContext?: string;

  user: string;
  schema: unknown;
  maxTokens: number;
}

export async function callStructured(
  client: Anthropic,
  budget: Budget,
  call: StructuredCall,
): Promise<unknown> {
  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: call.system }];
  if (call.cachedContext) {
    system.push({
      type: "text",
      text: call.cachedContext,
      cache_control: { type: "ephemeral" },
    });
  } else {

    system[0].cache_control = { type: "ephemeral" };
  }

  const params = {
    model: call.model,
    max_tokens: call.maxTokens,
    system,
    messages: [{ role: "user", content: call.user }],
    output_config: { format: { type: "json_schema", schema: call.schema } },
  };

  const res = (await budget.race(
    client.messages.create(params as any),
    `LLM ${call.model}`,
  )) as Anthropic.Message;

  budget.record(call.model, res.usage);

  if (res.stop_reason === "refusal") {
    throw new RefusalError("The model declined to generate output for this content.");
  }

  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error("Empty model response.");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Model returned non-JSON output.");
  }
}
