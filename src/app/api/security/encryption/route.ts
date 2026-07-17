import { NextResponse } from "next/server";
import { getEntitlement } from "@/lib/entitlements";
import { getMyOrgRole, getOrCreateOrganization } from "@/lib/organizations-db";
import { can } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { getTenantEncryptionStatus, rotateTenantKey } from "@/lib/security/tenant-keys";

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };

  const entitlement = await getEntitlement();
  if (!entitlement.isEnterprise) {
    return {
      response: NextResponse.json({ error: "Enterprise encryption is not enabled for this account." }, { status: 403 }),
    };
  }

  const organization = await getOrCreateOrganization();
  if (!organization) return { response: NextResponse.json({ error: "Organization not found." }, { status: 404 }) };

  const role = await getMyOrgRole(organization.id);
  if (!role || !can(role, "org:update")) {
    return {
      response: NextResponse.json(
        { error: "Only organization administrators can manage encryption." },
        { status: 403 }
      ),
    };
  }

  return { organization };
}

export async function GET() {
  try {
    const auth = await authorize();
    if (auth.response) return auth.response;
    const status = await getTenantEncryptionStatus(auth.organization.id);
    return NextResponse.json({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load encryption status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const auth = await authorize();
    if (auth.response) return auth.response;
    const status = await rotateTenantKey(auth.organization.id);
    return NextResponse.json({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not rotate the encryption key.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
