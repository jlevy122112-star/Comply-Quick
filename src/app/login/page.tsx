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
          )}
        </div>
      </div>
    </div>
  );
}
