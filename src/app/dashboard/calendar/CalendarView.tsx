"use client";

import { UpsellCta } from "@/components/ui";
import type { Tier } from "@/lib/pricing";
import { MONTH_NAMES, type CalendarMonthData, type ClientOption } from "./calendar-shared";
import { useCalendarController } from "./useCalendarController";
import { CalendarHeader } from "./CalendarHeader";
import { KpiBand } from "./KpiBand";
import { GuidedAction } from "./GuidedAction";
import { LinkCalendarPanel } from "./LinkCalendarPanel";
import { CalendarTaskForm } from "./CalendarTaskForm";
import { ClientTabs } from "./ClientTabs";
import { MonthGrid } from "./MonthGrid";
import { WeekGrid } from "./WeekGrid";
import { AgendaList } from "./AgendaList";
import { CalendarSidebar } from "./CalendarSidebar";

export default function CalendarView({
  month,
  clients,
  activeClientId,
  feedToken,
  tier,
  serverToday,
}: {
  month: CalendarMonthData;
  clients: ClientOption[];
  activeClientId: string | null;
  feedToken: string;
  tier: Tier;
  serverToday: string;
}) {
  const c = useCalendarController({ month, activeClientId, feedToken, serverToday });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <CalendarHeader
        view={c.view}
        onViewChange={c.setView}
        prevHref={c.prevHref}
        nextHref={c.nextHref}
        monthLabel={`${MONTH_NAMES[month.month]} ${month.year}`}
        onToggleForm={() => c.setShowForm((v) => !v)}
        onToggleLink={() => c.feed.setShowLink((v) => !v)}
      />

      <KpiBand summary={c.summary} />

      {c.guide && <GuidedAction guide={c.guide} busy={c.busy} onMarkDone={(id) => c.mutateTask(id, "done")} />}

      {tier !== "enterprise" && (
        <div className="mb-6">
          {tier === "agency" || tier === "solo" ? (
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

      {c.feed.showLink && (
        <LinkCalendarPanel
          feedUrl={c.feed.feedUrl}
          webcalUrl={c.feed.webcalUrl}
          googleUrl={c.feed.googleUrl}
          outlookUrl={c.feed.outlookUrl}
          copied={c.feed.copied}
          busy={c.feed.busy}
          onCopy={c.feed.copyFeedUrl}
          onRotate={c.feed.rotateFeed}
          onClose={() => c.feed.setShowLink(false)}
        />
      )}

      {clients.length > 0 && (
        <ClientTabs clients={clients} activeClientId={activeClientId} year={month.year} month={month.month} />
      )}

      {c.error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {c.error}
        </div>
      )}

      {c.showForm && (
        <CalendarTaskForm
          title={c.title}
          onTitleChange={c.setTitle}
          dueDate={c.dueDate}
          onDueDateChange={c.setDueDate}
          category={c.category}
          onCategoryChange={c.setCategory}
          busy={c.busy}
          onSubmit={c.createTask}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
        <div className="min-w-0">
          {c.view === "month" && (
            <MonthGrid
              days={c.days}
              monthIndex={month.month}
              buckets={c.buckets}
              today={c.today}
              selectedDay={c.selectedDay}
              onSelectDay={c.setSelectedDay}
              busy={c.busy}
              onMutate={c.mutateTask}
            />
          )}
          {c.view === "week" && (
            <WeekGrid
              selectedDay={c.selectedDay}
              buckets={c.buckets}
              today={c.today}
              busy={c.busy}
              onMutate={c.mutateTask}
              onAddFor={c.openAddFor}
            />
          )}
          {c.view === "agenda" && (
            <AgendaList agenda={c.agenda} today={c.today} busy={c.busy} onMutate={c.mutateTask} />
          )}
        </div>

        <CalendarSidebar
          selectedDay={c.selectedDay}
          selectedEvents={c.selectedEvents}
          upcoming={c.upcoming}
          busy={c.busy}
          onMutate={c.mutateTask}
          onAddFor={c.openAddFor}
        />
      </div>
    </main>
  );
}
