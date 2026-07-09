"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bucketByDay, parseDay, toDayKey, type CalendarEvent, type CalendarCategory } from "@/lib/calendar/events";
import { summarizeEvents, heatLevel, nextAction } from "@/lib/calendar/insights";
import { UpsellCta, ScoreRing } from "@/components/ui";
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

type ViewMode = "month" | "week" | "agenda";

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

// Deadline-heat tint applied to a day cell's background (level 0–3).
const HEAT_BG = ["", "bg-sky-500/[0.04]", "bg-amber-500/[0.06]", "bg-rose-500/[0.08]"] as const;
const HEAT_EDGE = [
  "",
  "",
  "shadow-[inset_2px_0_0_0_rgba(245,158,11,0.5)]",
  "shadow-[inset_2px_0_0_0_rgba(244,63,94,0.6)]",
] as const;

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

/** Sunday-first week of 7 day keys containing `anchor`. */
function weekDays(anchor: string): string[] {
  const d = parseDay(anchor);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const start = toDayKey(d);
  return Array.from({ length: 7 }, (_, i) => {
    const c = parseDay(start);
    c.setUTCDate(c.getUTCDate() + i);
    return toDayKey(c);
  });
}

function longDate(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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
  const [view, setView] = useState<ViewMode>("month");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(month.monthStart);
  const [category, setCategory] = useState<CalendarCategory>("task");

  const today = toDayKey(new Date());
  const todayInMonth = today >= month.gridStart && today < month.gridEnd;
  const [selectedDay, setSelectedDay] = useState<string>(todayInMonth ? today : month.monthStart);

  // ── One-way calendar linking (ICS subscription) ──
  const [showLink, setShowLink] = useState(false);
  const [token, setToken] = useState(feedToken);
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
  const summary = useMemo(() => summarizeEvents(month.events, today), [month.events, today]);
  const guide = useMemo(() => nextAction(month.events, today), [month.events, today]);

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
        body: JSON.stringify({ title: title.trim(), dueDate, category, agencyClientId: activeClientId }),
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

  function openAddFor(dayKey: string) {
    setDueDate(dayKey);
    setShowForm(true);
    setError(null);
  }

  const upcoming = useMemo(
    () =>
      [...month.events]
        .filter((e) => e.date >= today && e.status !== "done" && e.status !== "dismissed")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [month.events, today]
  );

  const selectedEvents = buckets.get(selectedDay) ?? [];
  const agenda = useMemo(
    () =>
      [...month.events]
        .filter((e) => e.status !== "done" && e.status !== "dismissed")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [month.events]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance Calendar</h1>
          <p className="mt-1 text-sm text-gray-400">
            Your compliance command center — deadlines, renewals, scans, and regulatory changes, on autopilot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-800 bg-gray-900/60 p-0.5">
            {(["month", "week", "agenda"] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setView(m)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  view === m ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Link
            href={prevHref}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
            aria-label="Previous month"
          >
            &larr;
          </Link>
          <span className="min-w-[9rem] text-center font-medium text-white">
            {MONTH_NAMES[month.month]} {month.year}
          </span>
          <Link
            href={nextHref}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
            aria-label="Next month"
          >
            &rarr;
          </Link>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="ml-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
          >
            + Add task
          </button>
          <button
            type="button"
            onClick={() => setShowLink((v) => !v)}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          >
            Link calendar
          </button>
        </div>
      </div>

      {/* ── KPI band ───────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <ScoreRing score={summary.onTrack} size="sm" label="on track" />
          <div>
            <div className="text-sm font-semibold text-white">Compliance health</div>
            <div className="text-xs text-gray-400">
              {summary.overdue > 0 ? `${summary.overdue} overdue drag score` : "No overdue items"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <ScoreRing score={summary.completionRate} size="sm" label="done" />
          <div>
            <div className="text-sm font-semibold text-white">Completion</div>
            <div className="text-xs text-gray-400">
              {summary.completed} done · {summary.total - summary.completed} open
            </div>
          </div>
        </div>
        <StatCard
          value={summary.overdue}
          label="Overdue"
          tone={summary.overdue > 0 ? "rose" : "emerald"}
          hint={summary.overdue > 0 ? "Needs attention now" : "All clear"}
        />
        <StatCard
          value={summary.next7}
          label="Due next 7 days"
          tone={summary.next7 > 0 ? "amber" : "emerald"}
          hint={summary.dueToday > 0 ? `${summary.dueToday} due today` : "Plan ahead"}
        />
      </div>

      {/* ── Guided next action ─────────────────────────────────────────── */}
      {guide && (
        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
            guide.overdue ? "border-rose-500/40 bg-rose-500/[0.06]" : "border-sky-500/40 bg-sky-500/[0.06]"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_STYLE[guide.event.category].dot}`} />
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {guide.overdue
                  ? `Overdue by ${Math.abs(guide.daysUntil)} day${Math.abs(guide.daysUntil) === 1 ? "" : "s"}`
                  : guide.daysUntil === 0
                    ? "Due today"
                    : `Due in ${guide.daysUntil} day${guide.daysUntil === 1 ? "" : "s"}`}
                {" · Next best action"}
              </div>
              <div className="truncate text-sm font-semibold text-white">{guide.event.title}</div>
              {guide.event.description && (
                <div className="mt-0.5 truncate text-xs text-gray-400">{guide.event.description}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {guide.event.href && (
              <Link
                href={guide.event.href}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
              >
                Open
              </Link>
            )}
            {guide.event.editable && (
              <button
                type="button"
                onClick={() => mutateTask(guide.event.id, "done")}
                disabled={busy}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                Mark done
              </button>
            )}
          </div>
        </div>
      )}

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
              <p className="mt-1 max-w-xl text-xs text-gray-400">
                Subscribe from Google, Outlook, or Apple Calendar to see your compliance deadlines, renewals, and scan
                dates alongside your other events. Updates flow one way (into your calendar) and refresh automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLink(false)}
              className="text-sm text-gray-500 hover:text-gray-300"
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
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
            >
              Add to Google
            </a>
            <a
              href={outlookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
            >
              Add to Outlook
            </a>
            <a
              href={webcalUrl}
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
            >
              Add to Apple Calendar
            </a>
          </div>

          <div className="mt-4">
            <span className="mb-1 block text-xs text-gray-400">Subscription URL (ICS)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={feedUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-[16rem] flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-300 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={copyFeedUrl}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={rotateFeed}
                disabled={busy}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50"
                title="Generate a new URL and disable the old one"
              >
                Reset URL
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Anyone with this link can view your calendar events. Reset it if it is ever exposed.
            </p>
          </div>
        </div>
      )}

      {clients.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-gray-500">Calendar for:</span>
          <Link
            href={`/dashboard/calendar?month=${month.year}-${String(month.month + 1).padStart(2, "0")}`}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
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
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
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
          className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4"
        >
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs text-gray-400">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Renew cookie-consent audit"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-gray-400">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-gray-400">Type</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CalendarCategory)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
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
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save task"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
        <div className="min-w-0">
          {view === "month" && (
            <div className="overflow-hidden rounded-xl border border-gray-800">
              <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-900/60">
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
                  const level = heatLevel(dayEvents);
                  const isToday = day === today;
                  const isSelected = day === selectedDay;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-[6.5rem] border-b border-r border-gray-800/60 p-1.5 text-left transition-colors ${
                        inMonth ? "bg-gray-950" : "bg-gray-900/30"
                      } ${HEAT_BG[level]} ${HEAT_EDGE[level]} ${
                        isSelected ? "ring-1 ring-inset ring-sky-500/60" : "hover:bg-gray-900/60"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`flex h-5 w-5 items-center justify-center text-xs ${
                            isToday
                              ? "rounded-full bg-sky-500 font-semibold text-white"
                              : inMonth
                                ? "text-gray-300"
                                : "text-gray-600"
                          }`}
                        >
                          {parseDay(day).getUTCDate()}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] tabular-nums text-gray-500">{dayEvents.length}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <EventChip key={ev.id} ev={ev} busy={busy} onMutate={mutateTask} />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="block px-1 text-[10px] text-gray-500">+{dayEvents.length - 3} more</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="overflow-hidden rounded-xl border border-gray-800">
              <div className="grid grid-cols-7">
                {weekDays(selectedDay).map((day) => {
                  const dayEvents = buckets.get(day) ?? [];
                  const isToday = day === today;
                  return (
                    <div key={day} className="min-h-[16rem] border-b border-r border-gray-800/60 bg-gray-950 p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] uppercase text-gray-500">
                          {WEEKDAYS[parseDay(day).getUTCDay()]}
                        </span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center text-xs ${
                            isToday ? "rounded-full bg-sky-500 font-semibold text-white" : "text-gray-300"
                          }`}
                        >
                          {parseDay(day).getUTCDate()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => openAddFor(day)}
                            className="w-full rounded border border-dashed border-gray-800 py-2 text-[11px] text-gray-600 hover:border-gray-600 hover:text-gray-400"
                          >
                            + Add
                          </button>
                        ) : (
                          dayEvents.map((ev) => <EventChip key={ev.id} ev={ev} busy={busy} onMutate={mutateTask} />)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "agenda" && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-2">
              {agenda.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">
                  Nothing scheduled this month. You&apos;re all caught up.
                </p>
              ) : (
                <ul className="divide-y divide-gray-800/70">
                  {agenda.map((ev) => {
                    const overdue = ev.date < today;
                    return (
                      <li key={ev.id} className="flex items-center gap-3 px-3 py-3">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
                        <div className="w-24 shrink-0 text-xs">
                          <span className={overdue ? "font-medium text-rose-300" : "text-gray-400"}>
                            {longDate(ev.date)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-white">{ev.title}</div>
                          <div className="text-xs text-gray-500">{CATEGORY_STYLE[ev.category].label}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {ev.href && (
                            <Link href={ev.href} className="text-xs text-sky-400 hover:text-sky-300">
                              Open
                            </Link>
                          )}
                          {ev.editable && (
                            <button
                              type="button"
                              onClick={() => mutateTask(ev.id, "done")}
                              disabled={busy}
                              className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                            >
                              Done
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{longDate(selectedDay)}</h2>
              <button
                type="button"
                onClick={() => openAddFor(selectedDay)}
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                + Add
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No events on this day.</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-gray-200">{ev.title}</div>
                      <div className="text-xs text-gray-500">{CATEGORY_STYLE[ev.category].label}</div>
                    </div>
                    {ev.editable && ev.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => mutateTask(ev.id, "done")}
                        disabled={busy}
                        className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                      >
                        ✓
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing scheduled this month.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
                    <div className="min-w-0">
                      <div className="truncate text-gray-200">{ev.title}</div>
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
            <h2 className="mb-3 text-sm font-semibold text-white">Legend</h2>
            <ul className="space-y-2">
              {(Object.keys(CATEGORY_STYLE) as CalendarCategory[]).map((cat) => (
                <li key={cat} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_STYLE[cat].dot}`} />
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

function StatCard({
  value,
  label,
  tone,
  hint,
}: {
  value: number;
  label: string;
  tone: "rose" | "amber" | "emerald";
  hint: string;
}) {
  const toneText = { rose: "text-rose-400", amber: "text-amber-400", emerald: "text-emerald-400" }[tone];
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
      <div className={`text-3xl font-bold tabular-nums ${toneText}`}>{value}</div>
      <div className="mt-1 text-sm font-semibold text-white">{label}</div>
      <div className="text-xs text-gray-400">{hint}</div>
    </div>
  );
}

function EventChip({
  ev,
  busy,
  onMutate,
}: {
  ev: CalendarEvent;
  busy: boolean;
  onMutate: (id: string, action: "done" | "delete") => void;
}) {
  return (
    <div
      title={ev.description || ev.title}
      className={`group flex items-center gap-1 rounded border px-1 py-0.5 text-[11px] leading-tight ${CATEGORY_STYLE[ev.category].chip} ${
        ev.status === "done" ? "line-through opacity-50" : ""
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_STYLE[ev.category].dot}`} />
      <span className="flex-1 truncate">{ev.title}</span>
      {ev.editable && ev.status !== "done" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMutate(ev.id, "done");
          }}
          disabled={busy}
          className="hidden text-emerald-300 hover:text-emerald-200 group-hover:inline"
          title="Mark done"
        >
          ✓
        </button>
      )}
      {ev.editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMutate(ev.id, "delete");
          }}
          disabled={busy}
          className="hidden text-red-300 hover:text-red-200 group-hover:inline"
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  );
}
