"use server";

import { createClient } from "@/lib/supabase/server";
import { shareScan, getScan, markScanEmailed } from "@/lib/scanner/service";
import { sendTransactionalEmail } from "@/lib/email/send";
import { createSystemAuditLog } from "@/lib/audit";
import { getRequestIp } from "@/lib/audit/requests";

export async function shareScanAction(
  scanId: string,
  clientId?: string | null
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ip = await getRequestIp();
  const res = await shareScan(scanId, clientId, { ipAddress: ip });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, url: res.url };
}

export async function emailScanAction(scanId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };
  const ip = await getRequestIp();

  const scan = await getScan(scanId);
  if (!scan) return { ok: false, error: "Scan not found." };
  if (!scan.clientId) return { ok: false, error: "Assign a client before emailing." };

  const { data: client } = await supabase
    .from("agency_clients")
    .select("name, contact_email")
    .eq("id", scan.clientId)
    .single();
  const clientRow = client as { name?: string; contact_email?: string | null } | null;
  if (!clientRow?.contact_email) return { ok: false, error: "Client has no contact email." };

  let shareUrl: string | null = null;
  if (scan.sharedToken) {
    shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/share/scans/${scan.sharedToken}`;
  } else {
    const shared = await shareScan(scanId, scan.clientId, { ipAddress: ip, log: false });
    if (!shared.ok) return { ok: false, error: shared.error };
    shareUrl = shared.url;
  }

  const orgName = (await supabase.from("organizations").select("name").eq("id", scan.organizationId).single()).data as {
    name?: string;
  } | null;
  const fromName = orgName?.name ?? "Comply-Quick";

  const subject = `Compliance scan report for ${scan.url} from ${fromName}`;
  const html = `
    <p>Hi ${clientRow.name ?? "there"},</p>
    <p>${fromName} has shared a compliance scan report for <strong>${scan.url}</strong> with you.</p>
    <p><a href="${shareUrl}" style="color:#4f46e5">View report</a></p>
    <p>—<br>${fromName}</p>
  `;
  const text = `Hi ${clientRow.name ?? "there"},\n\n${fromName} has shared a compliance scan report for "${scan.url}" with you.\n\nView: ${shareUrl}\n\n— ${fromName}`;

  const result = await sendTransactionalEmail({ to: clientRow.contact_email, subject, html, text });
  if (!result.delivered) return { ok: false, error: result.reason ?? "Email could not be sent." };

  await markScanEmailed(scanId);

  await createSystemAuditLog({
    eventType: "SCAN_EMAILED",
    actorType: "USER",
    actorId: user.id,
    organizationId: scan.organizationId,
    targetResource: `scans/${scanId}`,
    ipAddress: ip,
    details: {
      clientId: scan.clientId,
      to: clientRow.contact_email,
      url: scan.url,
      shareUrl: shareUrl ?? undefined,
    },
  });

  return { ok: true };
}
