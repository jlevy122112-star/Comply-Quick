#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROUTE_STATS_PATH = path.join(ROOT, ".next", "diagnostics", "route-bundle-stats.json");
const LANDING_BUDGET_KB = Number(process.env.PERF_BUDGET_LANDING_JS_KB ?? "1000");

function fail(message) {
  console.error(`[perf-budget] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(ROUTE_STATS_PATH)) {
  fail("Missing .next/diagnostics/route-bundle-stats.json. Run `npm run build` before `npm run perf:budget`.");
}

const routeStats = JSON.parse(fs.readFileSync(ROUTE_STATS_PATH, "utf8"));
if (!Array.isArray(routeStats)) {
  fail("Unexpected format in route-bundle-stats.json.");
}

const landing = routeStats.find((entry) => entry?.route === "/");
if (!landing || typeof landing.firstLoadUncompressedJsBytes !== "number") {
  fail("Could not resolve landing route bundle size from route-bundle-stats.json.");
}

const totalBytes = landing.firstLoadUncompressedJsBytes;
const totalKb = totalBytes / 1024;
console.log(`[perf-budget] Landing JS payload: ${totalKb.toFixed(1)} KB (budget ${LANDING_BUDGET_KB} KB)`);

if (totalKb > LANDING_BUDGET_KB) {
  fail(`Landing JS payload exceeded budget by ${(totalKb - LANDING_BUDGET_KB).toFixed(1)} KB.`);
}

console.log("[perf-budget] PASS");
