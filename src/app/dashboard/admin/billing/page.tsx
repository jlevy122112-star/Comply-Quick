import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getBillingTenant, listBillingTenants } from "@/lib/billing/admin";
import BillingOpsView from "./BillingOpsView";

export const dynamic = "force-dynamic";

export default async function BillingAdminPage({ searchParams }: { searchParams: Promise<{ organization?: string }> }) {
  if (!(await isPlatformAdmin())) redirect("/dashboard/home");
  const params = await searchParams;
  const tenants = await listBillingTenants();
  const selectedId = params.organization ?? tenants[0]?.id ?? null;
  const detail = selectedId ? await getBillingTenant(selectedId) : { tenant: null, invoices: [] };

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-3 border-b border-gray-800/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Platform Operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Enterprise Billing Operations</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Manage tenant billing records, invoices, and manual entitlements. Stripe customer linking, invoice push,
              and ACH setup are available when Stripe is configured.
            </p>
          </div>
          <Link
            className="text-sm text-gray-400 underline-offset-4 hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-400"
            href="/dashboard/home"
          >
            Back to Command Center
          </Link>
        </header>
        <BillingOpsView
          tenants={tenants}
          detail={detail}
          selectedId={selectedId}
          stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
        />
      </div>
    </main>
  );
}
