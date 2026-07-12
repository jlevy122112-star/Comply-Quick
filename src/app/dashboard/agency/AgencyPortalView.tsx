"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uploadBrandLogo, validateLogoFile } from "@/lib/storage/brand";
import type { Tier } from "@/lib/entitlements";
import type { Agency, AgencyClient, AgencyDomain, ClientStats, AgencyMember } from "@/lib/agency/service";
import type { BillingSummary } from "@/lib/billing/usage";

interface Props {
  agency: Agency;
  clients: AgencyClient[];
  domains: AgencyDomain[];
  stats: Record<string, ClientStats>;
  tier: Tier;
  appHost: string;
  members: AgencyMember[];
  billing: BillingSummary;
}

type Tab = "clients" | "team" | "branding" | "domains";

export default function AgencyPortalView({
  agency: initialAgency,
  clients: initialClients,
  domains: initialDomains,
  stats,
  tier,
  appHost,
  members: initialMembers,
  billing,
}: Props) {
  const [tab, setTab] = useState<Tab>("clients");
  const [agency, setAgency] = useState(initialAgency);
  const [clients, setClients] = useState(initialClients);
  const [domains, setDomains] = useState(initialDomains);
  const [members, setMembers] = useState(initialMembers);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ ["--brand" as string]: agency.primaryColor }}>
      <header className="border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
              Comply-Quick
            </Link>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-xs font-medium text-indigo-300">
              Agency Portal
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
              {tier === "enterprise" ? "Enterprise" : "Agency"}
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
            {agency.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agency.logoUrl} alt={agency.name} className="h-11 w-11 rounded-xl object-cover" />
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
        <div className="flex gap-1 border-b border-gray-800">
          {(["clients", "team", "branding", "domains"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? "border-indigo-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "domains" ? "Custom Domains" : t}
            </button>
          ))}
        </div>

        {tab === "clients" && <ClientsTab clients={clients} setClients={setClients} stats={stats} />}
        {tab === "team" && (
          <TeamTab members={members} setMembers={setMembers} billing={billing} ownerId={agency.ownerId} />
        )}
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
}: {
  members: AgencyMember[];
  setMembers: React.Dispatch<React.SetStateAction<AgencyMember[]>>;
  billing: BillingSummary;
  ownerId: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ email }),
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
  }, [email, setMembers]);

  const removeMember = useCallback(
    async (userId: string) => {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      await fetch(`/api/agency/members/${userId}`, { method: "DELETE" });
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
            disabled={busy || email.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add seat"}
          </button>
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
              <p className="text-xs text-gray-500 capitalize">{m.role}</p>
            </div>
            {m.userId === ownerId ? (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-xs text-indigo-300">Owner</span>
            ) : (
              <button
                type="button"
                onClick={() => removeMember(m.userId)}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
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
}: {
  clients: AgencyClient[];
  setClients: React.Dispatch<React.SetStateAction<AgencyClient[]>>;
  stats: Record<string, ClientStats>;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Add a client</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name *"
            className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://client-site.com"
            className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
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
            disabled={busy || name.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add client"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </section>

      {clients.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-8 text-center text-sm text-gray-500">
          No clients yet. Add your first client above to start managing their compliance.
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
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={() => removeClient(c.id)}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLogoUploadError("Please sign in again to upload.");
      setUploading(false);
      return;
    }
    const res = await uploadBrandLogo(user.id, file);
    if (res.ok) {
      setLogoUrl(res.url);
    } else {
      setLogoUploadError(res.error);
    }
    setUploading(false);
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
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Paste a URL or upload a PNG, JPG, SVG or WebP (up to 2 MB).</p>
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
            placeholder="support@youragency.com"
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
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="logo" className="h-8 w-8 rounded-lg object-cover" />
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
            <p className="text-xs text-gray-600 mt-4">Support: {supportEmail || "support@youragency.com"}</p>
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
