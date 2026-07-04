"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading…</div>
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard/home";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) return;
      setStatus("sending");
      setErrorMessage("");

      const supabase = createClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
      } else {
        setStatus("sent");
      }
    },
    [email, redirectTo]
  );

  const handleGoogle = useCallback(async () => {
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const redirect = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
    // On success the browser is redirected to Google, so no further state change here.
  }, [redirectTo]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-white tracking-tight">
            Comply-Quick
          </Link>
          <p className="mt-2 text-sm text-gray-400">Sign in to your Command Center</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          {status === "sent" ? (
            <div className="text-center space-y-3">
              <div className="text-3xl">📬</div>
              <h2 className="text-lg font-semibold text-white">Check your email</h2>
              <p className="text-sm text-gray-400">
                We sent a magic sign-in link to <span className="text-gray-200">{email}</span>. Click it to finish
                signing in.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={status === "sending"}
                className="w-full flex items-center justify-center gap-3 px-5 py-2.5 rounded-lg bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                  />
                  <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-4">
                <span className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-500">or</span>
                <span className="h-px flex-1 bg-gray-800" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-950 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {status === "error" && <p className="text-sm text-red-400">{errorMessage}</p>}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === "sending" ? "Sending link…" : "Send magic link"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  No password needed — we&apos;ll email you a secure sign-in link.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
