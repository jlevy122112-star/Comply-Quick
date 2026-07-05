import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase Edge Functions run on Deno (remote imports, Deno globals) and are
    // not part of the Next app's TS project.
    "supabase/functions/**",
    // The scanner worker is a standalone Node/Playwright service with its own
    // deploy lifecycle; it is not part of the Next app's TS project.
    "scanner-worker/**",
  ]),
]);

export default eslintConfig;
