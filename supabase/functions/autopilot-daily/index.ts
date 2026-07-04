// Supabase Edge Function (Deno) — Compliance Autopilot daily cron.
//
// Scheduled once per day. Assembles the current regulation feed and POSTs it to
// the Next.js app's /api/autopilot/run endpoint, authenticated with CRON_SECRET.
// The heavy lifting (diffing, regeneration, notifications) lives in the app so
// this function stays a thin, deployable trigger.
//
// Deploy:   supabase functions deploy autopilot-daily --no-verify-jwt
// Schedule: in the Supabase dashboard (Edge Functions → Schedules) set a daily
//           cron, or via SQL with pg_cron + net.http_post. Required secrets
//           (supabase secrets set): APP_URL, CRON_SECRET, plus REGULATION_FEED_URL
//           if the feed is fetched remotely.
//
// deno-lint-ignore-file no-explicit-any

interface RegulationUpdate {
  id: string;
  name: string;
  region: string;
  content: string;
  changeNote?: string;
  sourceUrl?: string;
}

// Fetches the regulation feed. Replace REGULATION_FEED_URL with the curated
// source; falls back to an empty feed so a misconfiguration is a no-op, not an error.
async function loadRegulationFeed(): Promise<RegulationUpdate[]> {
  const feedUrl = Deno.env.get("REGULATION_FEED_URL");
  if (!feedUrl) return [];
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`Regulation feed fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.updates) ? data.updates : [];
}

Deno.serve(async () => {
  const appUrl = Deno.env.get("APP_URL");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!appUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: "APP_URL and CRON_SECRET must be set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updates = await loadRegulationFeed();
  if (updates.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: "empty feed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${appUrl}/api/autopilot/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cronSecret}` },
    body: JSON.stringify({ updates }),
  });

  const payload = await res.text();
  return new Response(payload, { status: res.status, headers: { "Content-Type": "application/json" } });
});
