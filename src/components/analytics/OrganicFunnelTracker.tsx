"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";

const ORGANIC_SEARCH_HOSTS = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.",
  "ecosia.org",
  "brave.com",
  "yandex.",
];

function acquisitionChannel(): "organic" | "direct" | "referral" {
  const source = new URLSearchParams(window.location.search).get("utm_source");
  if (source) return source.toLowerCase() === "organic" ? "organic" : "referral";
  if (!document.referrer) return "direct";

  try {
    const referrerHost = new URL(document.referrer).hostname.toLowerCase();
    return ORGANIC_SEARCH_HOSTS.some((host) => referrerHost.includes(host)) ? "organic" : "referral";
  } catch {
    return "referral";
  }
}

/** Records privacy-safe acquisition signals for the public marketing surface. */
export function OrganicFunnelTracker() {
  useEffect(() => {
    const channel = acquisitionChannel();
    if (channel === "organic") track("organic_landing", { path: window.location.pathname, channel });
  }, []);

  return null;
}

export function trackFreeScanStarted(source: "landing" | "blog" | "comparison", campaign: string): void {
  track("free_scan_started", { source, campaign });
}

export function TrackedFreeScanLink({
  href,
  source,
  campaign,
  className,
  children,
}: {
  href: string;
  source: "landing" | "blog" | "comparison";
  campaign: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} onClick={() => trackFreeScanStarted(source, campaign)} className={className}>
      {children}
    </Link>
  );
}
