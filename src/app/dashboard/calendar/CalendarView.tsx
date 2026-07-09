"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bucketByDay, parseDay, toDayKey, type CalendarEvent, type CalendarCategory } from "@/lib/calendar/events";
import { UpsellCta } from "@/components/ui";
import type { Tier } from "@/lib/pricing";

interface CalendarMonthData {
  year: number;
  month: number;
  monthStart: string;
  gridStart: string;
  gridEnd: string;
  events: CalendarEvent[];
}

interface ClientOption {
  id: string;
  name: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_STYLE: Record<CalendarCategory, { label: string; dot: string; chip: string }> = {
  task: { label: "Task", dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  renewal: { label: "Renewal", dot: "bg-violet-400", chip: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  scan: { label: "Scan", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  risk: { label: "Risk alert", dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  regulation: { label: "Regulation", dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

function monthParam(dayKey: string, delta: number): string {
  const d = parseDay(dayKey);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function gridDays(gridStart: string, gridEnd: string): string[] {
  const days: string[] = [];
  let cursor = gridStart;
  while (cursor < gridEnd) {
    days.push(cursor);
    const d = parseDay(cursor);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = toDayKey(d);
  }
  return days;
}

export default function CalendarView({
  month,
  clients,
  activeClientId,
  feedToken,
  tier,
}: {
  month: CalendarMonthData;
  clients: ClientOption[];
  activeClientId: string | null;
  feedToken: string;
  tier: Tier;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(month.monthStart);
  const [category, setCategory] = useState<CalendarCategory>("task");

  // ── One-way calendar linking (ICS subscription) ──
  const [showLink, setShowLink] = useState(false);
  const [token, setToken] = useState(feedToken);
  // Resolved lazily on the client; the link panel that renders it only appears
  // after hydration (showLink defaults false), so there is no SSR mismatch.
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [copied, setCopied] = useState(false);

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
      setError("Could not copy the URL — select and copy it manually.");
    }
  }

  async function rotateFeed() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/feed", { method: "POST" });
      if (!res.ok) throw new Error("Could not rotate the feed URL.");
      const data = await res.json();
      setToken(data.feed.token);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rotate the feed URL.");
    } finally {
      setBusy(false);
    }
  }

  const buckets = useMemo(() => bucketByDay(month.events), [month.events]);
  const days = useMemo(() => gridDays(month.gridStart, month.gridEnd), [month.gridStart, month.gridEnd]);
  const today = toDayKey(new Date());

  const clientQuery = activeClientId ? `&client=${activeClientId}` : "";
  const prevHref = `/dashboard/calendar?month=${monthParam(month.monthStart, -1)}${clientQuery}`;
  const nextHref = `/dashboard/calendar?month=${monthParam(month.monthStart, 1)}${clientQuery}`;

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("A task title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate,
          category,
          agencyClientId: activeClientId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not create the task.");
      }
      setTitle("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task.");
    } finally {
      setBusy(false);
    }
  }

  async function mutateTask(id: string, action: "done" | "delete") {
    setBusy(true);
    setError(null);
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/calendar/tasks/${id}`, { method: "DELETE" })
          : await fetch(`/api/calendar/tasks/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "done" }),
            });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not update the task.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the task.");
    } finally {
      setBusy(false);
    }
  }

  const upcoming = useMemo(
    () =>
      [...month.events]
        .filter((e) => e.date >= today && e.status !== "done")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [month.events, today]
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance Calendar</h1>
          <p className="text-sm text-gray-400 mt-1">
            Tasks, renewals, scan schedules, and regulation alerts in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:border-gray-500 hover:text-white transition-colors"
            aria-label="Previous month"
          >
            &larr;
          </Link>
          <span className="text-white font-medium min-w-[9rem] text-center">
            {MONTH_NAMES[month.month]} {month.year}
          </span>
          <Link
            href={nextHref}
            className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:border-gray-500 hover:text-white transition-colors"
            aria-label="Next month"
          >
            &rarr;
          </Link>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="ml-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 transition-colors"
          >
            + Add task
          </button>
          <button
            type="button"
            onClick={() => setShowLink((v) => !v)}
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm font-medium hover:border-gray-500 hover:text-white transition-colors"
          >
            Link calendar
          </button>
        </div>
      </div>

      {tier !== "enterprise" && (
        <div className="mb-6">
          {tier === "agency" ? (
            <UpsellCta tier={tier} />
          ) : (
            <UpsellCta
              tier={tier}
              title="Turn the calendar into an autopilot"
              benefit="Upgrade for ongoing monitoring, auto-scheduled re-scans, and regulatory-change alerts that land on this calendar for you — instead of tracking renewals by hand."
            />
          )}
        </div>
      )}

      {showLink && (
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Link to your calendar</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-xl">
                Subscribe from Google, Outlook, or Apple Calendar to see your compliance deadlines, renewals, and scan
                dates alongside your other events. Updates flow one way (into your calendar) and refresh automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLink(false)}
              className="text-gray-500 hover:text-gray-300 text-sm"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 hover:border-sky-500 hover:text-white transition-colors"
            >
              Add to Google
            </a>
            <a
              href={outlookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 hover:border-sky-500 hover:text-white transition-colors"
            >
              Add to Outlook
            </a>
            <a
              href={webcalUrl}
              className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 hover:border-sky-500 hover:text-white transition-colors"
            >
              Add to Apple Calendar
            </a>
          </div>

          <div className="mt-4">
            <span className="block text-xs text-gray-400 mb-1">Subscription URL (ICS)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={feedUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-[16rem] rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-xs text-gray-300 font-mono focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={copyFeedUrl}
                className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={rotateFeed}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:border-red-500 hover:text-red-300 transition-colors disabled:opacity-50"
                title="Generate a new URL and disable the old one"
              >
                Reset URL
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Anyone with this link can view your calendar events. Reset it if it is ever exposed.
            </p>
          </div>
        </div>
      )}

      {clients.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs uppercase tracking-wide text-gray-500">Calendar for:</span>
          <Link
            href={`/dashboard/calendar?month=${month.year}-${String(month.month + 1).padStart(2, "0")}`}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              activeClientId
                ? "border-gray-700 text-gray-400 hover:text-white"
                : "border-sky-500/50 bg-sky-500/10 text-sky-300"
            }`}
          >
            My account
          </Link>
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/calendar?month=${month.year}-${String(month.month + 1).padStart(2, "0")}&client=${c.id}`}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                activeClientId === c.id
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                  : "border-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={createTask}
          className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex flex-wrap items-end gap-3"
        >
          <label className="flex-1 min-w-[12rem]">
            <span className="block text-xs text-gray-400 mb-1">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Renew cookie-consent audit"
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="block text-xs text-gray-400 mb-1">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="block text-xs text-gray-400 mb-1">Type</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CalendarCategory)}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="task">Task</option>
              <option value="renewal">Renewal</option>
              <option value="scan">Scan</option>
              <option value="risk">Risk alert</option>
              <option value="regulation">Regulation</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 transition-colors disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save task"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-6">
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-900/60 border-b border-gray-800">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = parseDay(day).getUTCMonth() === month.month;
              const dayEvents = buckets.get(day) ?? [];
              return (
                <div
                  key={day}
                  className={`min-h-[6.5rem] border-b border-r border-gray-800/60 p-1.5 ${
                    inMonth ? "bg-gray-950" : "bg-gray-900/30"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-xs ${
                        day === today
                          ? "bg-sky-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                          : inMonth
                            ? "text-gray-300"
                            : "text-gray-600"
                      }`}
                    >
                      {parseDay(day).getUTCDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        title={ev.description || ev.title}
                        className={`group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight border ${CATEGORY_STYLE[ev.category].chip} ${
                          ev.status === "done" ? "opacity-50 line-through" : ""
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CATEGORY_STYLE[ev.category].dot}`} />
                        <span className="truncate flex-1">{ev.title}</span>
                        {ev.editable && ev.status !== "done" && (
                          <button
                            type="button"
                            onClick={() => mutateTask(ev.id, "done")}
                            disabled={busy}
                            className="hidden group-hover:inline text-emerald-300 hover:text-emerald-200"
                            title="Mark done"
                          >
                            ✓
                          </button>
                        )}
                        {ev.editable && (
                          <button
                            type="button"
                            onClick={() => mutateTask(ev.id, "delete")}
                            disabled={busy}
                            className="hidden group-hover:inline text-red-300 hover:text-red-200"
                            title="Delete"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing scheduled this month.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${CATEGORY_STYLE[ev.category].dot}`} />
                    <div className="min-w-0">
                      <div className="text-gray-200 truncate">{ev.title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(ev.date + "T00:00:00Z").toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                        {" · "}
                        {CATEGORY_STYLE[ev.category].label}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Legend</h2>
            <ul className="space-y-2">
              {(Object.keys(CATEGORY_STYLE) as CalendarCategory[]).map((cat) => (
                <li key={cat} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_STYLE[cat].dot}`} />
                  {CATEGORY_STYLE[cat].label}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
