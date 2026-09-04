import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMyOrgRole } from "@/lib/organizations-db";
import { can } from "@/lib/rbac";
import { generateKey, hashKey, keyPrefixOf } from "@/lib/api/keys";
import { mapWorkspaceApiKey, revokeWorkspaceApiKey } from "@/lib/workspace-api-keys";
import { createRateLimiter, enforceRateLimit, errorResponse, getClientKey } from "@/services";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

const KEY_COLUMNS = "id,name,key_prefix,last_used_at,revoked_at,created_at";

async function authorizeWorkspace(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, access: "unauthenticated" as const };
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, organization_id")
    .eq("id", workspaceId)
    .maybeSingle();
  const organizationId = (workspace as { id: string; organization_id: string } | null)?.organization_id ?? null;
  const activeOrganizationId = await getActiveOrganizationId();
  if (organizationId && activeOrganizationId && organizationId !== activeOrganizationId) {
    return { supabase, user, role: null, organizationId, access: "forbidden" as const };
  }
  const role = organizationId ? await getMyOrgRole(organizationId) : null;
  return { supabase, user, role, organizationId, access: role ? ("ok" as const) : ("not_found" as const) };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (err) {
    return errorResponse(err);
  }

  const { id } = await context.params;
  const { supabase, user, role, organizationId, access } = await authorizeWorkspace(id);
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  if (access === "forbidden") return NextResponse.json({ error: "wrong_workspace_context" }, { status: 403 });
  if (!role || !organizationId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabase
    .from("client_api_keys")
    .select(KEY_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("workspace_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "list_failed" }, { status: 500 });
  return NextResponse.json({
    keys: (data ?? []).map((row) => mapWorkspaceApiKey(row as Record<string, unknown>)),
    role,
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (err) {
    return errorResponse(err);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const payload = (body ?? {}) as Record<string, unknown>;

  const { id } = await context.params;
  const { supabase, user, role, organizationId, access } = await authorizeWorkspace(id);
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  if (access === "forbidden") return NextResponse.json({ error: "wrong_workspace_context" }, { status: 403 });
  if (!role || !organizationId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!can(role, "org:update")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rotate = payload.rotate === true;
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 80) : "Primary";
  const key = generateKey();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("client_api_keys")
    .insert({
      organization_id: organizationId,
      workspace_id: id,
      created_by: user.id,
      name,
      key_prefix: keyPrefixOf(key),
      key_hash: hashKey(key),
      updated_at: now,
    })
    .select(KEY_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: "create_failed" }, { status: 500 });

  if (rotate) {
    const { error: revokeError } = await supabase
      .from("client_api_keys")
      .update({ revoked_at: now, updated_at: now })
      .eq("organization_id", organizationId)
      .eq("workspace_id", id)
      .neq("id", String((data as Record<string, unknown>).id))
      .is("revoked_at", null);
    if (revokeError) return NextResponse.json({ error: "rotate_failed" }, { status: 500 });
  }

  return NextResponse.json({ key, record: mapWorkspaceApiKey(data as Record<string, unknown>) }, { status: 201 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (err) {
    return errorResponse(err);
  }

  const { id } = await context.params;
  const keyId = request.nextUrl.searchParams.get("keyId");
  if (!keyId) return NextResponse.json({ error: "missing_key_id" }, { status: 400 });

  const { user, role, access } = await authorizeWorkspace(id);
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  if (access === "forbidden") return NextResponse.json({ error: "wrong_workspace_context" }, { status: 403 });
  if (!role) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!can(role, "org:update")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const ok = await revokeWorkspaceApiKey(id, keyId);
  if (!ok) return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
