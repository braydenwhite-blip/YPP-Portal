"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createBrowserClientOrNull } from "@/lib/supabase/client";

type SetupState = "idle" | "scanning" | "confirming" | "enabled";

export default function SecuritySettingsPage() {
  const [has2FA, setHas2FA] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Setup flow state
  const [setupState, setSetupState] = useState<SetupState>("idle");
  const [qrCodeUri, setQrCodeUri] = useState("");
  const [plainSecret, setPlainSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClientOrNull();

  useEffect(() => {
    if (!supabase) {
      setCheckingStatus(false);
      return;
    }

    const client = supabase;

    async function checkMfaStatus() {
      const { data } = await client.auth.mfa.listFactors();
      const activeTotpFactors =
        data?.totp?.filter((factor: { status?: string; id: string }) => factor.status === "verified") ?? [];
      setHas2FA(activeTotpFactors.length > 0);
      if (activeTotpFactors.length > 0) {
        setFactorId(activeTotpFactors[0].id);
      }
      setCheckingStatus(false);
    }
    checkMfaStatus();
  }, [supabase]);

  async function handleStartSetup() {
    if (!supabase) {
      setError(
        "Two-factor authentication is unavailable until Supabase public auth is configured."
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "YPP Portal Authenticator",
      });

      if (enrollError) throw enrollError;

      setFactorId(data.id);
      setQrCodeUri(data.totp.qr_code);
      setPlainSecret(data.totp.secret);
      setSetupState("scanning");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable() {
    if (!supabase) {
      setError(
        "Two-factor authentication is unavailable until Supabase public auth is configured."
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setHas2FA(true);
      setSetupState("enabled");
    } catch (e: any) {
      setError(e.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!supabase) {
      setError(
        "Two-factor authentication is unavailable until Supabase public auth is configured."
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // Verify the code first by doing a challenge + verify
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: disableCode,
      });
      if (verifyError) throw verifyError;

      // Now unenroll the factor
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      if (unenrollError) throw unenrollError;

      setHas2FA(false);
      setFactorId("");
      setDisableCode("");
    } catch (e: any) {
      setError(e.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return (
      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px" }}>
        <p style={{ color: "var(--muted)" }}>Loading security settings...</p>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px" }}>
        <h1 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>
          Security Settings
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 32 }}>
          Manage your account security and two-factor authentication.
        </p>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            Two-Factor Authentication
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.6 }}>
            Two-factor authentication is unavailable until Supabase public auth is configured in this environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px" }}>
      <h1 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>Security Settings</h1>
      <p className="page-subtitle" style={{ marginBottom: 32 }}>
        Manage your account security and two-factor authentication.
      </p>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Two-Factor Authentication</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
              Add a second layer of security with a time-based one-time password (TOTP) app
              such as Google Authenticator, Authy, or 1Password.
            </p>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 99,
              background: has2FA ? "var(--success-light, #dcfce7)" : "var(--surface)",
              color: has2FA ? "var(--success, #16a34a)" : "var(--muted)",
              border: "1px solid",
              borderColor: has2FA ? "var(--success, #16a34a)" : "var(--border)",
              whiteSpace: "nowrap",
              marginLeft: 16,
            }}
          >
            {has2FA ? "Enabled" : "Disabled"}
          </span>
        </div>

        {error && (
          <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>
        )}

        {/* 2FA not enabled */}
        {!has2FA && setupState === "idle" && (
          <button className="button" onClick={handleStartSetup} disabled={loading}>
            {loading ? "Loading\u2026" : "Enable Two-Factor Authentication"}
          </button>
        )}

        {/* Step 1: Show QR code */}
        {setupState === "scanning" && (
          <div>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              Scan this QR code with your authenticator app, then click <strong>Next</strong>.
            </p>
            {qrCodeUri && (
              <Image
                src={qrCodeUri}
                alt="2FA QR code"
                width={180}
                height={180}
                unoptimized
                style={{
                  display: "block",
                  marginBottom: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              />
            )}
            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                Can&apos;t scan? Enter this key manually
              </summary>
              <code style={{ fontSize: 12, background: "var(--surface)", padding: "4px 8px", borderRadius: 4, display: "inline-block", marginTop: 6, letterSpacing: "0.1em" }}>
                {plainSecret}
              </code>
            </details>
            <button className="button" onClick={() => setSetupState("confirming")}>
              Next — Enter Code
            </button>
          </div>
        )}

        {/* Step 2: Verify first TOTP code */}
        {setupState === "confirming" && (
          <div>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              Enter the 6-digit code from your authenticator app to confirm setup.
            </p>
            <label className="form-label" style={{ marginTop: 0 }}>
              Verification Code
              <input
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </label>
            <button className="button" onClick={handleEnable} disabled={loading || verifyCode.length !== 6}>
              {loading ? "Verifying\u2026" : "Enable 2FA"}
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {setupState === "enabled" && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Two-factor authentication is now enabled.
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              You will be asked for a verification code from your authenticator app
              each time you sign in.
            </p>
            <button className="button secondary" onClick={() => window.location.reload()}>
              Done
            </button>
          </div>
        )}

        {/* 2FA enabled — allow disabling */}
        {has2FA && setupState === "idle" && (
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              To disable two-factor authentication, enter a verification code from your authenticator app.
            </p>
            <label className="form-label" style={{ marginTop: 0 }}>
              Current Verification Code
              <input
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button
              className="button"
              style={{ background: "var(--destructive, #dc2626)", color: "#fff" }}
              onClick={handleDisable}
              disabled={loading || disableCode.length !== 6}
            >
              {loading ? "Disabling\u2026" : "Disable 2FA"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
