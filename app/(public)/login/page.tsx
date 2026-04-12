"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import { navigateToAuthDestination } from "@/lib/auth-client-navigation";
import { requestMagicLink } from "@/lib/magic-link-actions";
import { createBrowserClientOrNull } from "@/lib/supabase/client";
import {
  canUseLocalPasswordFallback,
  SUPABASE_PUBLIC_ENV_MISSING_MESSAGE,
} from "@/lib/supabase/config";
import { isLegacyAuthBypassEmail } from "@/lib/legacy-auth-config";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const archivedError = searchParams.get("error") === "account_archived";
  const supabaseUnavailableError =
    searchParams.get("error") === "supabase_unavailable";

  const [loginMethod, setLoginMethod] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  // MFA challenge state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const supabase = createBrowserClientOrNull();
  const hasSupabaseBrowserAuth = supabase !== null;
  const localPasswordFallbackEnabled = canUseLocalPasswordFallback();
  const authSetupMessage = localPasswordFallbackEnabled
    ? "Supabase public auth is missing in this local environment, so password sign-in is using the local fallback. Magic links and email-link flows stay unavailable until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are added."
    : !hasSupabaseBrowserAuth
      ? `${SUPABASE_PUBLIC_ENV_MISSING_MESSAGE} Magic links are unavailable until it is configured.`
      : null;

  useEffect(() => {
    if (archivedError) {
      setError("This account has been archived and can no longer sign in.");
      return;
    }

    if (supabaseUnavailableError) {
      setError(
        "Email-link authentication is unavailable until Supabase public auth is configured."
      );
    }
  }, [archivedError, supabaseUnavailableError]);

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    if (!hasSupabaseBrowserAuth || isLegacyAuthBypassEmail(normalizedEmail)) {
      const legacyResponse = await fetch("/api/auth/local-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });
      const legacyResult = (await legacyResponse.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (legacyResponse.ok && legacyResult?.success) {
        navigateToAuthDestination(callbackUrl);
        return;
      }

      if (!hasSupabaseBrowserAuth) {
        setError(legacyResult?.error || "Invalid email or password.");
        setLoading(false);
        return;
      }
    }

    if (!supabase) {
      setError(SUPABASE_PUBLIC_ENV_MISSING_MESSAGE);
      setLoading(false);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      if (signInError.message.includes("Invalid login credentials")) {
        setError("Invalid email or password.");
      } else if (signInError.message.includes("Email not confirmed")) {
        setError("Please verify your email before signing in.");
      } else if (signInError.message.includes("Too many requests")) {
        setError("Too many login attempts. Please try again later.");
      } else {
        setError(signInError.message);
      }
      setLoading(false);
      return;
    }

    if (data.user?.user_metadata?.portalArchived === true) {
      await supabase.auth.signOut();
      setError("This account has been archived and can no longer sign in.");
      setLoading(false);
      return;
    }

    // Check if MFA is required
    if (data.session === null && data.user === null) {
      // This shouldn't happen with valid credentials, treat as error
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Check for MFA challenge
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaData?.nextLevel === "aal2" && mfaData.currentLevel === "aal1") {
      // User has MFA enrolled, need to verify
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (totpFactor) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: totpFactor.id,
        });
        if (challengeError) {
          setError("Could not start 2FA challenge. Please try again.");
          setLoading(false);
          return;
        }
        setMfaFactorId(totpFactor.id);
        setMfaChallengeId(challenge.id);
        setMfaStep(true);
        setLoading(false);
        return;
      }
    }

    router.refresh();
    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
  }

  async function handleTotpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setError(SUPABASE_PUBLIC_ENV_MISSING_MESSAGE);
      return;
    }

    setError(null);
    setLoading(true);

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: mfaChallengeId,
      code: totpCode,
    });

    if (verifyError) {
      if (verifyError.message.includes("expired")) {
        setMfaStep(false);
        setMfaFactorId("");
        setMfaChallengeId("");
        setTotpCode("");
        setError("2FA session expired. Please sign in again.");
      } else {
        setError("Invalid verification code. Please try again.");
      }
      setLoading(false);
      return;
    }

    router.refresh();
    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
  }

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasSupabaseBrowserAuth) {
      setError(
        "Magic links are unavailable until Supabase public auth is configured."
      );
      return;
    }

    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("next", callbackUrl);

    const result = await requestMagicLink({ status: "idle", message: "" }, formData);

    if (result.status === "error") {
      setError(result.message);
    } else {
      setMagicSent(true);
    }
    setLoading(false);
  }

  const tabBtnBase: React.CSSProperties = {
    flex: 1,
    padding: "6px 0",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    transition: "background 0.15s",
  };

  return (
    <div className="login-shell">
      <div className="login-grid">
        <section className="login-hero">
          <div className="login-logo login-logo--lockup">
            <BrandLockup height={52} className="brand-lockup" priority reloadOnClick />
          </div>
          <p className="badge">Pathways Portal</p>
          <h1 className="page-title mt-8">
            Master your craft. Inspire a generation. Track every milestone.
          </h1>
          <p className="hero-subtitle mt-12">
            The Pathways Portal is the official digital backbone of the Youth Passion Project. From your very first
            101 class to launching a portfolio-ready passion project, we connect learners, mentors, and families
            in one unified ecosystem.
          </p>
          <div className="hero-grid">
            <div className="hero-card">
              <h3>Students: Your Passion Journey</h3>
              <p>Complete 101-401 levels, earn badges, and build a portfolio. Connect with mentors and alumni to launch your passion.</p>
            </div>
            <div className="hero-card">
              <h3>Instructors: Teaching Excellence</h3>
              <p>Finish Academy training, access lesson plans, and manage classes. Support growth with high-impact tracking and feedback.</p>
            </div>
            <div className="hero-card">
              <h3>Parents: Visibility & Support</h3>
              <p>Stay updated with real-time progress reports and certificates. See the impact of mentorship on your child&apos;s learning journey.</p>
            </div>
          </div>

        </section>

        <div className="login-card login-card--brand">
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={52} className="brand-lockup" reloadOnClick />
            <div>
              <h2 className="login-card-welcome-title">Welcome Back</h2>
              <p className="login-card-welcome-subtitle">Sign in to your Pathways Portal</p>
            </div>
          </div>

          {authSetupMessage ? (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {authSetupMessage}
            </div>
          ) : null}

          {/* MFA step — shown after password is verified */}
          {mfaStep && (
            <form onSubmit={handleTotpSubmit}>
              <p style={{ fontSize: 14, color: "var(--foreground)", fontWeight: 500, marginBottom: 4 }}>
                Two-Factor Authentication
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
                Enter the 6-digit code from your authenticator app.
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
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="button" type="submit" disabled={loading}>
                {loading ? "Verifying\u2026" : "Verify"}
              </button>
              <button
                type="button"
                className="button secondary"
                style={{ marginTop: 8, width: "100%" }}
                onClick={() => { setMfaStep(false); setMfaFactorId(""); setMfaChallengeId(""); setTotpCode(""); setError(null); }}
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* Normal sign-in UI — hidden during MFA step */}
          {!mfaStep && <>

            {/* Login method toggle */}
            <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, gap: 3, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => { setLoginMethod("password"); setError(null); setMagicSent(false); }}
                style={{
                  ...tabBtnBase,
                  background: loginMethod === "password" ? "var(--card)" : "transparent",
                  color: loginMethod === "password" ? "var(--foreground)" : "var(--muted)",
                  boxShadow: loginMethod === "password" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setLoginMethod("magic"); setError(null); setMagicSent(false); }}
                disabled={!hasSupabaseBrowserAuth}
                style={{
                  ...tabBtnBase,
                  background: loginMethod === "magic" ? "var(--card)" : "transparent",
                  color: loginMethod === "magic" ? "var(--foreground)" : "var(--muted)",
                  boxShadow: loginMethod === "magic" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  opacity: hasSupabaseBrowserAuth ? 1 : 0.55,
                  cursor: hasSupabaseBrowserAuth ? "pointer" : "not-allowed",
                }}
              >
                Magic Link
              </button>
            </div>

            {/* Password login form */}
            {loginMethod === "password" && (
              <form onSubmit={handlePasswordSubmit}>
                <label className="form-label" style={{ marginTop: 0 }}>
                  Email
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label className="form-label">
                  Password
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </label>
                <div style={{ textAlign: "right", marginTop: 8 }}>
                  <Link href="/forgot-password" style={{ fontSize: 13, color: "var(--ypp-purple)", fontWeight: 500 }}>
                    Forgot password?
                  </Link>
                </div>
                {error && (
                  <div className="form-error">{error}</div>
                )}
                <button className="button" type="submit" disabled={loading}>
                  {loading ? "Signing in\u2026" : "Sign In"}
                </button>
              </form>
            )}

            {/* Magic link form */}
            {loginMethod === "magic" && (
              <form onSubmit={handleMagicLink}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
                  Enter your email and we&apos;ll send a one-click sign-in link — no password needed.
                </p>
                <label className="form-label" style={{ marginTop: 0 }}>
                  Email
                  <input
                    className="input"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </label>
                {error && (
                  <div className="form-error">{error}</div>
                )}
                {magicSent ? (
                  <div className="form-success">
                    Check your email for a sign-in link. It may take a minute to arrive.
                  </div>
                ) : (
                  <button className="button" type="submit" disabled={loading}>
                    {loading ? "Sending\u2026" : "Send Magic Link"}
                  </button>
                )}
              </form>
            )}

            <div className="login-help">
              Need help? Contact your chapter administrator or support team.
            </div>
            <Link
              className="button secondary login-card-signup-cta"
              style={{ display: "block", textAlign: "center" }}
              href="/signup"
            >
              Create Family Account
            </Link>
            <div className="login-help" style={{ marginTop: 8 }}>
              Applying to teach? <Link href="/signup/instructor">Start the instructor application</Link>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// Suspense wrapper required because LoginPageContent uses useSearchParams()
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-shell">
          <div className="login-card login-card--brand" style={{ justifySelf: "center", textAlign: "center", padding: "48px 32px" }}>
            <BrandLockup height={52} className="brand-lockup" reloadOnClick />
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
