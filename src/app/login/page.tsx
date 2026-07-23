"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, magicLinkAction, resendConfirmationAction, signupAction } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/Logo";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading…</div>
        </div>
      }
    >
      <AuthPage />
    </Suspense>
  );
}

function AuthPage() {
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => safeInternalPath(searchParams.get("redirect")), [searchParams]);
  const initialMode: Mode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const initialError = searchParams.get("error") ?? "";
  const initialEmail = searchParams.get("email") ?? "";
  const initialNotice = searchParams.get("notice");
  const initialConfirmWarning = searchParams.get("warning") === "resend";

  const [mode, setMode] = useState<Mode>(initialMode);
  // "confirm" = signup needs email verification; "reset" = password-reset email sent.
  const [notice, setNotice] = useState<"none" | "magic" | "confirm" | "reset">(
    initialNotice === "magic" || initialNotice === "confirm" || initialNotice === "reset" ? initialNotice : "none"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [noticeEmail, setNoticeEmail] = useState(initialEmail);
  const [confirmWarning, setConfirmWarning] = useState(initialConfirmWarning);
  const [noticeMessage, setNoticeMessage] = useState("");

  // Shared fields.
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Signup-only fields.
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const strength = useMemo(() => passwordStrength(password), [password]);

  const resetTransientState = useCallback(() => {
    setError("");
    setNotice("none");
    setConfirmWarning(false);
    setNoticeMessage("");
  }, []);

  const switchMode = useCallback(
    (next: Mode) => {
      resetTransientState();
      setMode(next);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      params.delete("notice");
      params.delete("email");
      if (next === "forgot") params.delete("mode");
      else params.set("mode", next);
      const query = params.toString();
      window.history.replaceState(null, "", query ? `/login?${query}` : "/login");
    },
    [resetTransientState, searchParams]
  );

  const isRedirectError = useCallback((err: unknown): boolean => {
    return err instanceof Error && /NEXT_REDIRECT/.test(err.message);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      setNotice("none");
      try {
        const formData = new FormData(e.currentTarget);
        const action = mode === "signin" ? loginAction : signupAction;
        const result = await action(formData);
        if (result && "error" in result) {
          setError(result.error);
        } else if (result && "notice" in result) {
          setNoticeEmail(result.email);
          setNotice(result.notice);
        }
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [mode, isRedirectError]
  );

  const oauth = useCallback(
    async (provider: "google" | "github") => {
      setBusy(true);
      setError("");
      try {
        const supabase = createClient();
        const redirect = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;
        const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirect } });
        if (error) {
          setError(error.message);
          setBusy(false);
        }
        // On success the browser redirects to the provider.
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
        setBusy(false);
      }
    },
    [redirectTo]
  );

  const handleMagicLink = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await magicLinkAction(email, redirectTo);
      if (!result.configured) {
        const supabase = createClient();
        const emailRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
        if (error) {
          setError(error.message);
          return;
        }
      } else if (!result.delivered) {
        setError("Couldn't send the link. Please try again.");
        return;
      }
      setNoticeEmail(email);
      setNotice("magic");
      setNoticeMessage("Magic sign-in link sent — check your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the link. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [email, redirectTo]);

  const handleResendConfirmation = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await resendConfirmationAction(noticeEmail, redirectTo);
      if (!result.configured) {
        const supabase = createClient();
        const emailRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
          redirectTo
        )}&channel=signup`;
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: noticeEmail,
          options: { emailRedirectTo },
        });
        if (error) {
          setError(error.message);
          return;
        }
      } else if (!result.delivered) {
        setError("Couldn't resend the confirmation email. Please try again.");
        return;
      }
      setError("");
      setConfirmWarning(false);
      setNoticeMessage("Confirmation email sent — check your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resend the confirmation email. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [noticeEmail, redirectTo]);

  const handleForgot = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/auth/reset`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setNoticeEmail(email);
      setNotice("reset");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [email]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo href="/" tone="dark" size="lg" tagline />
          <h2 className="mt-4 text-sm text-gray-400 font-normal">
            {mode === "signup" ? "Create Your Command Center Account" : "Sign In to Your Command Center"}
          </h2>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          {notice !== "none" ? (
            <NoticePanel
              notice={notice}
              email={noticeEmail}
              busy={busy}
              error={error}
              confirmWarning={confirmWarning}
              noticeMessage={noticeMessage}
              onResend={notice === "confirm" ? handleResendConfirmation : undefined}
              onBack={() => {
                setNotice("none");
                setBusy(false);
                setConfirmWarning(false);
                setNoticeMessage("");
              }}
            />
          ) : mode === "forgot" ? (
            <ForgotView
              email={email}
              setEmail={setEmail}
              busy={busy}
              error={error}
              onSubmit={handleForgot}
              onBack={() => switchMode("signin")}
            />
          ) : (
            <>
              {/* Mode tabs */}
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-gray-950 p-1">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      mode === m ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <OAuthButtons busy={busy} onOAuth={oauth} />

              <div className="flex items-center gap-3 my-5">
                <span className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-500">or</span>
                <span className="h-px flex-1 bg-gray-800" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="hidden" name="redirect" value={redirectTo} />
                {mode === "signup" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FieldInput
                        label="Full Name"
                        name="fullName"
                        value={fullName}
                        onChange={setFullName}
                        placeholder="Jane Doe"
                        autoComplete="name"
                      />
                      <FieldInput
                        label="Company"
                        optional
                        name="companyName"
                        value={companyName}
                        onChange={setCompanyName}
                        placeholder="Acme Agency"
                        autoComplete="organization"
                      />
                    </div>
                  </>
                )}

                <FieldInput
                  label="Email Address"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={setEmail}
                  placeholder="you@agency.com"
                  autoComplete="email"
                />

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 pr-16 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {mode === "signup" && password.length > 0 && <StrengthMeter strength={strength} />}
                </div>

                {mode === "signup" && (
                  <FieldInput
                    label="Confirm Password"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                  />
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy
                    ? mode === "signup"
                      ? "Creating Account…"
                      : "Signing In…"
                    : mode === "signup"
                      ? "Create Account with Email"
                      : "Sign In with Email"}
                </button>

                {mode === "signin" && (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleMagicLink}
                      disabled={busy || !email}
                      className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40"
                    >
                      Email Me a Magic Link Instead
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          By continuing you agree to our{" "}
          <a href="/legal/terms" className="text-gray-500 underline hover:text-gray-300">
            Terms
          </a>{" "}
          and{" "}
          <a href="/legal/privacy" className="text-gray-500 underline hover:text-gray-300">
            Privacy Policy
          </a>
          . View all legal documents in the{" "}
          <a href="/legal" className="text-gray-500 underline hover:text-gray-300">
            Legal Center
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function OAuthButtons({ busy, onOAuth }: { busy: boolean; onOAuth: (p: "google" | "github") => void }) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onOAuth("google")}
        disabled={busy}
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
      <button
        type="button"
        onClick={() => onOAuth("github")}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 px-5 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
        </svg>
        Continue with GitHub
      </button>
    </div>
  );
}

function FieldInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  optional,
  autoComplete,
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-300">
        {label}
        {optional && <span className="ml-1 text-xs font-normal text-gray-600">(optional)</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

function StrengthMeter({ strength }: { strength: { score: number; label: string } }) {
  // 4 bars ↔ 4 non-zero scores; index by score-1 so the weakest visible state is red.
  const colors = ["bg-red-500", "bg-orange-500", "bg-lime-500", "bg-emerald-500"];
  const activeColor = strength.score > 0 ? colors[strength.score - 1] : "bg-gray-800";
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < strength.score ? activeColor : "bg-gray-800"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-500">Password strength: {strength.label}</p>
    </div>
  );
}

function ForgotView({
  email,
  setEmail,
  busy,
  error,
  onSubmit,
  onBack,
}: {
  email: string;
  setEmail: (v: string) => void;
  busy: boolean;
  error: string;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">Reset Your Password</h2>
        <p className="mt-1 text-sm text-gray-400">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
      </div>
      <FieldInput
        label="Email Address"
        type="email"
        required
        value={email}
        onChange={setEmail}
        placeholder="you@agency.com"
        autoComplete="email"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !email}
        className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
      >
        {busy ? "Sending…" : "Send Reset Link"}
      </button>
      <button type="button" onClick={onBack} className="w-full text-center text-xs text-gray-400 hover:text-gray-200">
        &larr; Back to Sign In
      </button>
    </form>
  );
}

function NoticePanel({
  notice,
  email,
  busy,
  error,
  confirmWarning,
  noticeMessage,
  onResend,
  onBack,
}: {
  notice: "magic" | "confirm" | "reset";
  email: string;
  busy: boolean;
  error: string;
  confirmWarning: boolean;
  noticeMessage: string;
  onResend?: () => void;
  onBack: () => void;
}) {
  const copy = {
    magic: { icon: "📬", title: "Check Your Email", body: "We sent a magic sign-in link to" },
    confirm: { icon: "✉️", title: "Confirm Your Email", body: "We sent a verification link to" },
    reset: { icon: "🔑", title: "Reset Link Sent", body: "We sent a password-reset link to" },
  }[notice];
  return (
    <div className="text-center space-y-3">
      <div className="text-3xl">{copy.icon}</div>
      <h2 className="text-lg font-semibold text-white">{copy.title}</h2>
      <p className="text-sm text-gray-400">
        {copy.body} <span className="text-gray-200">{email}</span>. Click it to continue.
        {notice === "confirm" && " You can add your company logo from Settings after verifying."}
      </p>
      {confirmWarning && notice === "confirm" && (
        <p
          role="alert"
          className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200"
        >
          We couldn&apos;t send the first confirmation email. Click &quot;Resend confirmation email&quot; to try again.
        </p>
      )}
      {noticeMessage && (
        <p role="status" className="text-sm text-emerald-300">
          {noticeMessage}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice === "confirm" && onResend && (
        <button
          type="button"
          onClick={onResend}
          disabled={busy}
          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
        >
          {busy ? "Sending." : "Resend confirmation email"}
        </button>
      )}
      <button type="button" onClick={onBack} className="text-xs text-gray-400 hover:text-gray-200">
        &larr; Back
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Only allow same-origin relative destinations, guarding against open redirects. */
function safeInternalPath(raw: string | null): string {
  const fallback = "/dashboard/home";
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "—" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(score, 4);
  const label = ["Very weak", "Weak", "Fair", "Good", "Strong"][clamped];
  return { score: clamped, label };
}
