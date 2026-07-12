"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Badge, Button, Card, CardBody } from "@/components/ui";
import type { AssistantMessage } from "@/lib/assistant/service";

const SUGGESTIONS = [
  "Do I need a cookie banner for a US-only store?",
  "What's the difference between a DPA and a privacy policy?",
  "Which jurisdictions require opt-in consent?",
  "What should I do first to make my site compliant?",
];

interface AssistantViewProps {
  tier: string;
  projectCount: number;
  frameworks: string[];
}

export default function AssistantView({ tier, projectCount, frameworks }: AssistantViewProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<AssistantMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading) return;
      setError(null);
      const next: AssistantMessage[] = [...messagesRef.current, { role: "user", content }];
      setMessages(next);
      setInput("");
      setLoading(true);
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, context: { tier, projectCount, frameworks } }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message ?? data.error ?? "The assistant is unavailable right now.");
        }
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [loading, tier, projectCount, frameworks]
  );

  return (
    <Card className="flex h-[70vh] flex-col">
      <CardBody className="flex min-h-0 flex-1 flex-col gap-4">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="text-4xl">💬</span>
              <p className="mt-4 max-w-md text-sm text-gray-400">
                Ask about GDPR, CCPA, DPAs, cookie consent, subprocessors — or what to do next. I&apos;ll point you to
                the right tool.
              </p>
              <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-left text-xs text-gray-300 transition-colors hover:border-indigo-500/50 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-indigo-600 text-white" : "border border-gray-800 bg-gray-900 text-gray-200"
                }`}
              >
                {m.role === "assistant" && (
                  <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-indigo-300">
                    <Badge tone="indigo">Assistant</Badge>
                  </span>
                )}
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2 border-t border-gray-800 pt-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ask a compliance question…"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <Button type="submit" size="lg" loading={loading} disabled={!input.trim()}>
            Send
          </Button>
        </form>
        <p className="text-center text-[11px] text-gray-600">
          Comply-Quick provides compliance tooling, not legal advice. Verify consequential decisions with counsel.
        </p>
      </CardBody>
    </Card>
  );
}
