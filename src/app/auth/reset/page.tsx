"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/Logo";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)))
      .catch(() => setHasSession(false))
      .finally(() => setChecking(false));
  }, []);

  const strong = useMemo(() => password.length >= 8, [password]);

  const onSubmit = useCallback(async () => {
    if (!strong) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [password, confirm, strong]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo href="/" tone="dark" size="lg" tagline />
          <p className="mt-4 text-sm text-gray-400">Set a new password</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
          {checking ? (
            <p className="text-center text-sm text-gray-400">Verifying your reset link…</p>
          ) : done ? (
            <div className="space-y-3 text-center">
              <div className="text-3xl">✅</div>
              <h2 className="text-lg font-semibold text-white">Password updated</h2>
              <p className="text-sm text-gray-400">Your password has been changed.</p>
              <a
                href="/dashboard/home"
                className="mt-2 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Go to dashboard →
              </a>
            </div>
          ) : !hasSession ? (
            <div className="space-y-3 text-center">
              <div className="text-3xl">⚠️</div>
              <h2 className="text-lg font-semibold text-white">Reset link expired</h2>
              <p className="text-sm text-gray-400">
                This password-reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <a
                href="/login?mode=signin"
                className="mt-2 inline-block rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-800"
              >
                Back to sign in
              </a>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-300">New password</span>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 pr-16 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                  >
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-300">Confirm new password</span>
                <input
                  type={show ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
              >
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
