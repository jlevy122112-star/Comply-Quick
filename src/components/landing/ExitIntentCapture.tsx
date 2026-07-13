"use client";

import { useEffect, useState } from "react";
import { LeadCaptureForm } from "./LeadCaptureForm";

const STORAGE_KEY = "cq_exit_intent_seen";

// One-time exit-intent offer: when the cursor leaves toward the top of the
// viewport (desktop) or after a deep scroll (mobile proxy), surface a checklist
// offer to recover a bounce. Shown at most once per visitor.
export function ExitIntentCapture() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* storage blocked — still allow one show this session */
    }

    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      setOpen(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      cleanup();
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      if (scrolled > document.body.scrollHeight * 0.6) trigger();
    };
    function cleanup() {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    }

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-200 transition-colors"
        >
          &#x2715;
        </button>
        <h2 id="exit-intent-title" className="text-xl font-bold text-white">
          Before You Go &mdash; Grab Your Free Compliance Checklist.
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          The Exact Steps To Get GDPR, CCPA, And Cookie-Consent Ready &mdash; Plus A Free Scan Of Your Site. No Card
          Required.
        </p>
        <div className="mt-5">
          <LeadCaptureForm source="exit_intent" claimFreeScan />
        </div>
      </div>
    </div>
  );
}
