"use server";

import { revalidatePath } from "next/cache";
import { addIntegration, setIntegrationActive, deleteIntegration, type IntegrationKind } from "@/lib/integrations-db";
import {
  connectNativeIntegration,
  softRevokeNativeIntegration,
  type NativeIntegrationMode,
  type NativePlatform,
} from "@/lib/native-integrations-db";

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

export async function connectNativeIntegrationAction(input: {
  workspaceId: string;
  clientSeatId?: string | null;
  platform: NativePlatform;
  externalAccountId: string;
  mode?: NativeIntegrationMode;
}) {
  const result = await connectNativeIntegration(input);
  revalidatePath(PATH);
  return result;
}

export async function disconnectNativeIntegrationAction(id: string, reason?: string) {
  const result = await softRevokeNativeIntegration(id, reason);
  revalidatePath(PATH);
  return result;
}
