"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uploadBrandLogo, validateLogoFile } from "@/lib/storage/brand";
import type { Tier } from "@/lib/entitlements";
import { tierLabel } from "@/lib/tier-copy";
import type {
  Agency,
  AgencyClient,
  AgencyClientAssignment,
  AgencyDomain,
  ClientStats,
  AgencyMember,
} from "@/lib/agency/service";
import type { AgencyPortfolioAnalytics } from "@/lib/agency/analytics";
import PortfolioAnalytics from "./PortfolioAnalytics";
import type { BillingSummary } from "@/lib/billing/usage";
import { AGENCY_ROLE_DESCRIPTIONS, AGENCY_ROLE_LABELS, AGENCY_ROLES, type AgencyRole } from "@/lib/agency/roles";
import type { AgencyAlert } from "@/lib/agency/client-dashboard";
import { DocumentsTab } from "./DocumentsTab";

interface Props {
  agency: Agency;
  clients: AgencyClient[];
  domains: AgencyDomain[];
  stats: Record<string, ClientStats>;
  tier: Tier;
  appHost: string;
  members: AgencyMember[];
  billing: BillingSummary;
  managedClientLimit: number | null;
  portfolioAnalytics: AgencyPortfolioAnalytics;
  agencyRole: AgencyRole;
  assignments: Record<string, AgencyClientAssignment[]>;
  alerts: AgencyAlert[];
}

type Tab = "clients" | "portfolio" | "alerts" | "team" | "branding" | "domains" | "documents";

/**
 * Only allow absolute http(s) image URLs. A pasted `javascript:`/`data:` value
 * can't then be bound as a live `src`, and routing the user-controlled string
 * through `URL` parsing + a protocol allowlist neutralizes the DOM-text-to-HTML
 * flow before it reaches the preview.
 */
function safeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export default function AgencyPortalView({
  agency: initialAgency,
  clients: initialClients,
  domains: initialDomains,
  stats,
  tier,
  appHost,
  members: initialMembers,
  billing,
  managedClientLimit,
  portfolioAnalytics,
  agencyRole,
  assignments,
  alerts,
}: Props) {
  const [tab, setTab] = useState<Tab>("clients");
  const [agency, setAgency] = useState(initialAgency);
  const [clients, setClients] = useState(initialClients);
  const [domains, setDomains] = useState(initialDomains);
  const [members, setMembers] = useState(initialMembers);
  const headerLogo = safeImageSrc(agency.logoUrl);
  const isEnterprise = tier === "enterprise";
  const isSolo = tier === "solo";
  const canManageAgency = isEnterprise ? agencyRole === "owner" : agencyRole === "owner" || agencyRole === "admin";
  const managerTabs: Tab[] = isSolo
    ? ["clients", "portfolio", "alerts", "branding", "domains", "documents"]
    : ["clients", "portfolio", "alerts", "team", "branding", "domains", "documents"];
  const tabs: Tab[] = canManageAgency ? managerTabs : ["clients", "portfolio", "alerts"];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ ["--brand" as string]: agency.primaryColor }}>
      <header className="border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
              Comply-Quick
            </Link>
            <span
              className={`hidden sm:inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${
                isEnterprise
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
              }`}
            >
              {isEnterprise ? "Enterprise Portal" : "Agency Portal"}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
              {tierLabel(tier)}
            </span>
          </div>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white transition-colors">
            &larr; Command Center
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ backgroundColor: agency.primaryColor }}
          >
            {headerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerLogo} alt={agency.name} className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              agency.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{agency.name}</h1>
            <p className="text-xs text-gray-500">
              {clients.length} client{clients.length !== 1 ? "s" : ""} · workspace <code>{agency.slug}</code>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800" role="tablist" aria-label="Agency portal sections">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              role="tab"
              aria-selected={tab === t}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? "border-indigo-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "domains" ? "Custom Domains" : t === "portfolio" ? "Analytics" : t}
            </button>
          ))}
        </div>

        {tab === "clients" && (
          <ClientsTab
            clients={clients}
            setClients={setClients}
            stats={stats}
            managedClientLimit={managedClientLimit}
            canManage={agencyRole !== "client_viewer"}
            agencyRole={agencyRole}
            canManageAgency={canManageAgency}
            members={members}
            assignments={assignments}
            isEnterprise={isEnterprise}
          />
        )}
        {tab === "portfolio" && <PortfolioAnalytics analytics={portfolioAnalytics} />}
        {tab === "alerts" && <AlertsTab alerts={alerts} />}
        {tab === "team" && (
          <TeamTab
            members={members}
            setMembers={setMembers}
            billing={billing}
            ownerId={agency.ownerId}
            canManage={agencyRole === "owner" || agencyRole === "admin"}
            assignableRoles={
              agencyRole === "owner" || agencyRole === "admin" ? AGENCY_ROLES.filter((r) => r !== "owner") : []
            }
          />
        )}
        {tab === "documents" && <DocumentsTab agency={agency} clients={clients} canManage={canManageAgency} />}
        {tab === "branding" && <BrandingTab agency={agency} setAgency={setAgency} />}
        {tab === "domains" && (
          <DomainsTab domains={domains} setDomains={setDomains} slug={agency.slug} appHost={appHost} />
        )}
      </main>
    </div>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-500";
  return score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
}

// ─── Team & billing ──────────────────────────────────────────────────────────

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 0 : Math.min(100, limit === 0 ? 100 : Math.round((used / limit) * 100));
  const over = !unlimited && used > limit;
  return (
    <div className="mt-2 h-2 w-full rounded-full bg-gray-800 overflow-hidden">
      <div
        className={`h-full rounded-full ${over ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500"}`}
        style={{ width: unlimited ? "12%" : `${pct}%` }}
      />
    </div>
  );
}

function TeamTab({
  members,
  setMembers,
  billing,
  ownerId,
  canManage,
  assignableRoles,
}: {
  members: AgencyMember[];
  setMembers: React.Dispatch<React.SetStateAction<AgencyMember[]>>;
  billing: BillingSummary;
  ownerId: string;
  canManage: boolean;
  assignableRoles: AgencyRole[];
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AgencyRole>("client_viewer");

  const seatsUsed = members.length;
  const seatLabel = Number.isFinite(billing.seats.limit) ? String(billing.seats.limit) : "Unlimited";
  const scanLabel = Number.isFinite(billing.scans.limit) ? String(billing.scans.limit) : "Unlimited";
  const overageDollars = (billing.scans.overageCents / 100).toFixed(2);

  const addMember = useCallback(async () => {
    if (email.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not add member.");
      setMembers((prev) => (prev.some((m) => m.userId === data.member.userId) ? prev : [...prev, data.member]));
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add member.");
    } finally {
      setBusy(false);
    }
  }, [email, role, setMembers]);

  const removeMember = useCallback(
    async (userId: string) => {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      await fetch(`/api/agency/members/${userId}`, { method: "DELETE" });
    },
    [setMembers]
  );

  const changeRole = useCallback(
    async (userId: string, nextRole: AgencyRole) => {
      const res = await fetch(`/api/agency/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMembers((prev) => prev.map((member) => (member.userId === userId ? data.member : member)));
    },
    [setMembers]
  );

  return (
    <div className="space-y-6">
      {/* Usage summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-white">Seats</h2>
            <span className="text-xs text-gray-500">
              {seatsUsed} / {seatLabel}
            </span>
          </div>
          <UsageBar used={seatsUsed} limit={billing.seats.limit} />
          <p className="mt-2 text-xs text-gray-500">Team members with access to this workspace.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-white">Scans this month</h2>
            <span className="text-xs text-gray-500">
              {billing.scans.used} / {scanLabel}
            </span>
          </div>
          <UsageBar used={billing.scans.used} limit={billing.scans.limit} />
          {billing.scans.over > 0 ? (
            <p className="mt-2 text-xs text-amber-400">
              {billing.scans.over} scan{billing.scans.over !== 1 ? "s" : ""} over — ${overageDollars} overage this
              month.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Included scans reset at the start of each month.</p>
          )}
        </div>
      </section>

      {/* Add seat */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Invite a team member</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@youragency.com"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={addMember}
            disabled={!canManage || busy || email.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add seat"}
          </button>
          {canManage && (
            <label className="text-xs text-gray-400">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AgencyRole)}
                className="ml-2 rounded bg-gray-950 border border-gray-700 px-2 py-2 text-sm text-white"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {AGENCY_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <span className="block mt-1 text-gray-500">{AGENCY_ROLE_DESCRIPTIONS[role]}</span>
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        <p className="text-xs text-gray-500 mt-3">They must already have a Comply-Quick account.</p>
      </section>

      {/* Roster */}
      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{m.email ?? m.userId}</p>
              <p className="text-xs text-gray-500" title={m.roleDescription}>
                {m.roleLabel}
              </p>
            </div>
            {m.userId === ownerId ? (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-xs text-indigo-300">Owner</span>
            ) : (
              <div className="flex items-center gap-3">
                {canManage && (
                  <select
                    value={m.role === "member" ? "client_viewer" : m.role}
                    onChange={(e) => changeRole(m.userId, e.target.value as AgencyRole)}
                    className="rounded bg-gray-950 border border-gray-700 px-2 py-1 text-xs text-white"
                    aria-label={`Role for ${m.email ?? m.userId}`}
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {AGENCY_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => removeMember(m.userId)}
                  disabled={!canManage}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Clients ───────────────────────────────────────────────────────────────

function ClientsTab({
  clients,
  setClients,
  stats,
  managedClientLimit,
  canManage,
  agencyRole,
  canManageAgency,
  members,
  assignments: initialAssignments,
  isEnterprise,
}: {
  clients: AgencyClient[];
  setClients: React.Dispatch<React.SetStateAction<AgencyClient[]>>;
  stats: Record<string, ClientStats>;
  managedClientLimit: number | null;
  canManage: boolean;
  agencyRole: AgencyRole;
  canManageAgency: boolean;
  members: AgencyMember[];
  assignments: Record<string, AgencyClientAssignment[]>;
  isEnterprise: boolean;
}) {
  const dashboardPrefix = isEnterprise ? "/dashboard/enterprise" : "/dashboard/agency";
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [assignmentBusy, setAssignmentBusy] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const activeClientCount = clients.filter((client) => client.status === "active").length;
  const clientCapReached = managedClientLimit !== null && activeClientCount >= managedClientLimit;
  const accountManagers = members.filter((member) => member.role === "account_manager");

  const addClient = useCallback(async () => {
    if (name.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, websiteUrl: website, contactEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not add client.");
      setClients((prev) => [data.client, ...prev]);
      setName("");
      setWebsite("");
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add client.");
    } finally {
      setBusy(false);
    }
  }, [name, website, email, setClients]);

  const removeClient = useCallback(
    async (id: string) => {
      setClients((prev) => prev.filter((c) => c.id !== id));
      await fetch(`/api/agency/clients/${id}`, { method: "DELETE" });
    },
    [setClients]
  );

  const assignManager = async (clientId: string, userId: string) => {
    if (!userId) return;
    setAssignmentBusy(clientId);
    setAssignmentError(null);
    try {
      const res = await fetch(`/api/agency/clients/${clientId}/account-managers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not assign the Account Manager.");
      setAssignments((current) => ({ ...current, [clientId]: [...(current[clientId] ?? []), data.assignment] }));
    } catch (e) {
      setAssignmentError(e instanceof Error ? e.message : "Could not assign the Account Manager.");
    } finally {
      setAssignmentBusy(null);
    }
  };

  const unassignManager = async (clientId: string, userId: string) => {
    setAssignmentBusy(`${clientId}:${userId}`);
    setAssignmentError(null);
    try {
      const res = await fetch(`/api/agency/clients/${clientId}/account-managers`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not unassign the Account Manager.");
      setAssignments((current) => ({
        ...current,
        [clientId]: (current[clientId] ?? []).filter((assignment) => assignment.userId !== userId),
      }));
    } catch (e) {
      setAssignmentError(e instanceof Error ? e.message : "Could not unassign the Account Manager.");
    } finally {
      setAssignmentBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Add a client</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              aria-label="Client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name *"
              className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            <input
              aria-label="Client website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://client-site.com"
              className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            <input
              aria-label="Client contact email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@client.com"
              className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={addClient}
              disabled={busy || clientCapReached || name.trim().length === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
            >
              {busy ? "Adding…" : "Add client"}
            </button>
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
          {clientCapReached && (
            <p className="mt-3 text-xs text-amber-300" role="status">
              Your plan has reached its {managedClientLimit}-client limit. Archive a client or upgrade to add another.
            </p>
          )}
        </section>
      )}

      {clients.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-8 text-center text-sm text-gray-500">
          {agencyRole === "owner" || agencyRole === "admin"
            ? "No clients yet. Add your first client above to start managing their compliance."
            : agencyRole === "account_manager"
              ? "No clients are assigned to you yet. Ask an Agency Admin to assign a client portfolio."
              : "No clients are available in this agency portfolio."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => {
            const s = stats[c.id] ?? { monitors: 0, projects: 0, lowestScore: null };
            return (
              <div
                key={c.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{c.name}</h3>
                    {c.websiteUrl && <p className="text-xs text-gray-500 truncate">{c.websiteUrl}</p>}
                  </div>
                  {c.status === "archived" && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400">Archived</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400">
                  <span>
                    {s.monitors} monitor{s.monitors !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {s.projects} project{s.projects !== 1 ? "s" : ""}
                  </span>
                  <span className={`ml-auto font-semibold ${scoreColor(s.lowestScore)}`}>
                    {s.lowestScore === null ? "—" : `${s.lowestScore}`}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    href={`${dashboardPrefix}/clients/${c.id}`}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View dashboard →
                  </Link>
                  <Link
                    href={`${dashboardPrefix}/clients/${c.id}/intake`}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Intake
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeClient(c.id)}
                    disabled={!canManage}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
                {canManageAgency && (
                  <div className="mt-3 border-t border-gray-800 pt-3">
                    <p className="text-xs font-medium text-gray-300">Account Managers</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(assignments[c.id] ?? []).map((assignment) => (
                        <span
                          key={assignment.userId}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200"
                        >
                          {assignment.email ?? assignment.userId}
                          <button
                            type="button"
                            aria-label={`Unassign ${assignment.email ?? "Account Manager"} from ${c.name}`}
                            onClick={() => unassignManager(c.id, assignment.userId)}
                            disabled={assignmentBusy === `${c.id}:${assignment.userId}`}
                            className="text-indigo-300 hover:text-white disabled:opacity-40"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {(assignments[c.id] ?? []).length === 0 && (
                        <span className="text-xs text-gray-500">No Account Managers assigned.</span>
                      )}
                    </div>
                    <label className="mt-2 block">
                      <span className="sr-only">Assign an Account Manager to {c.name}</span>
                      <select
                        aria-label={`Assign an Account Manager to ${c.name}`}
                        value=""
                        onChange={(event) => assignManager(c.id, event.target.value)}
                        disabled={assignmentBusy === c.id || accountManagers.length === 0}
                        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs text-gray-200 disabled:opacity-40"
                      >
                        <option value="">
                          {accountManagers.length === 0 ? "No Account Managers available" : "Assign Account Manager…"}
                        </option>
                        {accountManagers
                          .filter(
                            (member) =>
                              !(assignments[c.id] ?? []).some((assignment) => assignment.userId === member.userId)
                          )
                          .map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.email ?? member.userId}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {assignmentError && (
        <p className="text-sm text-red-400" role="alert" aria-live="polite">
          {assignmentError}
        </p>
      )}
    </div>
  );
}

// ─── Branding ──────────────────────────────────────────────────────────────

function BrandingTab({
  agency,
  setAgency,
}: {
  agency: Agency;
  setAgency: React.Dispatch<React.SetStateAction<Agency>>;
}) {
  const [name, setName] = useState(agency.name);
  const [logoUrl, setLogoUrl] = useState(agency.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(agency.primaryColor);
  const [supportEmail, setSupportEmail] = useState(agency.supportEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const previewLogo = safeImageSrc(logoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadLogo = useCallback(async (file: File | null) => {
    setLogoUploadError(null);
    if (!file) return;
    const invalid = validateLogoFile(file);
    if (invalid) {
      setLogoUploadError(invalid);
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLogoUploadError("Please sign in again to upload.");
        return;
      }
      const res = await uploadBrandLogo(user.id, file);
      if (res.ok) {
        setLogoUrl(res.url);
      } else {
        setLogoUploadError(res.error);
      }
    } catch {
      setLogoUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/agency", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, logoUrl, primaryColor, supportEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not save branding.");
      setAgency(data.agency);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save branding.");
    } finally {
      setBusy(false);
    }
  }, [name, logoUrl, primaryColor, supportEmail, setAgency]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">White-label branding</h2>
        <Field label="Agency name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </Field>
        <Field label="Logo">
          <div className="flex gap-2">
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                uploadLogo(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Paste a URL or upload a PNG, JPG or WebP (up to 2 MB).</p>
          {logoUploadError && <p className="mt-1 text-xs text-red-400">{logoUploadError}</p>}
        </Field>
        <Field label="Primary color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 rounded bg-transparent border border-gray-700"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-28 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </Field>
        <Field label="Support email">
          <input
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@comply-quick.com"
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </Field>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save branding"}
          </button>
          {saved && <span className="text-sm text-emerald-400">Saved ✓</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Preview</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: primaryColor }}>
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold">
              {previewLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewLogo} alt="logo" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                (name || "A").charAt(0).toUpperCase()
              )}
            </div>
            <span className="text-white font-semibold text-sm">{name || "Your Agency"}</span>
          </div>
          <div className="p-4 bg-gray-950">
            <p className="text-sm text-gray-300 mb-3">Client compliance dashboard</p>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              Run scan
            </button>
            <p className="text-xs text-gray-600 mt-4">Support: {supportEmail || "support@comply-quick.com"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

// ─── Domains ───────────────────────────────────────────────────────────────

function DomainsTab({
  domains,
  setDomains,
  slug,
  appHost,
}: {
  domains: AgencyDomain[];
  setDomains: React.Dispatch<React.SetStateAction<AgencyDomain[]>>;
  slug: string;
  appHost: string;
}) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async () => {
    if (domain.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/domains", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not add domain.");
      setDomains((prev) => [data.domain, ...prev]);
      setDomain("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add domain.");
    } finally {
      setBusy(false);
    }
  }, [domain, setDomains]);

  const remove = useCallback(
    async (id: string) => {
      setDomains((prev) => prev.filter((d) => d.id !== id));
      await fetch(`/api/agency/domains/${id}`, { method: "DELETE" });
    },
    [setDomains]
  );

  const [verifying, setVerifying] = useState<string | null>(null);
  const verify = useCallback(
    async (id: string) => {
      setVerifying(id);
      try {
        const res = await fetch(`/api/agency/domains/${id}/verify`, { method: "POST" });
        const data = await res.json();
        if (res.ok) setDomains((prev) => prev.map((d) => (d.id === id ? data.domain : d)));
      } finally {
        setVerifying(null);
      }
    },
    [setDomains]
  );

  const statusStyle: Record<AgencyDomain["status"], string> = {
    pending: "bg-yellow-500/10 text-yellow-400",
    verified: "bg-emerald-500/10 text-emerald-400",
    error: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="space-y-6">
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Custom domains</h2>
        <p className="text-xs text-gray-500 mb-3">
          Serve the white-label portal on your client&apos;s own domain. Add it here, then point a CNAME at{" "}
          <code className="text-indigo-400">{appHost}</code>. It stays <em>pending</em> until DNS + certificate are
          verified.
        </p>
        <div className="flex gap-3">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="compliance.acme.com"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || domain.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add domain"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </section>

      {domains.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-8 text-center text-sm text-gray-500">
          No custom domains yet. Your portal is available at{" "}
          <code className="text-indigo-400">
            {appHost}/portal/{slug}
          </code>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{d.domain}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    CNAME → <code className="text-gray-400">{appHost}</code>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyle[d.status]}`}>
                    {d.status}
                  </span>
                  {d.status !== "verified" && (
                    <button
                      type="button"
                      onClick={() => verify(d.id)}
                      disabled={verifying === d.id}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40"
                    >
                      {verifying === d.id ? "Checking…" : "Verify"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {d.status !== "verified" && (
                <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-800 space-y-1">
                  {d.dns.length > 0 ? (
                    <>
                      <p className="text-gray-500">Add these DNS records at your registrar, then click Verify:</p>
                      {d.dns.map((r, i) => (
                        <p key={i} className="font-mono text-gray-400">
                          {r.type} <span className="text-gray-500">{r.name}</span> → {r.value}
                        </p>
                      ))}
                    </>
                  ) : (
                    <p>
                      Point a CNAME for <code className="text-gray-400">{d.domain}</code> at{" "}
                      <code className="text-gray-400">{appHost}</code>, then click Verify.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsTab({ alerts }: { alerts: AgencyAlert[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Cross-client alerts</h2>
        <span className="text-sm text-gray-500">{alerts.length} unresolved</span>
      </div>
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 px-6 py-12 text-center">
          <p className="text-3xl" aria-hidden>
            🔔
          </p>
          <h3 className="mt-3 text-sm font-semibold text-white">No unresolved alerts</h3>
          <p className="text-sm text-gray-500">Alerts from all client monitors will appear here as aggregate counts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-800 bg-gray-900 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
                      alert.severity === "critical"
                        ? "border-rose-500/30 bg-rose-500/15 text-rose-300"
                        : alert.severity === "warning"
                          ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                          : "border-sky-500/30 bg-sky-500/15 text-sky-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        alert.severity === "critical"
                          ? "bg-rose-400"
                          : alert.severity === "warning"
                            ? "bg-amber-400"
                            : "bg-sky-400"
                      }`}
                    />
                    {alert.severity === "critical" ? "Critical" : alert.severity === "warning" ? "Warning" : "Info"}
                  </span>
                  {!alert.read && (
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">New</span>
                  )}
                </div>
                <h4 className="mt-2 font-medium text-white">{alert.title}</h4>
                <p className="text-sm text-gray-400">{alert.body}</p>
              </div>
              <span className="shrink-0 text-xs text-gray-500">
                {new Date(alert.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
