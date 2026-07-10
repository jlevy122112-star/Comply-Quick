"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bucketByDay, toDayKey, type CalendarCategory } from "@/lib/calendar/events";
import { summarizeEvents, nextAction } from "@/lib/calendar/insights";
import { gridDays, monthParam, type CalendarMonthData } from "./calendar-shared";
import { useCalendarFeed } from "./useCalendarFeed";

/**
 * All state, derived data, and mutations for the compliance calendar. Kept out
 * of the view component so CalendarView stays a thin presentational shell.
 */
export function useCalendarController({
  month,
  activeClientId,
  feedToken,
  serverToday,
}: {
  month: CalendarMonthData;
  activeClientId: string | null;
  feedToken: string;
  serverToday: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(month.monthStart);
  const [category, setCategory] = useState<CalendarCategory>("task");

  // `today` starts from the server-computed value so SSR and the first client
  // render agree (no hydration mismatch). All calendar dates are UTC day keys
  // (`toDayKey` → ISO date), so after mount we re-read the client clock; this
  // only changes anything if the server render straddled a UTC midnight boundary
  // relative to the client (clock skew), never due to timezone.
  const [today, setToday] = useState(serverToday);
  useEffect(() => {
    const clientToday = toDayKey(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (clientToday !== today) setToday(clientToday);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayInMonth = today >= month.gridStart && today < month.gridEnd;
  const [selectedDay, setSelectedDay] = useState<string>(todayInMonth ? today : month.monthStart);

  // On soft month navigation the client component is preserved (App Router keeps
  // state across Link navigations), so reset the selected day and the add-task
  // default date to the newly displayed month. Adjusting state during render on a
  // changed prop is the React-recommended pattern (no effect needed).
  const [prevMonthStart, setPrevMonthStart] = useState(month.monthStart);
  if (month.monthStart !== prevMonthStart) {
    setPrevMonthStart(month.monthStart);
    setSelectedDay(todayInMonth ? today : month.monthStart);
    setDueDate(month.monthStart);
  }

  // One-way calendar linking (ICS subscription) lives in its own hook.
  const feed = useCalendarFeed(feedToken, setError);

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

  return {
    busy,
    error,
    view,
    setView,
    showForm,
    setShowForm,
    title,
    setTitle,
    dueDate,
    setDueDate,
    category,
    setCategory,
    today,
    selectedDay,
    setSelectedDay,
    feed,
    buckets,
    days,
    summary,
    guide,
    prevHref,
    nextHref,
    createTask,
    mutateTask,
    openAddFor,
    upcoming,
    selectedEvents,
    agenda,
  };
}
