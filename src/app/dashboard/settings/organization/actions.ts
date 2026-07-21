"use server";

import { revalidatePath } from "next/cache";
import { can, isRole, assignableRoles, type Permission, type Role } from "@/lib/rbac";
import {
  getMyOrgRole,
  updateOrganization,
  addOrgMemberByEmail,
  updateOrgMemberRole,
  removeOrgMember,
  getOrganization,
  createChildOrganization,
  moveOrganization,
} from "@/lib/organizations-db";
import { setFeatureFlag, type FeatureFlag } from "@/lib/feature-flags";
import { createWorkspace, renameWorkspace, deleteWorkspace } from "@/lib/workspaces-db";
import { createSsoConnection, setSsoEnabled, deleteSsoConnection, type SsoProtocol } from "@/lib/sso-db";
import { createScimToken, revokeScimToken } from "@/lib/scim/tokens";

const PATH = "/dashboard/settings/organization";

type Denied = { ok: false; error: string };
type Authorized = { ok: true; role: Role };

/** Resolve the caller's role in `orgId` and require `permission`. */
async function authorize(orgId: string, permission: Permission): Promise<Authorized | Denied> {
  const role = await getMyOrgRole(orgId);
  if (!role) return { ok: false, error: "You are not a member of this organization." };
  if (!can(role, permission)) return { ok: false, error: "You don't have permission to do that." };
  return { ok: true, role };
}

export async function updateOrgAction(
  orgId: string,
  patch: { name?: string; plan?: "free" | "team" | "enterprise" }
): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "org:update");
  if (!gate.ok) return gate;
  const ok = await updateOrganization(orgId, patch);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not update the organization." };
}

export async function addMemberAction(orgId: string, email: string, role: string): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "member:invite");
  if (!gate.ok) return gate;
  if (!isRole(role) || role === "owner") return { ok: false, error: "Invalid role." };
  if (!assignableRoles(gate.role).includes(role)) {
    return { ok: false, error: "You can't assign a role above your own." };
  }
  const res = await addOrgMemberByEmail(orgId, email, role);
  revalidatePath(PATH);
  return res;
}

export async function updateMemberRoleAction(
  orgId: string,
  memberId: string,
  role: string
): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "member:role");
  if (!gate.ok) return gate;
  if (!isRole(role) || role === "owner") return { ok: false, error: "Invalid role." };
  if (!assignableRoles(gate.role).includes(role)) {
    return { ok: false, error: "You can't assign a role above your own." };
  }
  const ok = await updateOrgMemberRole(memberId, role);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not change the role." };
}

export async function removeMemberAction(orgId: string, memberId: string): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "member:remove");
  if (!gate.ok) return gate;
  const ok = await removeOrgMember(memberId);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not remove the member." };
}

export async function createWorkspaceAction(orgId: string, name: string): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "workspace:create");
  if (!gate.ok) return gate;
  const res = await createWorkspace(orgId, name);
  revalidatePath(PATH);
  return res.ok ? { ok: true } : res;
}

export async function renameWorkspaceAction(orgId: string, id: string, name: string): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "workspace:update");
  if (!gate.ok) return gate;
  const ok = await renameWorkspace(id, name);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not rename the workspace." };
}

export async function deleteWorkspaceAction(orgId: string, id: string): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "workspace:delete");
  if (!gate.ok) return gate;
  const ok = await deleteWorkspace(id);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not delete the workspace." };
}

export async function createSsoAction(
  orgId: string,
  input: { displayName: string; protocol: SsoProtocol; emailDomain: string; metadataUrl?: string }
): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "sso:manage");
  if (!gate.ok) return gate;
  const res = await createSsoConnection(orgId, input);
  revalidatePath(PATH);
  return res.ok ? { ok: true } : res;
}

export async function setSsoEnabledAction(orgId: string, id: string, enabled: boolean): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "sso:manage");
  if (!gate.ok) return gate;
  const ok = await setSsoEnabled(id, enabled);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not update the connection." };
}

export async function deleteSsoAction(orgId: string, id: string): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "sso:manage");
  if (!gate.ok) return gate;
  const ok = await deleteSsoConnection(id);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not delete the connection." };
}

/** Issues a SCIM bearer token. Returns the plaintext token (shown once). */
export async function createScimTokenAction(
  orgId: string,
  name: string
): Promise<{ ok: true; token: string } | Denied> {
  const gate = await authorize(orgId, "scim:manage");
  if (!gate.ok) return gate;
  try {
    const { token } = await createScimToken(orgId, name);
    revalidatePath(PATH);
    return { ok: true, token };
  } catch {
    return { ok: false, error: "Could not create the SCIM token." };
  }
}

export async function revokeScimTokenAction(orgId: string, id: string): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "scim:manage");
  if (!gate.ok) return gate;
  const ok = await revokeScimToken(orgId, id);
  revalidatePath(PATH);
  return ok ? { ok: true } : { ok: false, error: "Could not revoke the token." };
}

export async function createChildOrganizationAction(
  parentId: string,
  name: string
): Promise<{ ok: true } | Denied> {
  const gate = await authorize(parentId, "org:update");
  if (!gate.ok) return gate;
  const parent = await getOrganization(parentId);
  if (!parent || parent.plan !== "enterprise") {
    return { ok: false, error: "Sub-organizations require an Enterprise plan." };
  }
  const res = await createChildOrganization(parentId, name, parent.plan);
  revalidatePath(PATH);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function moveOrganizationAction(
  orgId: string,
  newParentId: string | null
): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "org:update");
  if (!gate.ok) return gate;
  if (newParentId !== null) {
    const parentGate = await authorize(newParentId, "org:update");
    if (!parentGate.ok) return parentGate;
    const parent = await getOrganization(newParentId);
    if (!parent || parent.plan !== "enterprise") {
      return { ok: false, error: "Only Enterprise organizations can be parents." };
    }
  }
  const res = await moveOrganization(orgId, newParentId);
  revalidatePath(PATH);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function setFeatureFlagAction(
  orgId: string,
  flag: FeatureFlag,
  enabled: boolean
): Promise<{ ok: true } | Denied> {
  const gate = await authorize(orgId, "org:update");
  if (!gate.ok) return gate;
  const res = await setFeatureFlag(orgId, flag, enabled);
  revalidatePath(PATH);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
