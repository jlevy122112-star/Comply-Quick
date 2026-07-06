// Live check: real OpenAI call auto-instrumented by Sentry's openAIIntegration.
// Mirrors sentry.server.config.ts (metadata-only: no prompt/output capture).
// Usage: node scripts/verify-sentry-ai.mjs   (needs SENTRY_DSN + OPENAI_API_KEY)

// The Next.js server runtime resolves @sentry/nextjs to its Node build (which
// re-exports openAIIntegration); for this standalone ESM verifier we load the
// underlying @sentry/node, which is what runs on the server anyway.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (!dsn) throw new Error("SENTRY_DSN not set");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

const events = [];
Sentry.init({
  dsn,
  enabled: true,
  environment: "verification",
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
  integrations: [Sentry.openAIIntegration({ recordInputs: false, recordOutputs: false })],
  beforeSendTransaction(event) {
    const spans = event.spans ?? [];
    const gen = spans.filter((s) => (s.op ?? "").startsWith("gen_ai"));
    events.push({
      tx: event.transaction,
      genAiSpans: gen.map((s) => ({ op: s.op, desc: s.description, data: s.data })),
    });
    return event;
  },
});

// Import AFTER init so the OTEL hook can patch the module (ESM ordering).
const { default: OpenAI } = await import("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-4.1";

await Sentry.startSpan({ name: "verify-openai-ai-monitoring", op: "test" }, async () => {
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with exactly one word: pong" }],
      max_tokens: 5,
      temperature: 0,
    });
    console.log("OpenAI reply:", JSON.stringify(res.choices?.[0]?.message?.content));
    console.log("usage:", JSON.stringify(res.usage));
  } catch (err) {
    console.log("OpenAI call errored:", err?.status, err?.code, "-", err?.error?.message);
  }
});

await Sentry.flush(8000);
console.log("captured transactions:", JSON.stringify(events, null, 2));
