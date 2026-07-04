// Provider-agnostic AI interface for the Compliance OS.
//
// Feature modules (Autopilot, Scanner, Assistant) depend only on `AiClient`, so
// the concrete provider (OpenAI today) can change without touching call sites,
// and tests can inject a deterministic client with no network or API key.

export interface AiCompletionParams {
  /** System / role instructions. */
  system?: string;
  /** User prompt. */
  prompt: string;
  /** Upper bound on generated tokens. */
  maxTokens?: number;
  /** 0 = deterministic, higher = more varied. Defaults low for legal text. */
  temperature?: number;
}

export interface AiClient {
  /** Human-readable provider/model id, e.g. "openai:gpt-4.1" or "deterministic". */
  readonly id: string;
  /** Whether real model calls are available (false for the keyless fallback). */
  readonly live: boolean;
  complete(params: AiCompletionParams): Promise<string>;
}
