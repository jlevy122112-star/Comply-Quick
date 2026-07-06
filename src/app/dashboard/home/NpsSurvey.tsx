"use client";

import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "cq_nps_dismissed_v1";

// Client-only read of the "already dismissed" flag. Server snapshot returns
// true (hidden) to avoid a hydration flash; the real value is read after mount.
const noopSubscribe = () => () => {};
function useDismissed(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.localStorage.getItem(STORAGE_KEY) === "1",
    () => true
  );
}

/**
 * Dismissible NPS prompt ([Up11]). Shows once per browser until answered or
 * dismissed (persisted in localStorage). Captures the acquisition channel from
 * the `cq_channel` cookie / ?utm_source for retention segmentation.
 */
export default function NpsSurvey() {
  const dismissed = useDismissed();
  const [closed, setClosed] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  function close(persist: boolean) {
    if (persist && typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "1");
    setClosed(true);
  }

  function readChannel(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const fromUtm = new URLSearchParams(window.location.search).get("utm_source");
    if (fromUtm) return fromUtm;
    const m = document.cookie.match(/(?:^|;\s*)cq_channel=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  async function submit() {
    if (score === null) return;
    setState("saving");
    try {
      const res = await fetch("/api/pmf/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment, channel: readChannel() }),
      });
      if (!res.ok) throw new Error();
      setState("done");
      close(true);
    } catch {
      setState("error");
    }
  }

  if (dismissed || closed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-2xl">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-white">How likely are you to recommend Comply-Quick?</p>
        <button onClick={() => close(true)} aria-label="Dismiss" className="text-gray-500 hover:text-gray-300">
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">0 = not likely, 10 = extremely likely</p>

      <div className="mt-3 grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            onClick={() => setScore(n)}
            className={`rounded py-1 text-xs font-medium transition-colors ${
              score === n ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {score !== null && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What's the main reason for your score? (optional)"
            rows={2}
            className="mt-3 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-white"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {state === "error" && <span className="text-xs text-red-400">Try again</span>}
            <button
              onClick={submit}
              disabled={state === "saving"}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {state === "saving" ? "Sending…" : "Submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
