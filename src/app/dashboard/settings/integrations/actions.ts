"use server";

import { revalidatePath } from "next/cache";
import { addIntegration, setIntegrationActive, deleteIntegration, type IntegrationKind } from "@/lib/integrations-db";

const PATH = "/dashboard/settings/integrations";

export async function addIntegrationAction(input: { kind: IntegrationKind; name: string; targetUrl: string }) {
  const result = await addIntegration(input);
  revalidatePath(PATH);
  return result;
}

export async function setIntegrationActiveAction(id: string, active: boolean) {
  await setIntegrationActive(id, active);
  revalidatePath(PATH);
}

export async function deleteIntegrationAction(id: string) {
  await deleteIntegration(id);
  revalidatePath(PATH);
}
