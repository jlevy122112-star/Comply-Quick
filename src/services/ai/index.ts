// AI service factory + keyless fallback.

import type { AiClient, AiCompletionParams } from "./types";
import { OpenAiClient } from "./openai";

export type { AiClient, AiCompletionParams } from "./types";
export { OpenAiClient } from "./openai";

/**
 * Deterministic, network-free client used when OPENAI_API_KEY is absent (local
 * dev, CI, tests). It echoes a clearly-labeled placeholder so callers never
 * crash and it is obvious the output is not model-generated.
 */
export class DeterministicAiClient implements AiClient {
  readonly id = "deterministic";
  readonly live = false;
  async complete(params: AiCompletionParams): Promise<string> {
    return `[AI unavailable — no OPENAI_API_KEY configured]\n${params.prompt.slice(0, 500)}`;
  }
}

let cached: AiClient | undefined;

/** Returns a memoized AiClient: OpenAI when keyed, deterministic fallback otherwise. */
export function getAiClient(): AiClient {
  if (cached) return cached;
  const key = process.env.OPENAI_API_KEY;
  cached = key ? new OpenAiClient(key) : new DeterministicAiClient();
  return cached;
}

/** Test-only: clears the memoized client so env/injection changes take effect. */
export function resetAiClientForTests(client?: AiClient): void {
  cached = client;
}
