#!/usr/bin/env node
// Validates that the environment variables Comply-Quick needs are present and
// look correctly formatted. Does NOT print secret values.
//
// Usage:
//   node scripts/validate-env.mjs
//   node scripts/validate-env.mjs --test-stripe

const groups = [
  {
    name: "Supabase",
    required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    optional: [],
    check: {
      NEXT_PUBLIC_SUPABASE_URL: (v) => v.startsWith("https://"),
      SUPABASE_SERVICE_ROLE_KEY: (v) => v.startsWith("eyJ"),
    },
  },
  {
    name: "App",
    required: ["NEXT_PUBLIC_SITE_URL"],
    optional: ["NEXT_PUBLIC_APP_HOST"],
    check: {
      NEXT_PUBLIC_SITE_URL: (v) => /^https?:\/\//.test(v),
    },
  },
  {
    name: "Stripe core",
    required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    optional: [],
    check: {
      STRIPE_SECRET_KEY: (v) => /^(sk_test_|sk_live_)/.test(v),
      STRIPE_WEBHOOK_SECRET: (v) => v.startsWith("whsec_"),
    },
  },
  {
    name: "Stripe subscription prices",
    required: [
      "STRIPE_PRICE_SOLO_MONTHLY",
      "STRIPE_PRICE_SOLO_ANNUAL",
      "STRIPE_PRICE_AGENCY",
      "STRIPE_PRICE_AGENCY_ANNUAL",
      "STRIPE_PRICE_ENTERPRISE",
      "STRIPE_PRICE_ENTERPRISE_ANNUAL",
    ],
    optional: [],
    check: {
      STRIPE_PRICE_SOLO_MONTHLY: (v) => v.startsWith("price_"),
      STRIPE_PRICE_SOLO_ANNUAL: (v) => v.startsWith("price_"),
      STRIPE_PRICE_AGENCY: (v) => v.startsWith("price_"),
      STRIPE_PRICE_AGENCY_ANNUAL: (v) => v.startsWith("price_"),
      STRIPE_PRICE_ENTERPRISE: (v) => v.startsWith("price_"),
      STRIPE_PRICE_ENTERPRISE_ANNUAL: (v) => v.startsWith("price_"),
    },
  },
  {
    name: "Stripe metered billing",
    required: ["STRIPE_METER_API_CALL", "STRIPE_METER_TEMPLATE_UPLOAD", "STRIPE_METER_EXTRA_SCAN"],
    optional: [],
    check: {},
  },
  {
    name: "Email",
    required: ["NOTIFICATIONS_FROM_EMAIL"],
    optional: ["RESEND_API_KEY"],
    check: {
      NOTIFICATIONS_FROM_EMAIL: (v) => /@/.test(v),
      RESEND_API_KEY: (v) => v.startsWith("re_"),
    },
  },
  {
    name: "Scanner worker",
    required: [],
    optional: ["SCANNER_WORKER_URL", "SCANNER_WORKER_SECRET"],
    check: {
      SCANNER_WORKER_URL: (v) => /^https?:\/\//.test(v),
    },
  },
  {
    name: "GitHub integration",
    required: [],
    optional: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    check: {
      GITHUB_CLIENT_ID: (v) => /^[a-zA-Z0-9]{20}$/.test(v),
      GITHUB_CLIENT_SECRET: (v) => v.length >= 20,
    },
  },
  {
    name: "Cron",
    required: ["CRON_SECRET"],
    optional: [],
    check: {},
  },
  {
    name: "Sentry (optional)",
    required: [],
    optional: ["NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"],
    check: {
      NEXT_PUBLIC_SENTRY_DSN: (v) => v.startsWith("https://"),
      SENTRY_DSN: (v) => v.startsWith("https://"),
      SENTRY_AUTH_TOKEN: (v) => v.startsWith("sntrys_"),
    },
  },
  {
    name: "Analytics (optional)",
    required: [],
    optional: ["NEXT_PUBLIC_GA4_ID", "NEXT_PUBLIC_CLARITY_ID"],
    check: {
      NEXT_PUBLIC_GA4_ID: (v) => v.startsWith("G-"),
      NEXT_PUBLIC_CLARITY_ID: (v) => /^[a-z0-9]{8,12}$/i.test(v),
    },
  },
  {
    name: "AI (optional)",
    required: [],
    optional: ["OPENAI_API_KEY", "OPENAI_MODEL"],
    check: {
      OPENAI_API_KEY: (v) => v.startsWith("sk-"),
    },
  },
  {
    name: "Caching (optional)",
    required: [],
    optional: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    check: {
      UPSTASH_REDIS_REST_URL: (v) => v.startsWith("https://"),
    },
  },
  {
    name: "Cloudflare (optional)",
    required: [],
    optional: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"],
    check: {},
  },
  {
    name: "Vercel automation (optional)",
    required: [],
    optional: ["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID"],
    check: {},
  },
  {
    name: "Single sign-on (optional)",
    required: [],
    optional: ["SSO_PROVIDER_URL"],
    check: {
      SSO_PROVIDER_URL: (v) => v.startsWith("https://"),
    },
  },
  {
    name: "Feature flags (optional)",
    required: [],
    optional: [
      "NEXT_PUBLIC_ENABLE_SPEED_OPTIMIZATIONS",
      "NEXT_PUBLIC_ENABLE_PROFIT_OPTIMIZATIONS",
      "NEXT_PUBLIC_ENABLE_CHURN_SAVE_OFFER",
      "NEXT_PUBLIC_EXPERIMENT_PRICING_V1_FORCE",
    ],
    check: {
      NEXT_PUBLIC_ENABLE_SPEED_OPTIMIZATIONS: (v) => /^(true|false|1|0)$/i.test(v),
      NEXT_PUBLIC_ENABLE_PROFIT_OPTIMIZATIONS: (v) => /^(true|false|1|0)$/i.test(v),
      NEXT_PUBLIC_ENABLE_CHURN_SAVE_OFFER: (v) => /^(true|false|1|0)$/i.test(v),
    },
  },
  {
    name: "SEO / performance (optional)",
    required: [],
    optional: ["NEXT_PUBLIC_GSC_VERIFICATION", "PERF_BUDGET_LANDING_JS_KB"],
    check: {},
  },
  {
    name: "Security (optional)",
    required: [],
    optional: ["CSP_MODE"],
    check: {
      CSP_MODE: (v) => ["report-only", "enforce"].includes(v),
    },
  },
  {
    name: "Admin notifications (optional)",
    required: [],
    optional: ["MARKETPLACE_ADMIN_EMAILS", "LEGAL_REVIEW_ADMIN_EMAILS", "PMF_ADMIN_EMAILS"],
    check: {
      MARKETPLACE_ADMIN_EMAILS: (v) => /@/.test(v),
      LEGAL_REVIEW_ADMIN_EMAILS: (v) => /@/.test(v),
      PMF_ADMIN_EMAILS: (v) => /@/.test(v),
    },
  },
  {
    name: "Leads export (optional)",
    required: [],
    optional: ["LEADS_EXPORT_TOKEN"],
    check: {},
  },
  {
    name: "Logging (optional)",
    required: [],
    optional: ["LOG_LEVEL"],
    check: {
      LOG_LEVEL: (v) => ["debug", "info", "warn", "error"].includes(v),
    },
  },
  {
    name: "Testing / scripts (optional)",
    required: [],
    optional: [
      "SMOKE_BASE_URL",
      "SMOKE_PORT",
      "SMOKE_BUDGET_MS",
      "PLAYWRIGHT_BASE_URL",
      "PLAYWRIGHT_TEST_EMAIL",
      "PLAYWRIGHT_TEST_PASSWORD",
    ],
    check: {
      SMOKE_BASE_URL: (v) => /^https?:\/\//.test(v),
      PLAYWRIGHT_BASE_URL: (v) => /^https?:\/\//.test(v),
      PLAYWRIGHT_TEST_EMAIL: (v) => /@/.test(v),
    },
  },
];

let failed = false;

for (const group of groups) {
  console.log(`\n${group.name}`);
  const vars = [...group.required, ...group.optional];
  for (const key of vars) {
    const value = process.env[key];
    const isRequired = group.required.includes(key);
    const check = group.check[key];

    if (!value || value.trim() === "" || value.includes("...")) {
      if (isRequired) {
        console.log(`  ❌ ${key} — missing`);
        failed = true;
      } else {
        console.log(`  ⚠️  ${key} — not set (optional)`);
      }
      continue;
    }

    if (check && !check(value)) {
      console.log(`  ⚠️  ${key} — set but format looks wrong`);
      if (isRequired) failed = true;
      continue;
    }

    console.log(`  ✅ ${key} — set`);
  }
}

if (process.argv.includes("--test-stripe")) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log("\nSkipping Stripe connectivity test: STRIPE_SECRET_KEY is not set.");
  } else {
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.list({ limit: 1 });
      console.log(`\n✅ Stripe connectivity OK (${customer.data.length} customers returned)`);
    } catch (err) {
      console.log(`\n❌ Stripe connectivity failed: ${err.message}`);
      failed = true;
    }
  }
}

console.log("");
if (failed) {
  console.log("Some required environment variables are missing or invalid.");
  process.exit(1);
} else {
  console.log("All required environment variables look good.");
  process.exit(0);
}
