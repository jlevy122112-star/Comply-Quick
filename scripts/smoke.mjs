// End-to-end smoke + load-time gate.
//
// Boots the production server (`next start`) and asserts that every public,
// user-facing screen renders correctly AND within a load-time budget. Protected
// dashboard routes must redirect to /login (fast). The process exits non-zero if
// any screen 500s, fails to render its expected marker, or exceeds its budget —
// so CI fails when a screen does not load properly and quickly.
//
// Usage: node scripts/smoke.mjs
// Env:
//   SMOKE_BASE_URL   test an already-running server instead of spawning one
//   SMOKE_PORT       port to boot next start on (default 3210)
//   SMOKE_BUDGET_MS  per-screen load budget in ms (default 3000)

import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.SMOKE_PORT ?? 3210);
const BUDGET_MS = Number(process.env.SMOKE_BUDGET_MS ?? 3000);
const EXTERNAL = process.env.SMOKE_BASE_URL;
const BASE = EXTERNAL ?? `http://localhost:${PORT}`;

// Public, user-facing screens: must return 200, render their marker, be fast.
const PUBLIC_SCREENS = [
  { path: "/", marker: "Comply" },
  { path: "/login", marker: "<html" },
  { path: "/blog", marker: "<html" },
  { path: "/legal/terms", marker: "<html" },
];

// Protected screens: must redirect (auth gate), never 200 or 500.
const PROTECTED_SCREENS = [
  "/dashboard",
  "/dashboard/home",
  "/dashboard/assistant",
  "/dashboard/tools/cookie-banner",
  "/dashboard/tools/dpa",
  "/dashboard/tools/subprocessors",
  "/dashboard/calendar",
  "/dashboard/marketplace",
  "/dashboard/agency",
  "/dashboard/api",
  "/dashboard/partners",
  "/dashboard/legal-review",
];

const failures = [];

async function timedFetch(path, redirect) {
  const start = performance.now();
  const res = await fetch(BASE + path, { redirect });
  // Drain the body so timing reflects full transfer, not just headers.
  await res.text();
  return { res, ms: Math.round(performance.now() - start) };
}

async function checkPublicWithMarker({ path, marker }) {
  const start = performance.now();
  let res;
  try {
    res = await fetch(BASE + path, { redirect: "follow" });
  } catch (err) {
    failures.push(`${path} → request failed: ${err.message}`);
    return;
  }
  // Drain the body before measuring so the budget reflects full transfer.
  const body = await res.text();
  const ms = Math.round(performance.now() - start);
  if (res.status !== 200) {
    failures.push(`${path} → HTTP ${res.status} (expected 200)`);
    return;
  }
  if (ms > BUDGET_MS) {
    failures.push(`${path} → loaded in ${ms}ms (budget ${BUDGET_MS}ms)`);
    return;
  }
  if (marker && !body.includes(marker)) {
    failures.push(`${path} → rendered but missing marker "${marker}"`);
    return;
  }
  console.log(`  ✓ ${path} — 200 in ${ms}ms`);
}

async function checkProtected(path) {
  try {
    const { res, ms } = await timedFetch(path, "manual");
    const isRedirect = res.status >= 300 && res.status < 400;
    const loc = res.headers.get("location") ?? "";
    if (res.status >= 500) {
      failures.push(`${path} → HTTP ${res.status} (server error)`);
    } else if (!isRedirect) {
      failures.push(`${path} → HTTP ${res.status} (expected auth redirect)`);
    } else if (!loc.includes("/login")) {
      failures.push(`${path} → redirected to "${loc}" (expected /login)`);
    } else if (ms > BUDGET_MS) {
      failures.push(`${path} → redirect took ${ms}ms (budget ${BUDGET_MS}ms)`);
    } else {
      console.log(`  ✓ ${path} — ${res.status} → ${loc} in ${ms}ms`);
    }
  } catch (err) {
    failures.push(`${path} → request failed: ${err.message}`);
  }
}

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + "/login", { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  return false;
}

let server = null;

// Kill the whole spawned process tree — `next start` runs as a grandchild of the
// npx wrapper, so a plain server.kill() would orphan the real server locally.
function stopServer() {
  if (!server || server.killed) return;
  try {
    if (process.platform === "win32") {
      // Synchronous so the tree is gone before we process.exit().
      spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"]);
    } else {
      process.kill(-server.pid, "SIGTERM");
    }
  } catch {
    server.kill();
  }
}

async function main() {
  if (!EXTERNAL) {
    console.log(`Starting next start on :${PORT} …`);
    server = spawn("npx", ["next", "start", "-p", String(PORT)], {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
      },
      stdio: "inherit",
      shell: process.platform === "win32",
      // Own process group on POSIX so we can signal the whole tree.
      detached: process.platform !== "win32",
    });
    const up = await waitForServer();
    if (!up) {
      console.error("✗ server did not become ready in time");
      stopServer();
      process.exit(1);
    }
  }

  console.log(`\nLoad-time budget: ${BUDGET_MS}ms per screen\n`);
  console.log("Public screens:");
  for (const s of PUBLIC_SCREENS) await checkPublicWithMarker(s);
  console.log("\nProtected screens (must gate to /login):");
  for (const p of PROTECTED_SCREENS) await checkProtected(p);

  stopServer();

  if (failures.length) {
    console.error(`\n✗ ${failures.length} screen check(s) failed:`);
    for (const f of failures) console.error("   - " + f);
    process.exit(1);
  }
  console.log(`\n✓ All ${PUBLIC_SCREENS.length + PROTECTED_SCREENS.length} screens loaded properly within budget.`);
  process.exit(0);
}

// Clean up the spawned server if we're interrupted (e.g. Ctrl+C locally).
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopServer();
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("smoke run crashed:", err);
  stopServer();
  process.exit(1);
});
