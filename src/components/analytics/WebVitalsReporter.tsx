"use client";

import { useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { trackClientEvent } from "@/lib/funnel/client";
import { isSpeedOptimizationEnabled } from "@/lib/optimizations/flags";

const BUDGETS: Record<string, number> = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
  TTFB: 800,
  FCP: 1800,
};

/**
 * Ships field web-vitals to the analytics endpoint. Sampled by page lifecycle
 * and deduped by metric id so it can run safely in strict-mode re-renders.
 */
export function WebVitalsReporter() {
  const seen = useRef(new Set<string>());

  useReportWebVitals((metric) => {
    if (!isSpeedOptimizationEnabled()) return;
    if (seen.current.has(metric.id)) return;
    seen.current.add(metric.id);

    const budget = BUDGETS[metric.name];
    const pass = budget == null ? null : metric.value <= budget;
    const value = metric.name === "CLS" ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value * 100) / 100;

    trackClientEvent("web_vital_reported", {
      metric: metric.name,
      value,
      rating: metric.rating,
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      budget,
      pass,
      navigationType: metric.navigationType ?? null,
    });
    if (pass === false) {
      trackClientEvent("web_vital_budget_failed", {
        metric: metric.name,
        value,
        budget,
        route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      });
    }
  });

  return null;
}
