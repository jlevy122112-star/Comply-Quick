// OpenAI implementation of AiClient (Chat Completions via fetch — no SDK dep).

import type { AiClient, AiCompletionParams } from "./types";
import { ServiceUnavailableError, InternalError } from "../errors";

const DEFAULT_MODEL = "gpt-4.1";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface ChatChoice {
  message?: { content?: string | null };
}
interface ChatResponse {
  choices?: ChatChoice[];
}

export class OpenAiClient implements AiClient {
  readonly id: string;
  readonly live = true;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.OPENAI_MODEL || DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
    this.id = `openai:${model}`;
  }

  async complete(params: AiCompletionParams): Promise<string> {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (params.system) messages.push({ role: "system", content: params.system });
    messages.push({ role: "user", content: params.prompt });

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: params.temperature ?? 0.2,
          ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
        }),
      });
    } catch {
      throw new ServiceUnavailableError("OpenAI request failed to send.");
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429 || res.status >= 500) {
        throw new ServiceUnavailableError(`OpenAI unavailable (${res.status}).`);
      }
      throw new InternalError(`OpenAI error ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = (await res.json()) as ChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new InternalError("OpenAI returned an empty completion.");
    return content;
  }
}
