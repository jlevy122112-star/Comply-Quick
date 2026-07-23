"use server";

import { revalidatePath } from "next/cache";
import {
  applyManualOverrideAction as applyOverride,
  createDraftInvoiceAction as createDraft,
  ensureStripeCustomerAction as ensureStripeCustomer,
  finalizeStripeInvoiceAction as finalizeStripeInvoice,
  prepareAchSetupAction as prepareAchSetup,
  pushInvoiceToStripeAction as pushInvoiceToStripe,
  updateDraftInvoiceAction as updateDraft,
  saveBillingAccountAction as saveAccount,
  transitionInvoiceAction as transitionInvoice,
} from "@/lib/billing/admin";

const PATH = "/dashboard/admin/billing";

export async function saveBillingAccount(formData: FormData): Promise<void> {
  await saveAccount(String(formData.get("organizationId")), {
    billingEmail: String(formData.get("billingEmail") ?? ""),
    billingAddress: {
      line1: String(formData.get("addressLine1") ?? ""),
      city: String(formData.get("addressCity") ?? ""),
      state: String(formData.get("addressState") ?? ""),
      postalCode: String(formData.get("addressPostalCode") ?? ""),
      country: String(formData.get("addressCountry") ?? ""),
    },
    taxId: String(formData.get("taxId") ?? ""),
    collectionMethod: String(formData.get("collectionMethod")) as "charge_automatically" | "send_invoice",
    paymentTerms: String(formData.get("paymentTerms")) as "due_on_receipt" | "net_15" | "net_30" | "net_60",
    poRequired: formData.get("poRequired") === "on",
    defaultPoNumber: String(formData.get("defaultPoNumber") ?? ""),
    status: String(formData.get("status")) as "active" | "past_due" | "suspended",
  });
  revalidatePath(PATH);
}

export async function createDraftInvoice(formData: FormData): Promise<void> {
  await createDraft(String(formData.get("organizationId")), {
    poNumber: String(formData.get("poNumber") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: Number(formData.get("quantity") ?? 1),
    unitAmountCents: Number(formData.get("unitAmountCents") ?? 0),
  });
  revalidatePath(PATH);
}

export async function updateDraftInvoice(formData: FormData): Promise<void> {
  await updateDraft(String(formData.get("organizationId")), String(formData.get("invoiceId")), {
    poNumber: String(formData.get("poNumber") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: Number(formData.get("quantity") ?? 1),
    unitAmountCents: Number(formData.get("unitAmountCents") ?? 0),
  });
  revalidatePath(PATH);
}

export async function transitionInvoiceStatus(formData: FormData): Promise<void> {
  await transitionInvoice(
    String(formData.get("organizationId")),
    String(formData.get("invoiceId")),
    String(formData.get("status")) as "open" | "paid" | "void"
  );
  revalidatePath(PATH);
}

export async function applyManualOverride(formData: FormData): Promise<void> {
  await applyOverride(String(formData.get("organizationId")), {
    tier: String(formData.get("tier") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    expiresAt: String(formData.get("expiresAt") ?? ""),
  });
  revalidatePath(PATH);
}

export async function linkStripeCustomer(formData: FormData): Promise<void> {
  await ensureStripeCustomer(String(formData.get("organizationId")));
  revalidatePath(PATH);
}

export async function sendInvoiceToStripe(formData: FormData): Promise<void> {
  await pushInvoiceToStripe(String(formData.get("organizationId")), String(formData.get("invoiceId")));
  revalidatePath(PATH);
}

export async function finalizeInvoiceOnStripe(formData: FormData): Promise<void> {
  await finalizeStripeInvoice(String(formData.get("organizationId")), String(formData.get("invoiceId")));
  revalidatePath(PATH);
}

export async function setupAch(formData: FormData): Promise<{ clientSecret: string }> {
  const result = await prepareAchSetup(String(formData.get("organizationId")));
  revalidatePath(PATH);
  return result;
}
