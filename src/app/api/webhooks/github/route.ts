import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGitHubWebhookSecret } from "@/lib/github/app-service";
import { enqueueGitHubScan, getGitHubConnectionById } from "@/lib/github/service";
import {
  parseGitHubPushPayload,
  verifyGitHubWebhookSignature,
  type GitHubPushWebhookPayload,
} from "@/lib/github/webhooks";
import { errorResponse } from "@/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const event = request.headers.get("x-github-event");
    const deliveryId = request.headers.get("x-github-delivery");
    const signature = request.headers.get("x-hub-signature-256");
    const rawBody = await request.text();
    if (!verifyGitHubWebhookSignature(rawBody, signature, getGitHubWebhookSecret())) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (event === "ping") {
      return NextResponse.json({ ok: true, pong: true });
    }

    if (event !== "push") {
      return NextResponse.json({ ok: true, ignored: true, event });
    }

    if (!deliveryId) {
      return NextResponse.json({ ok: false, error: "Missing delivery id" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody || "{}") as GitHubPushWebhookPayload;
    const parsed = parseGitHubPushPayload(payload);
    if (!parsed) {
      return NextResponse.json({ ok: true, ignored: true, reason: "No actionable push payload" });
    }

    const admin = createAdminClient();
    const { data: connectionRow, error: connectionError } = await admin
      .schema("connector")
      .from("connector_connections")
      .select("id")
      .eq("platform", "github")
      .eq("integration_type", "github_app")
      .eq("github_installation_id", parsed.installationId)
      .eq("status", "active")
      .maybeSingle();
    if (connectionError || !connectionRow) {
      return NextResponse.json({ ok: true, ignored: true, reason: "Installation not connected" });
    }

    const connectionId = (connectionRow as { id: string }).id;
    const connection = await getGitHubConnectionById(connectionId);
    if (!connection) {
      return NextResponse.json({ ok: true, ignored: true, reason: "Connection unavailable" });
    }

    const { data: pushEventRow, error: pushEventError } = await admin
      .schema("connector")
      .from("github_push_events")
      .upsert(
        {
          connection_id: connectionId,
          github_installation_id: parsed.installationId,
          delivery_id: deliveryId,
          event_type: event,
          repo_id: parsed.repoId,
          repo_full_name: parsed.repoFullName,
          ref_name: parsed.refName,
          before_sha: parsed.beforeSha,
          after_sha: parsed.headSha,
          pushed_at: parsed.pushedAt,
          sender_login: parsed.senderLogin,
          payload,
        },
        { onConflict: "delivery_id", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();
    if (pushEventError) {
      return NextResponse.json({ ok: false, error: "Could not log push event" }, { status: 500 });
    }

    const duplicate = !pushEventRow;
    if (duplicate) {
      return NextResponse.json({ ok: true, accepted: true, duplicate: true }, { status: 202 });
    }

    await admin
      .schema("connector")
      .from("connector_connections")
      .update({ last_webhook_at: new Date().toISOString() })
      .eq("id", connectionId);

    const queued = await enqueueGitHubScan({
      connectionId,
      installationId: parsed.installationId,
      repoId: parsed.repoId,
      repoFullName: parsed.repoFullName,
      refName: parsed.refName,
      headSha: parsed.headSha,
      pushEventId: (pushEventRow as { id: string }).id,
      enqueueSource: "push",
    });

    return NextResponse.json({ ok: true, accepted: true, duplicate: false, queued }, { status: 202 });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
