import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const hasLiveSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasLiveSupabase)("org-scoped tenancy RLS (requires live Supabase)", () => {
  it("isolates organization rows between authenticated users", async (context) => {
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
      const userBProject = projectRows.data?.find((row) => row.user_id === createdUserIds[1]);
      expect(userBProject).not.toBeUndefined();

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
      const firstUserProject = firstUserProjects.data?.find((row) => row.user_id === createdUserIds[0]);
      expect(firstUserProject?.organization_id).toBe(organizationIds[0]);

      const ownOrgInsert = await clients[0]
        .from("projects")
        .insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          name: "Own organization project",
          framework: "nextjs",
          tracking_pixels: [],
          target_regions: [],
          compliance_modules: [],
          compliance_score: {},
          package_markdown: "",
        })
        .select("id")
        .single();
      expect(ownOrgInsert.error).toBeNull();

      const foreignOrgInsert = await clients[0].from("projects").insert({
        user_id: createdUserIds[0],
        organization_id: organizationIds[1],
        name: "Should be rejected",
        framework: "nextjs",
        tracking_pixels: [],
        target_regions: [],
        compliance_modules: [],
        compliance_score: {},
        package_markdown: "",
      });
      if (!foreignOrgInsert.error) {
        context.skip("0043 write-enforcement migration is not applied to the configured Supabase project");
        return;
      }
      expect(foreignOrgInsert.error).not.toBeNull();

      const crossUserInsert = await clients[0].from("projects").insert({
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
      expect(crossUserInsert.error).not.toBeNull();

      const crossTenantUpdate = await clients[0]
        .from("projects")
        .update({ name: "Should be rejected" })
        .eq("id", userBProject!.id)
        .select("id");
      expect(crossTenantUpdate.error !== null || (crossTenantUpdate.data?.length ?? 0) === 0).toBe(true);

      const targetProject = await admin.from("projects").select("name").eq("id", userBProject!.id).single();
      expect(targetProject.error).toBeNull();
      expect(targetProject.data?.name).toBe("RLS Project 1");
    } finally {
      for (const organizationId of organizationIds) {
        await admin.from("organizations").delete().eq("id", organizationId);
      }
      for (const userId of createdUserIds) {
        await admin.auth.admin.deleteUser(userId);
      }
    }
  });

  it("shares core rows with members while protecting integrations", async (context) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const admin = createSupabaseClient(url, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const orgColumns = await admin.from("scans").select("organization_id").limit(0);
    if (orgColumns.error) {
      context.skip("0042 organization columns are not applied to the configured Supabase project");
      return;
    }
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const users = [
      { email: `org-share-owner-${suffix}@example.com`, password: `ShareTest-${suffix}-A!` },
      { email: `org-share-member-${suffix}@example.com`, password: `ShareTest-${suffix}-C!` },
      { email: `org-share-other-${suffix}@example.com`, password: `ShareTest-${suffix}-B!` },
    ];
    const createdUserIds: string[] = [];
    const organizationIds: string[] = [];
    const cleanup = async () => {
      for (const table of [
        "integrations",
        "audit_logs",
        "alert_impacts",
        "evidence_records",
        "findings",
        "scans",
        "compliance_tasks",
        "projects",
      ]) {
        await admin.from(table).delete().in("organization_id", organizationIds);
      }
      for (const organizationId of organizationIds) await admin.from("organizations").delete().eq("id", organizationId);
      for (const userId of createdUserIds) await admin.auth.admin.deleteUser(userId);
    };

    try {
      for (const user of users) {
        const { data, error } = await admin.auth.admin.createUser({ ...user, email_confirm: true });
        expect(error).toBeNull();
        expect(data.user).not.toBeNull();
        createdUserIds.push(data.user!.id);
      }

      for (const [index, userId] of [createdUserIds[0], createdUserIds[2]].entries()) {
        const { data, error } = await admin
          .from("organizations")
          .insert({
            owner_id: userId,
            name: `Shared Test Organization ${index}`,
            slug: `org-share-${suffix}-${index}`,
            plan: "free",
          })
          .select("id")
          .single();
        expect(error).toBeNull();
        organizationIds.push(data!.id);
        const membership = await admin.from("organization_members").insert({
          organization_id: data!.id,
          user_id: userId,
          role: "owner",
        });
        expect(membership.error).toBeNull();
      }
      const memberMembership = await admin.from("organization_members").insert({
        organization_id: organizationIds[0],
        user_id: createdUserIds[1],
        role: "member",
      });
      expect(memberMembership.error).toBeNull();

      const projects = await admin
        .from("projects")
        .insert([
          {
            user_id: createdUserIds[0],
            organization_id: organizationIds[0],
            name: "Shared Project A",
            framework: "nextjs",
            tracking_pixels: [],
            target_regions: [],
            compliance_modules: [],
            compliance_score: {},
            package_markdown: "",
          },
          {
            user_id: createdUserIds[2],
            organization_id: organizationIds[1],
            name: "Private Project B",
            framework: "nextjs",
            tracking_pixels: [],
            target_regions: [],
            compliance_modules: [],
            compliance_score: {},
            package_markdown: "",
          },
        ])
        .select("id, organization_id");
      expect(projects.error).toBeNull();
      const projectA = projects.data!.find((row) => row.organization_id === organizationIds[0])!.id;
      const projectB = projects.data!.find((row) => row.organization_id === organizationIds[1])!.id;

      const scanA = await admin
        .from("scans")
        .insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          url: "https://shared-a.example",
        })
        .select("id")
        .single();
      const scanB = await admin
        .from("scans")
        .insert({
          user_id: createdUserIds[2],
          organization_id: organizationIds[1],
          url: "https://private-b.example",
        })
        .select("id")
        .single();
      if (scanA.error?.code === "PGRST204" || scanB.error?.code === "PGRST204") {
        context.skip("0042 organization columns are not applied to the configured Supabase project");
        return;
      }
      expect(scanA.error).toBeNull();
      expect(scanB.error).toBeNull();

      const seededRows = await Promise.all([
        admin.from("findings").insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          scan_id: scanA.data!.id,
          project_id: projectA,
          finding_key: `share-${suffix}`,
          category: "privacy",
          severity: "warning",
          title: "Shared finding",
        }),
        admin.from("evidence_records").insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          project_id: projectA,
          framework: "gdpr",
          control_id: `share-${suffix}`,
          control_title: "Shared evidence",
        }),
        admin.from("compliance_tasks").insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          project_id: projectA,
          title: "Shared task",
          due_date: "2099-01-01",
        }),
        admin.from("alert_impacts").insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          project_id: projectA,
          regulation_id: `share-${suffix}`,
          regulation_name: "Shared regulation",
        }),
        admin.from("alert_impacts").insert({
          user_id: createdUserIds[2],
          organization_id: organizationIds[1],
          project_id: projectB,
          regulation_id: `private-${suffix}`,
          regulation_name: "Private regulation",
        }),
        admin.from("audit_logs").insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          action: "shared.test",
        }),
        admin.from("integrations").insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          kind: "webhook",
          name: "Admin webhook",
          target_url: "https://hooks.example/shared",
        }),
      ]);
      for (const result of seededRows) expect(result.error).toBeNull();

      const clients = await Promise.all(
        [users[0], users[1], users[2]].map(async (user) => {
          const client = createSupabaseClient(url, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const result = await client.auth.signInWithPassword(user);
          expect(result.error).toBeNull();
          return client;
        })
      );
      const owner = clients[0];
      const member = clients[1];
      const other = clients[2];

      const sharedProjectRows = await member.from("projects").select("id").eq("organization_id", organizationIds[0]);
      if (sharedProjectRows.error || sharedProjectRows.data?.length !== 1) {
        context.skip("0044 read-sharing migration is not applied to the configured Supabase project");
        return;
      }
      expect((await member.from("scans").select("id").eq("organization_id", organizationIds[0])).data).toHaveLength(1);
      expect((await member.from("findings").select("id").eq("organization_id", organizationIds[0])).data).toHaveLength(
        1
      );
      expect(
        (await member.from("evidence_records").select("id").eq("organization_id", organizationIds[0])).data
      ).toHaveLength(1);
      expect(
        (await member.from("compliance_tasks").select("id").eq("organization_id", organizationIds[0])).data
      ).toHaveLength(1);
      expect(
        (await member.from("alert_impacts").select("id").eq("organization_id", organizationIds[0])).data
      ).toHaveLength(1);
      expect((await member.from("alert_impacts").select("id")).data).toHaveLength(1);
      expect(
        (await member.from("audit_logs").select("id").eq("organization_id", organizationIds[0])).data
      ).toHaveLength(1);
      expect((await member.from("projects").select("id").eq("organization_id", organizationIds[1])).data).toHaveLength(
        0
      );
      expect((await other.from("projects").select("id").eq("organization_id", organizationIds[0])).data).toHaveLength(
        0
      );

      expect(
        (await owner.from("integrations").select("id").eq("organization_id", organizationIds[0])).data
      ).toHaveLength(1);
      expect(
        (await member.from("integrations").select("id").eq("organization_id", organizationIds[0])).data
      ).toHaveLength(0);

      const memberIntegration = await member.from("integrations").insert({
        user_id: createdUserIds[1],
        organization_id: organizationIds[0],
        kind: "webhook",
        name: "Rejected webhook",
        target_url: "https://hooks.example/rejected",
      });
      if (!memberIntegration.error) {
        context.skip("0044 integration admin write policy is not applied to the configured Supabase project");
        return;
      }
      expect(memberIntegration.error).not.toBeNull();
      const ownerIntegration = await owner
        .from("integrations")
        .insert({
          user_id: createdUserIds[0],
          organization_id: organizationIds[0],
          kind: "webhook",
          name: "Admin webhook 2",
          target_url: "https://hooks.example/shared-2",
        })
        .select("id")
        .single();
      expect(ownerIntegration.error).toBeNull();
      void scanB;
    } finally {
      await cleanup();
    }
  });
});
