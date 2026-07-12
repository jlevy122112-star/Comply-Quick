import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REGION_RULES } from "@/lib/tools/data";
import {
  listBreachIncidents,
  computeObligations,
  BREACH_DATA_CATEGORIES,
  type ComputedObligation,
  type BreachIncident,
} from "@/lib/privacy/breach";
import { BreachPanel } from "./BreachPanel";

export const dynamic = "force-dynamic";

export interface IncidentView {
  incident: BreachIncident;
  obligations: ComputedObligation[];
}

export default async function BreachesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/settings/breaches");

  const incidents = await listBreachIncidents();
  const views: IncidentView[] = incidents.map((incident) => ({
    incident,
    obligations: computeObligations(incident),
  }));

  const regionOptions = Object.entries(REGION_RULES).map(([id, meta]) => ({ id, name: meta.name }));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard/home" className="text-lg font-bold tracking-tight text-white">
            Comply-Quick
          </Link>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Command Center
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Breach Notification</h1>
          <p className="mt-1 text-sm text-gray-400">
            Record a personal-data breach and track the regulatory notification deadlines it triggers (GDPR Art. 33/34,
            US state laws, HIPAA and more). Deadlines are engineering aids, not legal advice.
          </p>
        </div>
        <BreachPanel views={views} regionOptions={regionOptions} dataCategoryOptions={[...BREACH_DATA_CATEGORIES]} />
      </main>
    </div>
  );
}
