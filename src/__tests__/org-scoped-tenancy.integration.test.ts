import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const hasLiveSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasLiveSupabase)("org-scoped tenancy RLS (requires live Supabase)", () => {
  it("isolates organization rows between authenticated users", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const admin = createSupabaseClient(url, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const users = [
      { email: `org-rls-a-${suffix}@example.com`, password: `RlsTest-${suffix}-A!` },
      { email: `org-rls-b-${suffix}@example.com`, password: `RlsTest-${suffix}-B!` },
    ];
    const createdUserIds: string[] = [];
    const organizationIds: string[] = [];

    try {
      for (const user of users) {
        const { data, error } = await admin.auth.admin.createUser({ ...user, email_confirm: true });
        expect(error).toBeNull();
        expect(data.user).not.toBeNull();
        createdUserIds.push(data.user!.id);
      }

      for (const [index, userId] of createdUserIds.entries()) {
        const { data, error } = await admin
          .from("organizations")
          .insert({
            owner_id: userId,
            name: `RLS Test Organization ${index}`,
            slug: `org-rls-${suffix}-${index}`,
            plan: "free",
          })
          .select("id")
          .single();
        expect(error).toBeNull();
        expect(data?.id).toBeTypeOf("string");
        organizationIds.push(data!.id);

        const membership = await admin.from("organization_members").insert({
          organization_id: data!.id,
          user_id: userId,
          role: "owner",
        });
        expect(membership.error).toBeNull();
      }

      const projectRows = await admin
        .from("projects")
        .insert(
          createdUserIds.map((userId, index) => ({
            user_id: userId,
            organization_id: organizationIds[index],
            name: `RLS Project ${index}`,
            framework: "nextjs",
            tracking_pixels: [],
            target_regions: [],
            compliance_modules: [],
            compliance_score: {},
            package_markdown: "",
          }))
        )
        .select("id, user_id, organization_id");
      expect(projectRows.error).toBeNull();

      const clients = await Promise.all(
        users.map(async (user) => {
          const client = createSupabaseClient(url, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const result = await client.auth.signInWithPassword(user);
          expect(result.error).toBeNull();
          return client;
        })
      );

      const firstUserProjects = await clients[0].from("projects").select("id, user_id, organization_id");
      expect(firstUserProjects.error).toBeNull();
      expect(firstUserProjects.data).toHaveLength(1);
      expect(firstUserProjects.data?.[0].organization_id).toBe(organizationIds[0]);

      const crossTenantInsert = await clients[0].from("projects").insert({
        user_id: createdUserIds[1],
        organization_id: organizationIds[1],
        name: "Should be rejected",
        framework: "nextjs",
        tracking_pixels: [],
        target_regions: [],
        compliance_modules: [],
        compliance_score: {},
        package_markdown: "",
      });
      expect(crossTenantInsert.error).not.toBeNull();

      const crossTenantUpdate = await clients[0]
        .from("projects")
        .update({ name: "Should be rejected" })
        .eq("id", projectRows.data?.[1]?.id)
        .select("id")
        .single();
      expect(crossTenantUpdate.error).not.toBeNull();
    } finally {
      for (const organizationId of organizationIds) {
        await admin.from("organizations").delete().eq("id", organizationId);
      }
      for (const userId of createdUserIds) {
        await admin.auth.admin.deleteUser(userId);
      }
    }
  });
});
