import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSystemAuditLog } from "@/lib/audit/service";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { normalizeTierKey, isTier } from "@/lib/pricing";
import { getStripe } from "@/services/stripe/client";
import type Stripe from "stripe";

export interface BillingAccount {
  id: string;
  organizationId: string;
  billingEmail: string | null;
  billingAddress: Record<string, string>;
  taxId: string | null;
  collectionMethod: "charge_automatically" | "send_invoice";
  paymentTerms: "due_on_receipt" | "net_15" | "net_30" | "net_60";
  poRequired: boolean;
  defaultPoNumber: string | null;
  currency: string;
  status: "active" | "past_due" | "suspended";
  stripeCustomerId: string | null;
  achStatus: string | null;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  position: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  billingAccountId: string;
  invoiceNumber: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  poNumber: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  notes: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceStatus: string | null;
  hostedInvoiceUrl: string | null;
  lineItems: InvoiceLineItem[];
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  billingAccount: BillingAccount | null;
  openInvoiceBalanceCents: number;
}

type OrganizationRow = {
  id: string;
  name: string | null;
  slug: string | null;
  plan: string | null;
  owner_id: string | null;
};
type BillingAccountRow = {
  id: string;
  organization_id: string;
  billing_email: string | null;
  billing_address: Record<string, string>;
  tax_id: string | null;
  collection_method: BillingAccount["collectionMethod"];
  payment_terms: BillingAccount["paymentTerms"];
  po_required: boolean;
  default_po_number: string | null;
  currency: string;
  status: BillingAccount["status"];
  stripe_customer_id?: string | null;
  ach_status?: string | null;
};
type InvoiceRow = Omit<Invoice, "lineItems"> & {
  organization_id: string;
  billing_account_id: string;
  invoice_number: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  po_number: string | null;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  stripe_invoice_id?: string | null;
  stripe_invoice_status?: string | null;
  hosted_invoice_url?: string | null;
};
type LineItemRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_amount_cents: number;
  amount_cents: number;
  position: number;
};

function mapBillingAccount(row: BillingAccountRow): BillingAccount {
  return {
    id: row.id,
    organizationId: row.organization_id,
    billingEmail: row.billing_email,
    billingAddress: row.billing_address ?? {},
    taxId: row.tax_id,
    collectionMethod: row.collection_method,
    paymentTerms: row.payment_terms,
    poRequired: row.po_required,
    defaultPoNumber: row.default_po_number,
    currency: row.currency,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id ?? null,
    achStatus: row.ach_status ?? null,
  };
}

function mapInvoice(row: InvoiceRow, lineItems: InvoiceLineItem[] = []): Invoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    billingAccountId: row.billing_account_id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    amountPaidCents: row.amount_paid_cents,
    poNumber: row.po_number,
    issuedAt: row.issued_at,
    dueAt: row.due_at,
    paidAt: row.paid_at,
    notes: row.notes,
    stripeInvoiceId: row.stripe_invoice_id ?? null,
    stripeInvoiceStatus: row.stripe_invoice_status ?? null,
    hostedInvoiceUrl: row.hosted_invoice_url ?? null,
    lineItems,
  };
}

async function requireAdmin(): Promise<{ userId: string }> {
  if (!(await isPlatformAdmin())) throw new Error("Platform admin access required.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  return { userId: user.id };
}

async function audit(userId: string, eventType: string, organizationId: string, details: Record<string, unknown>) {
  await createSystemAuditLog({
    eventType,
    actorId: userId,
    actorType: "USER",
    organizationId,
    targetResource: `organization/${organizationId}/billing`,
    details,
  });
}

function stripeOrThrow(): Stripe {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured for this environment.");
  return stripe;
}

function daysUntilDue(paymentTerms: BillingAccount["paymentTerms"], dueAt: string | null): number | undefined {
  if (dueAt) {
    const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
    return Math.max(0, days);
  }
  return { due_on_receipt: 0, net_15: 15, net_30: 30, net_60: 60 }[paymentTerms] ?? undefined;
}

async function billingAccountForOrganization(organizationId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_accounts")
    .select("*, organizations(name)")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) throw new Error("Create a billing account before using Stripe billing.");
  return data as BillingAccountRow & { organizations?: { name?: string | null } | null };
}

export async function ensureStripeCustomerAction(organizationId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const account = await billingAccountForOrganization(organizationId);
  if (account.stripe_customer_id) return;
  const stripe = stripeOrThrow();
  const address = account.billing_address ?? {};
  const customer = await stripe.customers.create(
    {
      email: account.billing_email ?? undefined,
      name: account.organizations?.name ?? undefined,
      address: {
        line1: address.line1 || undefined,
        line2: address.line2 || undefined,
        city: address.city || undefined,
        state: address.state || undefined,
        postal_code: address.postalCode || undefined,
        country: address.country || undefined,
      },
      metadata: { organization_id: organizationId, billing_account_id: account.id },
    },
    { idempotencyKey: `org-billing-customer:${account.id}` }
  );
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_accounts")
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq("id", account.id)
    .is("stripe_customer_id", null);
  if (error) throw new Error("Stripe customer was created but could not be linked.");
  await audit(userId, "BILLING_ACCOUNT_STRIPE_CUSTOMER_LINKED", organizationId, {
    billingAccountId: account.id,
    stripeCustomerId: customer.id,
  });
}

export async function pushInvoiceToStripeAction(organizationId: string, invoiceId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const stripe = stripeOrThrow();
  const account = await billingAccountForOrganization(organizationId);
  if (!account.stripe_customer_id) {
    await ensureStripeCustomerAction(organizationId);
    const refreshed = await billingAccountForOrganization(organizationId);
    account.stripe_customer_id = refreshed.stripe_customer_id;
  }
  if (!account.stripe_customer_id) throw new Error("Could not link a Stripe customer.");
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.stripe_invoice_id) return;
  if (invoice.status !== "draft") throw new Error("Only draft invoices can be sent to Stripe.");
  const { data: items } = await admin
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("position");
  for (const item of (items ?? []) as LineItemRow[]) {
    await stripe.invoiceItems.create(
      {
        customer: account.stripe_customer_id,
        currency: invoice.currency,
        amount: item.amount_cents,
        description: item.description,
        metadata: { local_invoice_id: invoiceId, local_line_item_id: item.id },
      },
      { idempotencyKey: `org-invoice-item:${invoiceId}:${item.id}` }
    );
  }
  const stripeInvoice = await stripe.invoices.create(
    {
      customer: account.stripe_customer_id,
      collection_method: account.collection_method,
      days_until_due:
        account.collection_method === "send_invoice" ? daysUntilDue(account.payment_terms, invoice.due_at) : undefined,
      auto_advance: false,
      currency: invoice.currency,
      description: invoice.notes ?? undefined,
      metadata: { local_invoice_id: invoiceId, organization_id: organizationId },
      payment_settings: { payment_method_types: ["us_bank_account"] },
    },
    { idempotencyKey: `org-invoice:${invoiceId}` }
  );
  const { error } = await admin
    .from("invoices")
    .update({
      stripe_invoice_id: stripeInvoice.id,
      stripe_invoice_status: stripeInvoice.status,
      hosted_invoice_url: stripeInvoice.hosted_invoice_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .is("stripe_invoice_id", null);
  if (error) throw new Error("Stripe invoice was created but could not be linked.");
  await audit(userId, "INVOICE_SENT_TO_STRIPE", organizationId, { invoiceId, stripeInvoiceId: stripeInvoice.id });
}

export async function finalizeStripeInvoiceAction(organizationId: string, invoiceId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const stripe = stripeOrThrow();
  const account = await billingAccountForOrganization(organizationId);
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("stripe_invoice_id, status")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!invoice?.stripe_invoice_id) throw new Error("Send the invoice to Stripe before finalizing it.");
  const finalized = await stripe.invoices.finalizeInvoice(
    invoice.stripe_invoice_id,
    { auto_advance: false },
    { idempotencyKey: `org-invoice-finalize:${invoiceId}` }
  );
  let remote = finalized;
  if (account.collection_method === "send_invoice") {
    remote = await stripe.invoices.sendInvoice(
      invoice.stripe_invoice_id,
      {},
      { idempotencyKey: `org-invoice-send:${invoiceId}` }
    );
  }
  const patch = {
    status: "open",
    issued_at: new Date().toISOString(),
    stripe_invoice_status: remote.status,
    hosted_invoice_url: remote.hosted_invoice_url ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .eq("organization_id", organizationId);
  if (error) throw new Error("Stripe invoice was finalized but local status could not be updated.");
  await audit(userId, "INVOICE_STATUS_CHANGED", organizationId, {
    invoiceId,
    stripeInvoiceId: invoice.stripe_invoice_id,
    status: "open",
  });
}

export async function prepareAchSetupAction(organizationId: string): Promise<{ clientSecret: string }> {
  const { userId } = await requireAdmin();
  const stripe = stripeOrThrow();
  const account = await billingAccountForOrganization(organizationId);
  if (!account.stripe_customer_id) {
    await ensureStripeCustomerAction(organizationId);
    const refreshed = await billingAccountForOrganization(organizationId);
    account.stripe_customer_id = refreshed.stripe_customer_id;
  }
  if (!account.stripe_customer_id) throw new Error("Could not link a Stripe customer.");
  const intent = await stripe.setupIntents.create(
    {
      customer: account.stripe_customer_id,
      payment_method_types: ["us_bank_account"],
      metadata: { organization_id: organizationId, billing_account_id: account.id },
    },
    { idempotencyKey: `org-ach-setup:${account.id}` }
  );
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_accounts")
    .update({ ach_setup_intent_id: intent.id, ach_status: intent.status, updated_at: new Date().toISOString() })
    .eq("id", account.id);
  if (error) throw new Error("ACH setup was created but could not be recorded.");
  await audit(userId, "ACH_SETUP_INTENT_CREATED", organizationId, {
    billingAccountId: account.id,
    setupIntentId: intent.id,
    status: intent.status,
  });
  if (!intent.client_secret) throw new Error("Stripe did not return an ACH setup token.");
  return { clientSecret: intent.client_secret };
}

export async function listBillingTenants(): Promise<TenantSummary[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: organizations }, { data: accounts }, { data: invoices }] = await Promise.all([
    admin.from("organizations").select("id, name, slug, plan, owner_id").order("name"),
    admin.from("billing_accounts").select("*"),
    admin.from("invoices").select("organization_id, total_cents, amount_paid_cents").eq("status", "open"),
  ]);
  const ownerIds = ((organizations ?? []) as OrganizationRow[])
    .map((organization) => organization.owner_id)
    .filter((id): id is string => Boolean(id));
  const { data: subscriptions } = ownerIds.length
    ? await admin.from("subscriptions").select("user_id, tier, status").in("user_id", ownerIds)
    : { data: [] };
  const subscriptionByOwner = new Map<string, { tier: string; status: string }>();
  for (const row of (subscriptions ?? []) as Array<{ user_id: string; tier: string; status: string }>) {
    subscriptionByOwner.set(row.user_id, row);
  }
  const accountByOrg = new Map<string, BillingAccount>();
  for (const row of (accounts ?? []) as BillingAccountRow[])
    accountByOrg.set(row.organization_id, mapBillingAccount(row));
  const balanceByOrg = new Map<string, number>();
  for (const row of (invoices ?? []) as Array<{
    organization_id: string;
    total_cents: number;
    amount_paid_cents: number;
  }>) {
    balanceByOrg.set(
      row.organization_id,
      (balanceByOrg.get(row.organization_id) ?? 0) + row.total_cents - row.amount_paid_cents
    );
  }
  return ((organizations ?? []) as OrganizationRow[]).map((org) => ({
    id: org.id,
    name: org.name ?? org.slug ?? "Untitled organization",
    slug: org.slug ?? org.id.slice(0, 8),
    plan: subscriptionByOwner.get(org.owner_id ?? "")?.tier ?? org.plan ?? "free",
    subscriptionStatus: subscriptionByOwner.get(org.owner_id ?? "")?.status ?? "inactive",
    billingAccount: accountByOrg.get(org.id) ?? null,
    openInvoiceBalanceCents: balanceByOrg.get(org.id) ?? 0,
  }));
}

export async function getBillingTenant(organizationId: string): Promise<{
  tenant: TenantSummary | null;
  invoices: Invoice[];
}> {
  await requireAdmin();
  const tenants = await listBillingTenants();
  const tenant = tenants.find((item) => item.id === organizationId) ?? null;
  if (!tenant) return { tenant: null, invoices: [] };
  const admin = createAdminClient();
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  const rows = (invoiceRows ?? []) as InvoiceRow[];
  const ids = rows.map((row) => row.id);
  const { data: itemRows } = ids.length
    ? await admin.from("invoice_line_items").select("*").in("invoice_id", ids).order("position")
    : { data: [] };
  const itemsByInvoice = new Map<string, InvoiceLineItem[]>();
  for (const row of (itemRows ?? []) as LineItemRow[]) {
    const items = itemsByInvoice.get(row.invoice_id) ?? [];
    items.push({
      id: row.id,
      invoiceId: row.invoice_id,
      description: row.description,
      quantity: row.quantity,
      unitAmountCents: row.unit_amount_cents,
      amountCents: row.amount_cents,
      position: row.position,
    });
    itemsByInvoice.set(row.invoice_id, items);
  }
  return { tenant, invoices: rows.map((row) => mapInvoice(row, itemsByInvoice.get(row.id) ?? [])) };
}

export async function saveBillingAccountAction(
  organizationId: string,
  input: {
    billingEmail: string;
    billingAddress: Record<string, string>;
    taxId: string;
    collectionMethod: BillingAccount["collectionMethod"];
    paymentTerms: BillingAccount["paymentTerms"];
    poRequired: boolean;
    defaultPoNumber: string;
    status: BillingAccount["status"];
  }
): Promise<void> {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("billing_accounts").upsert(
    {
      organization_id: organizationId,
      billing_email: input.billingEmail || null,
      billing_address: input.billingAddress,
      tax_id: input.taxId || null,
      collection_method: input.collectionMethod,
      payment_terms: input.paymentTerms,
      po_required: input.poRequired,
      default_po_number: input.defaultPoNumber || null,
      status: input.status,
    },
    { onConflict: "organization_id" }
  );
  if (error) throw new Error("Could not save the billing account.");
  await audit(userId, "BILLING_ACCOUNT_UPDATED", organizationId, { collectionMethod: input.collectionMethod });
}

export async function updateDraftInvoiceAction(
  organizationId: string,
  invoiceId: string,
  input: {
    poNumber: string;
    dueAt: string;
    notes: string;
    description: string;
    quantity: number;
    unitAmountCents: number;
  }
): Promise<void> {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const amount = Math.max(1, input.quantity) * Math.max(0, input.unitAmountCents);
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!invoice || invoice.status !== "draft") throw new Error("Only draft invoices can be edited.");
  const { error } = await admin
    .from("invoices")
    .update({
      subtotal_cents: amount,
      total_cents: amount,
      po_number: input.poNumber || null,
      due_at: input.dueAt || null,
      notes: input.notes || null,
    })
    .eq("id", invoiceId)
    .eq("organization_id", organizationId);
  if (error) throw new Error("Could not update the draft invoice.");
  const { data: existingItem } = await admin
    .from("invoice_line_items")
    .select("id")
    .eq("invoice_id", invoiceId)
    .order("position")
    .limit(1)
    .maybeSingle();
  const item = {
    description: input.description || "Enterprise services",
    quantity: Math.max(1, input.quantity),
    unit_amount_cents: Math.max(0, input.unitAmountCents),
    amount_cents: amount,
    position: 0,
  };
  const itemResult = existingItem
    ? await admin.from("invoice_line_items").update(item).eq("id", existingItem.id)
    : await admin.from("invoice_line_items").insert({ invoice_id: invoiceId, ...item });
  if (itemResult.error) throw new Error("Could not update the invoice line item.");
  await audit(userId, "INVOICE_UPDATED", organizationId, { invoiceId, status: "draft" });
}

export async function createDraftInvoiceAction(
  organizationId: string,
  input: {
    poNumber: string;
    dueAt: string;
    notes: string;
    description: string;
    quantity: number;
    unitAmountCents: number;
  }
): Promise<void> {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("billing_accounts")
    .select("id, currency")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!account) throw new Error("Create a billing account before creating an invoice.");
  const amount = Math.max(0, input.quantity) * Math.max(0, input.unitAmountCents);
  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      organization_id: organizationId,
      billing_account_id: account.id,
      status: "draft",
      currency: account.currency ?? "usd",
      subtotal_cents: amount,
      total_cents: amount,
      po_number: input.poNumber || null,
      due_at: input.dueAt || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (error || !invoice) throw new Error("Could not create the draft invoice.");
  const { error: itemError } = await admin.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    description: input.description || "Enterprise services",
    quantity: Math.max(1, input.quantity),
    unit_amount_cents: Math.max(0, input.unitAmountCents),
    amount_cents: amount,
    position: 0,
  });
  if (itemError) throw new Error("Could not create the invoice line item.");
  await audit(userId, "INVOICE_CREATED", organizationId, { invoiceId: invoice.id, status: "draft" });
}

export async function transitionInvoiceAction(
  organizationId: string,
  invoiceId: string,
  status: "open" | "paid" | "void"
): Promise<void> {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("total_cents")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");
  const patch =
    status === "paid"
      ? { status, paid_at: new Date().toISOString(), amount_paid_cents: invoice.total_cents }
      : status === "open"
        ? { status, issued_at: new Date().toISOString() }
        : { status };
  const { error } = await admin
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .eq("organization_id", organizationId);
  if (error) throw new Error("Could not transition the invoice.");
  await audit(userId, "INVOICE_STATUS_CHANGED", organizationId, { invoiceId, status });
}

export async function applyManualOverrideAction(
  organizationId: string,
  input: { tier: string; reason: string; expiresAt: string }
): Promise<void> {
  const { userId } = await requireAdmin();
  if (!input.tier) throw new Error("A tier is required.");
  const normalizedTier = input.tier ? normalizeTierKey(input.tier) : null;
  if (normalizedTier && !isTier(normalizedTier)) throw new Error("Invalid entitlement tier.");
  if (!input.reason.trim()) throw new Error("A reason is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("manual_entitlement_overrides").insert({
    organization_id: organizationId,
    tier: normalizedTier,
    seats: null,
    scan_limit: null,
    managed_clients: null,
    reason: input.reason.trim(),
    expires_at: input.expiresAt || null,
    created_by: userId,
  });
  if (error) throw new Error("Could not apply the entitlement override.");
  await audit(userId, "ENTITLEMENT_OVERRIDE_APPLIED", organizationId, {
    tier: normalizedTier,
    reason: input.reason.trim(),
    expiresAt: input.expiresAt || null,
  });
}
