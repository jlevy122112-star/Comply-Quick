"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { isValidTotpCode, normalizeTotpCode } from "@/lib/auth/mfa";

/** Only allow same-origin, absolute internal paths as a post-challenge target. */
function safeInternalPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard/home";
  return raw;
}

export default function MfaChallengePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading…</div>
        </div>
      }
    >
      <MfaChallengePage />
    </Suspense>
  );
}

function MfaChallengePage() {
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => safeInternalPath(searchParams.get("redirect")), [searchParams]);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Resolve the verified TOTP factor to challenge. If none exists the session is
  // already at its highest level — send the user on to their destination.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        const totp = data?.totp?.[0];
        if (!totp) {
          window.location.assign(redirectTo);
          return;
        }
        setFactorId(totp.id);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Couldn't load your authentication factors.");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [redirectTo]);

  const verify = useCallback(async () => {
    if (!factorId) return;
    const normalized = normalizeTotpCode(code);
    if (!normalized) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: normalized });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      // Session is now aal2; the middleware gate will let the destination through.
      window.location.assign(redirectTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Please try again.");
      setBusy(false);
    }
  }, [factorId, code, redirectTo]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo href="/" tone="dark" size="lg" tagline />
          <p className="mt-4 text-sm text-gray-400">Two-factor authentication</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <h1 className="text-lg font-semibold text-white">Enter Your Code</h1>
          <p className="mt-1 text-sm text-gray-400">
            Open your authenticator app and enter the current 6-digit code for Comply-Quick.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-gray-500">Loading…</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
              className="mt-6 space-y-4"
            >
              <input
                aria-label="Authentication code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={7}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-center text-lg tracking-[0.4em] text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || !isValidTotpCode(code)}
                className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={signOut}
            className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-300"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
}
