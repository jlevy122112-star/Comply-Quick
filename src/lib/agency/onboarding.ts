// Agency client onboarding intake — server service.
//
// A structured pre-project intake an agency collects from a new website client,
// modeled on how web/design agencies actually onboard: business discovery →
// project goals → brand assets → technical requirements → logistics/approvals →
// compliance context (the last section feeds our scanner + document generator).
//
// Answers are stored as one validated jsonb blob per agency_client. The pure
// schema/normalizer lives in `./onboarding-schema` (client-safe); this module
// adds the RLS-scoped read/write against Supabase and is server-only.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateAgency } from "./service";
import { NotFoundError } from "@/services/errors";
import { normalizeIntakeAnswers, type IntakeStatus, type OnboardingIntake } from "./onboarding-schema";

export * from "./onboarding-schema";

/** Confirms the client belongs to the caller's agency; returns the agency id. */
async function assertClientInAgency(clientId: string): Promise<string> {
  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_clients")
    .select("id")
    .eq("id", clientId)
    .eq("agency_id", agency.id)
    .maybeSingle();
  if (!data) throw new NotFoundError("Client not found.");
  return agency.id;
}

/** Fetches the intake for a client, or null if none has been started. */
export const getIntake = cache(async (clientId: string): Promise<OnboardingIntake | null> => {
  await assertClientInAgency(clientId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("agency_onboarding_intake")
    .select("client_id, status, answers, submitted_at, updated_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return null;
  return {
    clientId: data.client_id as string,
    status: (data.status as IntakeStatus) ?? "draft",
    answers: normalizeIntakeAnswers(data.answers),
    submittedAt: (data.submitted_at as string | null) ?? null,
    updatedAt: (data.updated_at as string | null) ?? null,
  };
});

/** Creates or updates the intake. `submit` flips status to submitted. */
export async function saveIntake(clientId: string, rawAnswers: unknown, submit: boolean): Promise<OnboardingIntake> {
  const agencyId = await assertClientInAgency(clientId);
  const supabase = await createClient();
  const answers = normalizeIntakeAnswers(rawAnswers);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agency_onboarding_intake")
    .upsert(
      {
        agency_id: agencyId,
        client_id: clientId,
        answers,
        status: submit ? "submitted" : "draft",
        submitted_at: submit ? now : null,
        updated_at: now,
      },
      { onConflict: "client_id" }
    )
    .select("client_id, status, answers, submitted_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error("Could not save onboarding intake.");
  }
  return {
    clientId: data.client_id as string,
    status: (data.status as IntakeStatus) ?? "draft",
    answers: normalizeIntakeAnswers(data.answers),
    submittedAt: (data.submitted_at as string | null) ?? null,
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}
