"use server";

import { revalidatePath } from "next/cache";
import {
  connectNativeIntegration,
  softRevokeNativeIntegration,
  type NativeIntegrationMode,
  type NativePlatform,
} from "@/lib/native-integrations-db";

const PATH = "/dashboard/tools/platforms";

export async function connectCmsIntegrationAction(input: {
  workspaceId: string;
  clientSeatId?: string | null;
  platform: NativePlatform;
  externalAccountId: string;
  mode?: NativeIntegrationMode;
}) {
  const result = await connectNativeIntegration(input);
  revalidatePath(PATH);
  revalidatePath("/dashboard/settings/integrations");
  return result;
}

export async function disconnectCmsIntegrationAction(id: string) {
  const result = await softRevokeNativeIntegration(id, "Disconnected from CMS platform tool");
  revalidatePath(PATH);
  revalidatePath("/dashboard/settings/integrations");
  return result;
}
