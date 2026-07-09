import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCalendarMonth } from "@/lib/calendar/service";
import { getOrCreateFeed } from "@/lib/calendar/feed";
import { canUseAgencyPortal, listClients } from "@/lib/agency/service";
import { getEntitlement } from "@/lib/entitlements";
import { parseDay } from "@/lib/calendar/events";
import CalendarView from "./CalendarView";

export const dynamic = "force-dynamic";

const MONTH_PARAM_RE = /^\d{4}-\d{2}$/;

function refDateFromParam(month: string | undefined): Date {
  if (month && MONTH_PARAM_RE.test(month)) return parseDay(`${month}-01`);
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; client?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/calendar");

  const params = await searchParams;
  const ref = refDateFromParam(params.month);

  const isAgency = await canUseAgencyPortal();
  const clients = isAgency ? await listClients() : [];
  const activeClientId = params.client && clients.some((c) => c.id === params.client) ? params.client : null;

  const month = await getCalendarMonth(ref, { agencyClientId: activeClientId });
  const feed = await getOrCreateFeed();
  const entitlement = await getEntitlement();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
            Comply-Quick
          </Link>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Command Center
          </Link>
        </div>
      </header>
      <CalendarView
        month={month}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        activeClientId={activeClientId}
        feedToken={feed.token}
        tier={entitlement.tier}
      />
    </div>
  );
}
