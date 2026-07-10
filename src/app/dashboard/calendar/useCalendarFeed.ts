"use client";

import { useState } from "react";

/**
 * One-way ICS calendar-linking state: subscription URLs, copy-to-clipboard, and
 * rotating (resetting) the feed token. Failures are surfaced via `onError`.
 */
export function useCalendarFeed(feedToken: string, onError: (msg: string) => void) {
  const [showLink, setShowLink] = useState(false);
  const [token, setToken] = useState(feedToken);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const feedPath = `/api/calendar/feed/${token}.ics`;
  const feedUrl = origin ? `${origin}${feedPath}` : feedPath;
  const webcalUrl = origin ? feedUrl.replace(/^https?:\/\//, "webcal://") : feedPath;
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent(
    "Comply-Quick Compliance"
  )}`;

  async function copyFeedUrl() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError("Could not copy the URL — select and copy it manually.");
    }
  }

  async function rotateFeed() {
    setBusy(true);
    try {
      const res = await fetch("/api/calendar/feed", { method: "POST" });
      if (!res.ok) throw new Error("Could not rotate the feed URL.");
      const data = await res.json();
      setToken(data.feed.token);
      setCopied(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not rotate the feed URL.");
    } finally {
      setBusy(false);
    }
  }

  return {
    showLink,
    setShowLink,
    copied,
    busy,
    feedUrl,
    webcalUrl,
    googleUrl,
    outlookUrl,
    copyFeedUrl,
    rotateFeed,
  };
}
