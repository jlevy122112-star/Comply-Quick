// OpenAI implementation of AiClient using the official `openai` SDK.
//
// Using the SDK (rather than raw fetch) lets Sentry's `openAIIntegration`
// auto-instrument every call — capturing model, latency, and token usage —
// so subscriber-facing AI interactions show up in Sentry's AI monitoring view.

import OpenAI from "openai";
import type { AiClient, AiCompletionParams } from "./types";
import { ServiceUnavailableError, InternalError } from "../errors";

const DEFAULT_MODEL = "gpt-4.1";

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
        throw new InternalError(`OpenAI error ${status}: ${String(err.message).slice(0, 200)}`);
      }
      throw new ServiceUnavailableError("OpenAI request failed to send.");
    }

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new InternalError("OpenAI returned an empty completion.");
    return content;
  }
}
