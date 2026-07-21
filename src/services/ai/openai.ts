// OpenAI implementation of AiClient using the official `openai` SDK.
//
// Using the SDK (rather than raw fetch) lets Sentry's `openAIIntegration`
// auto-instrument every call — capturing model, latency, and token usage —
// so subscriber-facing AI interactions show up in Sentry's AI monitoring view.

import OpenAI from "openai";
import type { AiClient, AiCompletionParams } from "./types";
import { ServiceUnavailableError, InternalError } from "../errors";

// Nano is the most cost-effective model (~20x cheaper than gpt-4.1) and is
// well-suited to our short, structured summaries (output capped at 220 tokens;
// the hard compliance logic is done by the rule-based engine, not the model).
// Override per-deployment with OPENAI_MODEL.
const DEFAULT_MODEL = "gpt-4.1-nano";

export class OpenAiClient implements AiClient {
  readonly id: string;
  readonly live = true;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.OPENAI_MODEL || DEFAULT_MODEL) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.id = `openai:${model}`;
  }

  async complete(params: AiCompletionParams): Promise<string> {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (params.system) messages.push({ role: "system", content: params.system });
    messages.push({ role: "user", content: params.prompt });

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: params.temperature ?? 0.2,
        ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
      });
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        const status = err.status ?? 0;
        if (status === 429 || status >= 500) {
          throw new ServiceUnavailableError(`OpenAI unavailable (${status || "network"}).`);
        }
        throw new InternalError(`OpenAI error ${status}: ${err.code || err.type || "unknown"}`);
      }
      throw new ServiceUnavailableError("OpenAI request failed to send.");
    }

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new InternalError("OpenAI returned an empty completion.");
    return content;
  }
}
