import { NextResponse } from "next/server";
import type { ThemePalette } from "@/lib/organizations";
import { getProjectTenantScope } from "@/lib/projects-db";
import { getWorkspaceData } from "@/lib/workspace/data";
import { buildScanExportFile } from "@/lib/workspace/scan-exports";
import { buildScanTimeline } from "@/lib/workspace/scan-results";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceDeliverableBranding } from "@/lib/workspace/branding";

export async function GET(request: Request, context: { params: Promise<{ id: string; scanId: string }> }) {
  const { id, scanId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format");
  if (format !== "pdf" && format !== "txt") {
    return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
  }

  const scope = await getProjectTenantScope(id);
  if (!scope) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const data = await getWorkspaceData(id);
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const scan = data.scans.find((item) => item.id === scanId);
  if (!scan) return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  if (scan.projectId && scan.projectId !== id) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const { data: org } =
    scope.organizationId === null
      ? { data: null }
      : await supabase
          .from("organizations")
          .select("name, logo_url, primary_color, theme_palette, support_email")
          .eq("id", scope.organizationId)
          .maybeSingle();

  const branding = resolveWorkspaceDeliverableBranding({
    workspace: data.workspace
      ? {
          name: data.workspace.name,
          logoUrl: data.workspace.logoUrl,
          primaryColor: data.workspace.primaryColor,
          themePalette: data.workspace.themePalette,
          footerText: data.workspace.footerText,
        }
      : null,
    organization: org
      ? {
          name: String((org as { name?: string }).name ?? "Comply-Quick"),
          logoUrl: ((org as { logo_url?: string | null }).logo_url ?? null) as string | null,
          primaryColor: String((org as { primary_color?: string | null }).primary_color ?? "#4f46e5"),
          themePalette: ((org as { theme_palette?: ThemePalette }).theme_palette ?? "indigo") as ThemePalette,
          supportEmail: ((org as { support_email?: string | null }).support_email ?? null) as string | null,
        }
      : null,
  });

  const [timelineItem] = buildScanTimeline([scan]);

  const file = buildScanExportFile(format, {
    projectId: data.project.id,
    projectName: data.project.name,
    generatedAt: new Date().toISOString(),
    scan,
    timelineItem,
    branding,
  });
  const body =
    typeof file.content === "string"
      ? file.content
      : new Blob([new Uint8Array(file.content)], { type: file.contentType });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.fileName}"`,
      "x-cq-export-message": file.message,
    },
  });
}
