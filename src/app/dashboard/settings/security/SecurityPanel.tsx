"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { Badge, Button, Card, CardBody, CardHeader, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatTotpSecret, isValidTotpCode, normalizeTotpCode } from "@/lib/auth/mfa";

interface EnrollState {
  factorId: string;
  qrCode: string;
  secret: string;
}

interface Props {
  initialFactors: Factor[];
}

export function SecurityPanel({ initialFactors }: Props) {
  const [factors, setFactors] = useState<Factor[]>(initialFactors);
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "start" | "verify" | "cancel" | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const verified = factors.filter((f) => f.status === "verified");
  const hasVerified = verified.length > 0;

  // Track the latest enroll state so the unmount cleanup below sees the current
  // value rather than the closure captured at mount time.
  const enrollRef = useRef<EnrollState | null>(null);
  useEffect(() => {
    enrollRef.current = enroll;
  }, [enroll]);

  const refreshFactors = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    if (data) setFactors(data.all ?? []);
  }, []);

  // Clean up any dangling unverified factor if the user navigates away mid-enroll.
  useEffect(() => {
    return () => {
      const pending = enrollRef.current;
      if (pending) {
        const supabase = createClient();
        void supabase.auth.mfa.unenroll({ factorId: pending.factorId });
      }
    };
  }, []);

  const startEnroll = useCallback(async () => {
    setBusy("start");
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: friendlyName.trim() || `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start enrollment. Please try again.");
    } finally {
      setBusy(null);
    }
  }, [friendlyName]);

  const verifyEnroll = useCallback(async () => {
    if (!enroll) return;
    const normalized = normalizeTotpCode(code);
    if (!normalized) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy("verify");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code: normalized });
      if (error) {
        setError(error.message);
        return;
      }
      // The factor is now verified — clear the ref synchronously so a concurrent
      // unmount cleanup can't unenroll it before the state update is processed.
      enrollRef.current = null;
      setEnroll(null);
      setFriendlyName("");
      setCode("");
      setMessage("Two-factor authentication is now enabled on your account.");
      await refreshFactors();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }, [enroll, code, refreshFactors]);

  const cancelEnroll = useCallback(async () => {
    if (!enroll) return;
    setBusy("cancel");
    try {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    } catch {
      // Non-fatal: an unverified factor is harmless and will be cleaned up later.
    } finally {
      setEnroll(null);
      setCode("");
      setError(null);
      setBusy(null);
    }
  }, [enroll]);

  const removeFactor = useCallback(
    async (factorId: string) => {
      setBusy(factorId);
      setError(null);
      setMessage(null);
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.mfa.unenroll({ factorId });
        if (error) {
          setError(error.message);
          return;
        }
        setMessage("Authenticator removed.");
        await refreshFactors();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove the authenticator.");
      } finally {
        setBusy(null);
      }
    },
    [refreshFactors]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Two-factor authentication (2FA)"
          description="Add a time-based one-time password (TOTP) from an authenticator app such as Google Authenticator, 1Password, or Authy. You'll be asked for a code when signing in."
          actions={<Badge tone={hasVerified ? "emerald" : "gray"}>{hasVerified ? "Enabled" : "Not enabled"}</Badge>}
        />
        <CardBody className="space-y-4">
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {verified.length > 0 && (
            <ul className="divide-y divide-gray-800 rounded-lg border border-gray-800">
              {verified.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-100">
                      {f.friendly_name || "Authenticator app"}
                    </p>
                    <p className="text-xs text-gray-500">
                      TOTP · added {f.created_at ? new Date(f.created_at).toLocaleDateString() : "recently"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === f.id}
                    onClick={() => removeFactor(f.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    {busy === f.id ? "Removing…" : "Remove"}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {enroll ? (
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm font-medium text-gray-200">1. Scan this QR code</p>
              <p className="mb-3 text-xs text-gray-500">
                Open your authenticator app and scan the code, or enter the setup key manually.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="rounded-lg bg-white p-2">
                  {/* Supabase returns an inline SVG data URI, not an optimizable remote image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enroll.qrCode} alt="Authenticator QR code" width={160} height={160} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Setup key</p>
                    <code className="break-all font-mono text-sm text-gray-200">{formatTotpSecret(enroll.secret)}</code>
                  </div>
                  <div>
                    <label htmlFor="totp-code" className="mb-1 block text-sm font-medium text-gray-300">
                      2. Enter the 6-digit code
                    </label>
                    <Input
                      id="totp-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={code}
                      maxLength={7}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={verifyEnroll} disabled={busy === "verify" || !isValidTotpCode(code)}>
                      {busy === "verify" ? "Verifying…" : "Verify & enable"}
                    </Button>
                    <Button variant="ghost" onClick={cancelEnroll} disabled={busy === "cancel"}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="factor-name" className="mb-1 block text-sm font-medium text-gray-300">
                  Device name <span className="text-xs font-normal text-gray-600">(optional)</span>
                </label>
                <Input
                  id="factor-name"
                  placeholder="e.g. iPhone Authenticator"
                  value={friendlyName}
                  onChange={(e) => setFriendlyName(e.target.value)}
                />
              </div>
              <Button onClick={startEnroll} disabled={busy === "start"}>
                {busy === "start" ? "Starting…" : hasVerified ? "Add another authenticator" : "Enable 2FA"}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
