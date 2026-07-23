"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import type { Invoice, TenantSummary } from "@/lib/billing/admin";
import {
  applyManualOverride,
  createDraftInvoice,
  finalizeInvoiceOnStripe,
  linkStripeCustomer,
  saveBillingAccount,
  sendInvoiceToStripe,
  setupAch,
  transitionInvoiceStatus,
  updateDraftInvoice,
} from "./actions";

interface Props {
  tenants: TenantSummary[];
  detail: { tenant: TenantSummary | null; invoices: Invoice[] };
  selectedId: string | null;
  stripeConfigured: boolean;
}

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

function tone(status: string): "gray" | "emerald" | "amber" | "rose" {
  if (status === "paid" || status === "active") return "emerald";
  if (status === "open" || status === "past_due") return "amber";
  if (status === "void" || status === "suspended" || status === "uncollectible") return "rose";
  return "gray";
}

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function BillingOpsView({ tenants, detail, selectedId, stripeConfigured }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [achReady, setAchReady] = useState(false);
  const account = detail.tenant?.billingAccount;
  const tenant = detail.tenant;
  const submit = (action: (formData: FormData) => Promise<void>, formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Operation failed.");
      }
    });
  };

  if (tenants.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-400">No organizations are available.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader
          title="Tenants"
          description={`${tenants.length} organization${tenants.length === 1 ? "" : "s"} in the platform`}
        />
        <div className="divide-y divide-gray-800">
          {tenants.map((tenant) => (
            <Link
              key={tenant.id}
              href={`/dashboard/admin/billing?organization=${tenant.id}`}
              aria-current={tenant.id === selectedId ? "page" : undefined}
              className={`block px-5 py-4 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400 ${
                tenant.id === selectedId ? "bg-gray-800/70" : "hover:bg-gray-800/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{tenant.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{tenant.slug}</p>
                </div>
                <Badge tone={tone(tenant.billingAccount?.status ?? tenant.subscriptionStatus)}>{tenant.plan}</Badge>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Subscription <span className="font-medium text-gray-200">{tenant.subscriptionStatus}</span>
                <span className="mx-2 text-gray-700">·</span>
                Open balance <span className="font-medium text-gray-200">{money(tenant.openInvoiceBalanceCents)}</span>
              </p>
            </Link>
          ))}
        </div>
      </Card>

      {!tenant ? (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-400">Select a tenant to manage billing.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </div>
          )}
          {!stripeConfigured && (
            <div
              className="rounded-xl border border-border-default bg-surface-elevated px-4 py-3 text-sm text-text-secondary"
              role="status"
            >
              Stripe billing is not configured for this environment. Local billing records remain available, while
              customer linking, ACH setup, and Stripe invoice actions are disabled.
            </div>
          )}
          <Card>
            <CardHeader
              title={tenant.name}
              description={`Current organization tier: ${tenant.plan} · subscription ${tenant.subscriptionStatus}`}
            />
            <CardBody>
              <div className="mb-5 flex flex-col gap-4 rounded-xl border border-border-default bg-surface-elevated/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Stripe Billing Account</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {account?.stripeCustomerId
                      ? `Customer linked: ${account.stripeCustomerId}`
                      : "No Stripe customer is linked yet. Linking is idempotent and does not charge the customer."}
                  </p>
                  {account?.achStatus && (
                    <p className="mt-2 text-xs text-text-secondary">
                      ACH Setup <Badge tone={tone(account.achStatus)}>{statusLabel(account.achStatus)}</Badge>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={(formData) => submit(linkStripeCustomer, formData)}>
                    <input type="hidden" name="organizationId" value={tenant.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={pending || !stripeConfigured || Boolean(account?.stripeCustomerId)}
                    >
                      {account?.stripeCustomerId ? "Customer Linked" : "Link Stripe Customer"}
                    </Button>
                  </form>
                  <form
                    action={(formData) => {
                      setAchReady(false);
                      startTransition(async () => {
                        try {
                          await setupAch(formData);
                          setAchReady(true);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "ACH setup failed.");
                        }
                      });
                    }}
                  >
                    <input type="hidden" name="organizationId" value={tenant.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      disabled={pending || !stripeConfigured || !account?.stripeCustomerId}
                    >
                      Set Up ACH
                    </Button>
                  </form>
                </div>
              </div>
              {achReady && (
                <p
                  className="mb-5 rounded-lg border border-border-default bg-surface-elevated px-4 py-3 text-sm text-text-secondary"
                  role="status"
                >
                  ACH setup is ready for the secure Stripe bank-account confirmation step. No bank details are stored
                  here.
                </p>
              )}
              <form action={(formData) => submit(saveBillingAccount, formData)} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={tenant.id} />
                <label className="text-sm text-gray-300">
                  Billing email
                  <input
                    name="billingEmail"
                    defaultValue={account?.billingEmail ?? ""}
                    type="email"
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  Tax ID
                  <input
                    name="taxId"
                    defaultValue={account?.taxId ?? ""}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300 sm:col-span-2">
                  Address line 1
                  <input
                    name="addressLine1"
                    defaultValue={account?.billingAddress.line1 ?? ""}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  City
                  <input
                    name="addressCity"
                    defaultValue={account?.billingAddress.city ?? ""}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  State / region
                  <input
                    name="addressState"
                    defaultValue={account?.billingAddress.state ?? ""}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  Postal code
                  <input
                    name="addressPostalCode"
                    defaultValue={account?.billingAddress.postalCode ?? ""}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  Country
                  <input
                    name="addressCountry"
                    defaultValue={account?.billingAddress.country ?? ""}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  Collection method
                  <select
                    name="collectionMethod"
                    defaultValue={account?.collectionMethod ?? "charge_automatically"}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  >
                    <option value="charge_automatically">Charge Automatically</option>
                    <option value="send_invoice">Send Invoice</option>
                  </select>
                </label>
                <label className="text-sm text-gray-300">
                  Payment terms
                  <select
                    name="paymentTerms"
                    defaultValue={account?.paymentTerms ?? "due_on_receipt"}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  >
                    <option value="due_on_receipt">Due on Receipt</option>
                    <option value="net_15">Net 15</option>
                    <option value="net_30">Net 30</option>
                    <option value="net_60">Net 60</option>
                  </select>
                </label>
                <label className="text-sm text-gray-300">
                  Default PO number
                  <input
                    name="defaultPoNumber"
                    defaultValue={account?.defaultPoNumber ?? ""}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300">
                  Account status
                  <select
                    name="status"
                    defaultValue={account?.status ?? "active"}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  >
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="poRequired"
                    defaultChecked={account?.poRequired ?? false}
                    className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-emerald-400 focus:ring-emerald-400"
                  />{" "}
                  Purchase order required
                </label>
                <Button type="submit" disabled={pending} className="sm:col-span-2">
                  {pending ? "Saving…" : "Save billing account"}
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Invoices"
              description="Local invoice records can be sent to Stripe explicitly and finalized separately."
            />
            <CardBody className="space-y-5">
              {detail.invoices.length === 0 && <p className="text-sm text-gray-500">No invoices yet.</p>}
              {detail.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{invoice.invoiceNumber}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {invoice.lineItems.length} line item{invoice.lineItems.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={tone(invoice.status)}>{statusLabel(invoice.status)}</Badge>
                      {invoice.stripeInvoiceStatus && (
                        <Badge tone={tone(invoice.stripeInvoiceStatus)}>
                          {statusLabel(invoice.stripeInvoiceStatus)}
                        </Badge>
                      )}
                      <span className="font-medium text-gray-200">{money(invoice.totalCents, invoice.currency)}</span>
                    </div>
                  </div>
                  {invoice.status === "draft" && (
                    <p className="mt-3 text-xs text-gray-400">
                      {invoice.lineItems.map((item) => `${item.description} × ${item.quantity}`).join(" · ")}
                    </p>
                  )}
                  {invoice.status === "draft" && (
                    <form
                      action={(formData) => submit(updateDraftInvoice, formData)}
                      className="mt-4 grid gap-3 border-t border-gray-800 pt-4 sm:grid-cols-2"
                    >
                      <input type="hidden" name="organizationId" value={tenant.id} />
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input
                        name="description"
                        required
                        defaultValue={invoice.lineItems[0]?.description ?? ""}
                        aria-label="Draft Line Item Description"
                        className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <input
                        name="unitAmountCents"
                        required
                        min="0"
                        type="number"
                        defaultValue={invoice.lineItems[0]?.unitAmountCents ?? 0}
                        aria-label="Draft Unit Amount in Cents"
                        className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <input
                        name="quantity"
                        required
                        min="1"
                        type="number"
                        defaultValue={invoice.lineItems[0]?.quantity ?? 1}
                        aria-label="Draft Quantity"
                        className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <input
                        name="poNumber"
                        defaultValue={invoice.poNumber ?? ""}
                        placeholder="PO number"
                        aria-label="Draft PO Number"
                        className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <input
                        name="dueAt"
                        type="date"
                        defaultValue={invoice.dueAt?.slice(0, 10) ?? ""}
                        aria-label="Draft Due Date"
                        className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <input
                        name="notes"
                        defaultValue={invoice.notes ?? ""}
                        placeholder="Internal notes"
                        aria-label="Draft Notes"
                        className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <Button type="submit" variant="secondary" disabled={pending} className="sm:col-span-2">
                        {pending ? "Saving…" : "Save draft"}
                      </Button>
                    </form>
                  )}
                  {invoice.status === "draft" || invoice.status === "open" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {invoice.status === "draft" && (
                        <InvoiceStripeAction
                          label={invoice.stripeInvoiceId ? "Sent to Stripe" : "Send to Stripe"}
                          action={sendInvoiceToStripe}
                          invoice={invoice}
                          organizationId={tenant.id}
                          submit={submit}
                          pending={pending}
                          disabled={Boolean(invoice.stripeInvoiceId) || !stripeConfigured}
                          stripeConfigured={stripeConfigured}
                        />
                      )}
                      {invoice.stripeInvoiceId && invoice.status === "draft" && (
                        <InvoiceStripeAction
                          label="Finalize / Send"
                          action={finalizeInvoiceOnStripe}
                          invoice={invoice}
                          organizationId={tenant.id}
                          submit={submit}
                          pending={pending}
                          stripeConfigured={stripeConfigured}
                        />
                      )}
                      {invoice.hostedInvoiceUrl && (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                        >
                          Open Hosted Invoice
                        </a>
                      )}
                      {invoice.status === "draft" && !invoice.stripeInvoiceId && (
                        <InvoiceAction
                          label="Open Invoice"
                          status="open"
                          invoice={invoice}
                          organizationId={tenant.id}
                          submit={submit}
                          pending={pending}
                        />
                      )}
                      {invoice.status === "open" && (
                        <InvoiceAction
                          label="Mark Paid"
                          status="paid"
                          invoice={invoice}
                          organizationId={tenant.id}
                          submit={submit}
                          pending={pending}
                        />
                      )}
                      {invoice.status === "open" && (
                        <InvoiceAction
                          label="Void"
                          status="void"
                          invoice={invoice}
                          organizationId={tenant.id}
                          submit={submit}
                          pending={pending}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              <form
                action={(formData) => submit(createDraftInvoice, formData)}
                className="grid gap-4 border-t border-gray-800 pt-5 sm:grid-cols-2"
              >
                <input type="hidden" name="organizationId" value={tenant.id} />
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 sm:col-span-2">
                  New draft invoice
                </p>
                <input
                  name="description"
                  required
                  placeholder="Line item description"
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <input
                  name="unitAmountCents"
                  required
                  min="0"
                  type="number"
                  placeholder="Unit amount (cents)"
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <input
                  name="quantity"
                  required
                  min="1"
                  defaultValue="1"
                  type="number"
                  placeholder="Quantity"
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <input
                  name="poNumber"
                  placeholder="PO number"
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <input
                  name="dueAt"
                  type="date"
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <input
                  name="notes"
                  placeholder="Internal notes"
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <Button type="submit" disabled={pending} className="sm:col-span-2">
                  {pending ? "Creating…" : "Create draft invoice"}
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Manual Entitlement Override"
              description="Changes the organization's plan tier on org-entitlement surfaces. The reason is retained on the audit trail."
            />
            <CardBody>
              <form action={(formData) => submit(applyManualOverride, formData)} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={tenant.id} />
                <label className="text-sm text-gray-300">
                  Tier override
                  <select
                    name="tier"
                    required
                    defaultValue=""
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  >
                    <option value="" disabled>
                      Select a tier
                    </option>
                    <option value="free">Free</option>
                    <option value="solo">Solo</option>
                    <option value="agency">Agency</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <label className="text-sm text-gray-300">
                  Expires at
                  <input
                    name="expiresAt"
                    type="datetime-local"
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <label className="text-sm text-gray-300 sm:col-span-2">
                  Reason (required)
                  <textarea
                    name="reason"
                    required
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
                <Button type="submit" disabled={pending} className="sm:col-span-2">
                  {pending ? "Applying…" : "Apply override"}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function InvoiceAction({
  label,
  status,
  invoice,
  organizationId,
  submit,
  pending,
}: {
  label: string;
  status: "open" | "paid" | "void";
  invoice: Invoice;
  organizationId: string;
  submit: (action: (formData: FormData) => Promise<void>, formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={(formData) => submit(transitionInvoiceStatus, formData)}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {label}
      </Button>
    </form>
  );
}

function InvoiceStripeAction({
  label,
  action,
  invoice,
  organizationId,
  submit,
  pending,
  disabled,
  stripeConfigured,
}: {
  label: string;
  action: (formData: FormData) => Promise<void>;
  invoice: Invoice;
  organizationId: string;
  submit: (action: (formData: FormData) => Promise<void>, formData: FormData) => void;
  pending: boolean;
  disabled?: boolean;
  stripeConfigured: boolean;
}) {
  return (
    <form action={(formData) => submit(action, formData)}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <Button type="submit" variant="secondary" disabled={pending || disabled || !stripeConfigured}>
        {label}
      </Button>
    </form>
  );
}
