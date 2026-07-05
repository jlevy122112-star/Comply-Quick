// Supabase Edge Function (Deno) — Compliance Intelligence weekly cron.
//
// Scheduled once per week. POSTs to the Next.js app's /api/intelligence/run
// endpoint, authenticated with CRON_SECRET. The heavy lifting (re-scan, risk
// diffing, alert creation) lives in the app so this stays a thin trigger.
//
// Deploy:   supabase functions deploy intelligence-weekly --no-verify-jwt
// Schedule: in the Supabase dashboard (Edge Functions → Schedules) set a weekly
//           cron, or via SQL with pg_cron + net.http_post. Required secrets
//           (supabase secrets set): APP_URL, CRON_SECRET.

Deno.serve(async () => {
  const appUrl = Deno.env.get("APP_URL");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!appUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: "APP_URL and CRON_SECRET must be set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${appUrl}/api/intelligence/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cronSecret}` },
    body: JSON.stringify({}),
  });

  const payload = await res.text();
  return new Response(payload, { status: res.status, headers: { "Content-Type": "application/json" } });
});
