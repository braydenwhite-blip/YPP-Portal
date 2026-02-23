"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useFormState } from "react-dom";
import { requestMagicLink, resendVerificationEmail } from "@/lib/email-verification-actions";

// ------------------------------------
// Inline resend-verification sub-form
// ------------------------------------
function ResendInline({ initialEmail }: { initialEmail: string }) {
  const [state, action] = useFormState(resendVerificationEmail, { status: "", message: "" });

  if (state.status === "success") {
    return <p className="form-success" style={{ margin: "8px 0 0" }}>{state.message}</p>;
  }

  return (
    <form action={action} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {state.status === "error" && (
        <p className="form-error" style={{ margin: 0 }}>{state.message}</p>
      )}
      <label className="form-label" style={{ margin: 0, fontSize: 13 }}>
        Email address
        <input
          className="input"
          name="email"
          type="email"
          required
          defaultValue={initialEmail}
          placeholder="your@email.com"
        />
      </label>
      <button className="button secondary" type="submit" style={{ width: "100%" }}>
        Resend Verification Email
      </button>
    </form>
  );
}

// ------------------------------------
// Main login content — uses useSearchParams (requires Suspense)
// ------------------------------------
function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const mt = searchParams.get("mt");

  const [loginMethod, setLoginMethod] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  const [magicState, magicAction] = useFormState(requestMagicLink, { status: "", message: "" });

  // Auto-sign in when a magic relay token (?mt=) is present
  useEffect(() => {
    if (!mt) return;
    setLoading(true);
    signIn("credentials", { mt, redirect: false }).then((result) => {
      if (result?.ok) {
        router.push(callbackUrl);
      } else {
        setError("This magic link has expired or already been used. Please request a new one.");
        setLoading(false);
      }
    });
  }, [mt]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setShowResend(false);
    setLoading(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.ok) {
      router.push(callbackUrl);
      return;
    }

    const err = result?.error ?? "";
    if (err === "EMAIL_NOT_VERIFIED") {
      setResendEmail(email);
      setShowResend(true);
      setError("Please verify your email before signing in.");
    } else if (err === "CredentialsSignin" || err === "") {
      setError("Invalid email or password.");
    } else if (err.includes("Too many")) {
      setError("Too many login attempts. Please try again later.");
    } else if (err.includes("Google sign-in")) {
      setError("This account uses Google sign-in. Please use the button above.");
    } else if (err === "MAGIC_LINK_EXPIRED") {
      setError("This magic link has expired or already been used. Please request a new one.");
    } else {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
    // redirect:true navigates away; this line only reached on error
    setGoogleLoading(false);
  }

  // Show a minimal loading screen while magic-token auto-signin is in progress
  if (mt && loading) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center", textAlign: "center", padding: "48px 32px" }}>
          <Image src="/logo-icon.svg" alt="YPP" width={44} height={44} style={{ marginBottom: 16 }} />
          <p style={{ color: "var(--muted)", margin: 0 }}>Signing you in&hellip;</p>
        </div>
      </div>
    );
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
          <div className="login-logo">
            <Image
              src="/logo-icon.svg"
              alt="Youth Passion Project"
              width={52}
              height={52}
            />
            <span className="login-logo-text">Youth Passion Project</span>
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
              <h3>Curriculum Ladder</h3>
              <p>Track one-off classes, 101/201/301 sequences, and labs in one view.</p>
            </div>
            <div className="hero-card">
              <h3>Mentorship + Growth</h3>
              <p>Pair instructors and students with check-ins that keep progress on track.</p>
            </div>
            <div className="hero-card">
              <h3>Training Readiness</h3>
              <p>Approve instructors by level with clear training milestones and status.</p>
            </div>
          </div>
          <div className="hero-metrics">
            <div>
              <div className="kpi">101 &rarr; 301</div>
              <div className="kpi-label">Leveled Pathways</div>
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
          <div className="login-card-header">
            <Image
              src="/logo-icon.svg"
              alt="YPP"
              width={44}
              height={44}
            />
            <div>
              <h2 className="page-title" style={{ fontSize: 20 }}>
                Welcome Back
              </h2>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Sign in to your Pathways Portal
              </p>
            </div>
          </div>

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
              onClick={() => { setLoginMethod("password"); setError(null); setShowResend(false); }}
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
              onClick={() => { setLoginMethod("magic"); setError(null); setShowResend(false); }}
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
                <div className="form-error">
                  {error}
                  {showResend && <ResendInline initialEmail={resendEmail} />}
                </div>
              )}
              <button className="button" type="submit" disabled={loading}>
                {loading ? "Signing in\u2026" : "Sign In"}
              </button>
            </form>
          )}

          {/* Magic link form */}
          {loginMethod === "magic" && (
            <form action={magicAction}>
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
              {magicState.status === "error" && (
                <div className="form-error">{magicState.message}</div>
              )}
              {magicState.status === "success" && (
                <div className="form-success">{magicState.message}</div>
              )}
              {magicState.status !== "success" && (
                <button className="button" type="submit">
                  Send Magic Link
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
            <Image src="/logo-icon.svg" alt="YPP" width={44} height={44} />
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
