"use client";

import { useMemo, useState } from "react";
import { Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, PageTitle, ProgressBar } from "@/components/ui";
import { ALL_TIERS, getTierConfig, isUnlimited, type Billing, type Tier } from "@/lib/pricing";
import { tierDescription, tierUpgradeBenefit } from "@/lib/tier-copy";

type ManagedClientsUsage =
  { status: "not-applicable" } | { status: "ok"; used: number; limit: number } | { status: "unavailable" };

export interface BillingPageData {
  usage: {
    scans: { used: number; limit: number; period: string } | null;
    seats: { used: number; limit: number } | null;
    managedClients: ManagedClientsUsage;
  };
}

interface PlansBillingViewProps {
  tier: Tier;
  status: "active" | "inactive" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
  usage: BillingPageData["usage"];
}

const STATUS_COPY: Record<
  PlansBillingViewProps["status"],
  { label: string; tone: "emerald" | "amber" | "rose" | "gray" }
> = {
  active: { label: "Active", tone: "emerald" },
  past_due: { label: "Payment Issue", tone: "amber" },
  canceled: { label: "Canceled", tone: "rose" },
  inactive: { label: "Free Plan", tone: "gray" },
};

function formatLimit(value: number | null): string {
  if (value === null || isUnlimited(value)) return "Unlimited";
  return value.toLocaleString();
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function Meter({ label, used, limit, detail }: { label: string; used: number; limit: number; detail: string }) {
  const unlimited = isUnlimited(limit);
  const percentage = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs tabular-nums text-text-secondary">
          {used.toLocaleString()} / {formatLimit(limit)}
        </span>
      </div>
      {unlimited ? (
        <div className="h-2 rounded-full bg-status-success/20">
          <div className="h-full w-1/3 rounded-full bg-status-success" />
        </div>
      ) : (
        <ProgressBar
          value={used}
          max={Math.max(limit, 1)}
          tone={percentage >= 90 ? "rose" : percentage >= 70 ? "amber" : "indigo"}
          ariaLabel={`${label}: ${used} of ${limit}`}
        />
      )}
      <p className="text-xs text-text-muted">{detail}</p>
    </div>
  );
}

function UnavailableMeter({ label }: { label: string }) {
  return (
    <div className="space-y-2" role="status">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <Badge tone="amber">Temporarily unavailable</Badge>
      </div>
      <p className="text-sm text-text-secondary">We couldn&apos;t load this usage right now.</p>
      <p className="text-xs text-text-muted">Try refreshing the page in a moment.</p>
    </div>
  );
}

export default function PlansBillingView({ tier, status, currentPeriodEnd, usage }: PlansBillingViewProps) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [busyPlan, setBusyPlan] = useState<Tier | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusCopy = STATUS_COPY[status];
  const renewalDate = formatDate(currentPeriodEnd);
  const plans = useMemo(() => ALL_TIERS.map((plan) => getTierConfig(plan)), []);

  async function startCheckout(plan: Exclude<Tier, "free">) {
    setBusyPlan(plan);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const body = (await response.json()) as { url?: string; message?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.message ?? body.error ?? "Checkout is unavailable.");
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout is unavailable.");
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    setBusyPlan("portal");
    setError(null);
    try {
      const response = await fetch("/api/billing-portal", { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "Billing portal is unavailable.");
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing portal is unavailable.");
      setBusyPlan(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageTitle
        title="Plans & Billing"
        description="One clear view of your workspace plan, usage, and subscription controls."
        icon={<CreditCard className="h-6 w-6 text-accent-primary" aria-hidden="true" />}
        actions={
          status === "active" || status === "past_due" || status === "canceled" ? (
            <Button type="button" variant="secondary" onClick={openPortal} loading={busyPlan === "portal"}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Manage Billing
            </Button>
          ) : null
        }
      />

      {error && (
        <div
          className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card variant="elevated" className="overflow-hidden">
          <CardBody className="relative overflow-hidden p-6 sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent-primary/10 blur-3xl" />
            <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text-secondary">Current Workspace Plan</p>
                  <Badge tone={statusCopy.tone}>{statusCopy.label}</Badge>
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
                  {getTierConfig(tier).label}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{tierDescription(tier)}</p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-card/70 p-4 text-right">
                <p className="text-2xl font-semibold text-text-primary">
                  ${getTierConfig(tier).monthly.toLocaleString()}
                  <span className="text-sm font-normal text-text-muted"> plan rate</span>
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {renewalDate ? `Renews ${renewalDate}` : "No recurring charge"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Subscription Support"
            icon={<Sparkles className="h-5 w-5 text-accent-primary" aria-hidden="true" />}
          />
          <CardBody className="space-y-3">
            <p className="text-sm leading-6 text-text-secondary">
              Invoices, payment methods, receipts, and cancellation are securely handled in Stripe&apos;s billing
              portal.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openPortal}
              loading={busyPlan === "portal"}
              disabled={tier === "free"}
            >
              Open Stripe Billing Portal
            </Button>
            {tier === "free" && (
              <p className="text-xs text-text-muted">Choose a paid plan below to create a billing account.</p>
            )}
          </CardBody>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Usage This Period</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Usage is scoped to your active organization where supported. Limits follow the organization owner&apos;s
              entitlement.
            </p>
          </div>
          <Badge tone="indigo">{usage.scans?.period ?? "Current period"}</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardBody>
              {usage.scans ? (
                <Meter
                  label="Compliance Scans"
                  used={usage.scans.used}
                  limit={usage.scans.limit}
                  detail="Calendar-month scans"
                />
              ) : (
                <UnavailableMeter label="Compliance Scans" />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              {usage.managedClients.status === "not-applicable" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary">Managed Clients</span>
                    <Badge tone="gray">Personal workspace</Badge>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Managed client workspaces aren&apos;t included in this plan.
                  </p>
                  <p className="text-xs text-text-muted">Upgrade to a client-management plan to build a portfolio.</p>
                </div>
              ) : usage.managedClients.status === "unavailable" ? (
                <UnavailableMeter label="Managed Clients" />
              ) : (
                <Meter
                  label="Managed Clients"
                  used={usage.managedClients.used}
                  limit={usage.managedClients.limit}
                  detail="Active client workspaces"
                />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              {usage.seats ? (
                <Meter
                  label="Team Seats"
                  used={usage.seats.used}
                  limit={usage.seats.limit}
                  detail="Members in this workspace"
                />
              ) : (
                <UnavailableMeter label="Team Seats" />
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Compare Plans</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Scale from focused solo compliance to an unlimited enterprise workspace.
            </p>
          </div>
          <div
            className="inline-flex rounded-xl border border-border-default bg-surface-card p-1"
            role="group"
            aria-label="Billing Cadence"
          >
            {(["monthly", "annual"] as Billing[]).map((cadence) => (
              <button
                key={cadence}
                type="button"
                aria-pressed={billing === cadence}
                onClick={() => setBilling(cadence)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${billing === cadence ? "bg-accent-primary text-text-inverse" : "text-text-secondary hover:text-text-primary"}`}
              >
                {cadence === "monthly" ? "Monthly" : "Annual · save 2 months"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === tier;
            const isFeatured = plan.id === "agency";
            return (
              <Card
                key={plan.id}
                variant={isFeatured ? "elevated" : "default"}
                className={isFeatured ? "border-accent-primary/50" : undefined}
              >
                <CardBody className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{plan.label}</h3>
                      <p className="mt-1 text-xs text-text-muted">
                        {plan.id === "free" ? "Explore the essentials" : tierUpgradeBenefit(plan.id)}
                      </p>
                    </div>
                    {isCurrent && <Badge tone="emerald">Current</Badge>}
                    {isFeatured && !isCurrent && <Badge tone="indigo">Most popular</Badge>}
                  </div>
                  <p className="mt-5 text-2xl font-semibold text-text-primary">
                    ${plan[billing].toLocaleString()}
                    <span className="text-sm font-normal text-text-muted">/{billing === "annual" ? "year" : "mo"}</span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-text-secondary">
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
                      {formatLimit(plan.scanLimit)} scans / month
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
                      {formatLimit(plan.seats)} team seats
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
                      {plan.managedClients === null
                        ? "Personal workspace"
                        : `${formatLimit(plan.managedClients)} managed clients`}
                    </li>
                  </ul>
                  {plan.id === "free" ? (
                    <Button type="button" variant="secondary" className="mt-6 w-full" disabled={isCurrent}>
                      {isCurrent ? "Current plan" : "Free plan"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant={isCurrent ? "secondary" : "primary"}
                      className="mt-6 w-full"
                      disabled={isCurrent}
                      loading={busyPlan === plan.id}
                      onClick={() => startCheckout(plan.id as Exclude<Tier, "free">)}
                    >
                      {isCurrent
                        ? "Current plan"
                        : tier === "free"
                          ? "Start plan"
                          : plan.id === "enterprise"
                            ? "Move to Enterprise"
                            : "Change plan"}
                    </Button>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>

      <p className="text-center text-xs text-text-muted">
        Need invoices or receipts? Stripe&apos;s billing portal has the complete billing history for your subscription.
      </p>
    </main>
  );
}
