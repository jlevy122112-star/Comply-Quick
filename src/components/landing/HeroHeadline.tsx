"use client";

import { useEffect, useState } from "react";

// Two hero variants for A/B testing. "speed" is the SSR/default (also what
// crawlers see); "scan" is shown to ~half of visitors client-side. The chosen
// variant is persisted per-visitor and reported to analytics so conversion can
// be attributed to the headline.
const VARIANTS = {
  speed: {
    headline: "Compliant in 60 seconds, not 6 weeks.",
    sub: (
      <>
        Comply-Quick scans your site&apos;s <span className="text-white font-medium">actual tech stack</span> and
        auto-generates every legal document you need &mdash; privacy policy, cookie disclosures, liability waivers, and
        a pre-launch checklist &mdash; before your coffee&apos;s cold.
      </>
    ),
  },
  scan: {
    headline: "We scan what you actually run \u2014 then write the law around it.",
    sub: (
      <>
        The only compliance platform that reads your <span className="text-white font-medium">live tech stack</span>{" "}
        &mdash; every tracker, pixel, and framework &mdash; and auto-drafts the exact policies, waivers, and checklist
        it demands. In under a minute.
      </>
    ),
  },
} as const;

type VariantKey = keyof typeof VARIANTS;

const STORAGE_KEY = "cq_hero_variant";

export function HeroHeadline() {
  // SSR + first client render use "speed" so hydration matches and crawlers
  // index the primary headline.
  const [variant, setVariant] = useState<VariantKey>("speed");

  useEffect(() => {
    // Defer out of the synchronous effect body so the assignment doesn't trigger
    // a cascading render, and so SSR/first paint keep the "speed" default.
    const id = window.setTimeout(() => {
      let chosen: VariantKey;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        chosen = stored === "scan" || stored === "speed" ? stored : Math.random() < 0.5 ? "speed" : "scan";
        window.localStorage.setItem(STORAGE_KEY, chosen);
      } catch {
        chosen = Math.random() < 0.5 ? "speed" : "scan";
      }
      setVariant(chosen);

      // Report the assignment to whichever analytics are configured.
      const w = window as typeof window & {
        gtag?: (...args: unknown[]) => void;
        clarity?: (...args: unknown[]) => void;
      };
      w.gtag?.("event", "hero_variant_view", { variant: chosen });
      w.clarity?.("set", "hero_variant", chosen);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const { headline, sub } = VARIANTS[variant];
  return (
    <>
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
        {headline}
      </h1>
      <p className="mt-6 text-base sm:text-lg md:text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">{sub}</p>
    </>
  );
}
