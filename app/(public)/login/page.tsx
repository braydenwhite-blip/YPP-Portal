"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import { createBrowserClient } from "@/lib/supabase/client";
import { isLegacyAuthBypassEmail } from "@/lib/legacy-auth-config";
import { signInLegacyBypass } from "@/lib/legacy-auth-actions";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [loginMethod, setLoginMethod] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  // MFA challenge state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const supabase = createBrowserClient();

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    if (isLegacyAuthBypassEmail(normalizedEmail)) {
      const legacyResult = await signInLegacyBypass({
        email: normalizedEmail,
        password,
      });

      if (legacyResult.success) {
        router.refresh();
        router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
        return;
      }
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

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
      },
    });
    if (oauthError) {
      setError("Could not start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const magicEmail = String(formData.get("email") ?? "").trim();

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
      },
    });

    if (otpError) {
      setError(otpError.message);
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
            Build a full learning journey, not just a class.
          </h1>
          <p className="hero-subtitle mt-12">
            The Pathways Portal connects curriculum, mentorship, events, and instructor training so every
            chapter can guide students from their first class to a portfolio-ready project.
          </p>
          <div className="hero-grid">
            <div className="hero-card">
              <h3>Curriculum Flow</h3>
              <p>Track one-off classes, learner-fit pathways, and labs in one view.</p>
            </div>
            <div className="hero-card">
              <h3>Mentorship + Growth</h3>
              <p>Pair instructors and students with check-ins that keep progress on track.</p>
            </div>
            <div className="hero-card">
              <h3>Training Readiness</h3>
              <p>Approve instructors with clear readiness steps and per-offering review status.</p>
            </div>
          </div>
          <div className="hero-metrics">
            <div>
              <div className="kpi">Learner Fit</div>
              <div className="kpi-label">Clear Starting Points</div>
            </div>
            <div>
              <div className="kpi">Labs + Commons</div>
              <div className="kpi-label">Project-Based Growth</div>
            </div>
            <div>
              <div className="kpi">Mentorship</div>
              <div className="kpi-label">Monthly Check-Ins</div>
            </div>
          </div>
        </section>

        <div className="login-card">
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h2 className="page-title" style={{ fontSize: 20 }}>
                Welcome Back
              </h2>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Sign in to your Pathways Portal
              </p>
            </div>
          </div>

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

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="button secondary"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}
          >
            {googleLoading ? (
              <>Redirecting&hellip;</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 16px" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>or sign in with</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

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
              style={{
                ...tabBtnBase,
                background: loginMethod === "magic" ? "var(--card)" : "transparent",
                color: loginMethod === "magic" ? "var(--foreground)" : "var(--muted)",
                boxShadow: loginMethod === "magic" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
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
            Need help signing in? Contact your chapter administrator.
          </div>
          <Link className="button secondary" style={{ display: "block", textAlign: "center" }} href="/signup">
            Create Account
          </Link>
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
          <div className="login-card" style={{ justifySelf: "center", textAlign: "center", padding: "48px 32px" }}>
            <BrandLockup height={40} className="brand-lockup" reloadOnClick />
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
