import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] ?? "devtest@example.com";

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: "http://localhost:3000/auth/callback?redirect=/dashboard/home" },
});

if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

console.log(data.properties?.action_link ?? "(no link)");
