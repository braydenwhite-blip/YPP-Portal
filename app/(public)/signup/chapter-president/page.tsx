"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import BrandLockup from "@/components/brand-lockup";
import SpamFolderNotice from "@/components/spam-folder-notice";
import { navigateToAuthDestination } from "@/lib/auth-client-navigation";
import { createBrowserClientOrNull } from "@/lib/supabase/client";
import { canUseLocalPasswordFallback } from "@/lib/supabase/config";
import { signUpChapterPresidentCandidate } from "@/lib/chapter-president-signup-actions";

const initialState = { status: "idle" as const, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending} style={{ width: "100%", marginTop: 20 }}>
      {pending ? "Creating account…" : "Continue to Application"}
    </button>
  );
}

export default function ChapterPresidentSignupPage() {
  const [state, formAction] = useFormState(signUpChapterPresidentCandidate, initialState);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const emailRef = useRef("");
  const passwordRef = useRef("");

  useEffect(() => {
    if (state.status === "success" && state.message === "ACCOUNT_CREATED_LOCAL") {
      navigateToAuthDestination("/chapter/apply");
      return;
    }
    if (state.status === "success" && state.message === "ACCOUNT_CREATED") {
      setAutoLoggingIn(true);

      async function doSignIn() {
        const email = emailRef.current;
        const password = passwordRef.current;

        const supabaseClient = createBrowserClientOrNull();
        if (supabaseClient) {
          const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (!signInError) {
            navigateToAuthDestination("/chapter/apply");
            return;
          }
        }

        if (canUseLocalPasswordFallback()) {
          const response = await fetch("/api/auth/local-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (response.ok) {
            navigateToAuthDestination("/chapter/apply");
            return;
          }
        }

        setAutoLoginError("Your account was created! Sign in below to continue your application.");
      }

      doSignIn();
    }
  }, [state.status, state.message]);

  if (autoLoggingIn) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: "0 24px" }}>
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          {autoLoginError ? (
            <>
              <h1 className="page-title" style={{ fontSize: 20, marginTop: 20 }}>Account created!</h1>
              <p className="page-subtitle" style={{ fontSize: 13 }}>{autoLoginError}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, alignItems: "center" }}>
                <Link
                  href={`/login?callbackUrl=/chapter/apply${emailRef.current ? `&email=${encodeURIComponent(emailRef.current)}` : ""}`}
                  className="button"
                  style={{ display: "inline-block", textDecoration: "none" }}
                >
                  Sign in
                </Link>
              </div>
              <SpamFolderNotice style={{ marginTop: 16, textAlign: "left" }} />
            </>
          ) : (
            <>
              <h1 className="page-title" style={{ fontSize: 20, marginTop: 20 }}>Setting up your account…</h1>
              <p className="page-subtitle" style={{ fontSize: 13 }}>Taking you to the application</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <BrandLockup height={30} className="brand-lockup" priority reloadOnClick />
        <span className="badge" style={{ fontSize: 11 }}>Chapter President Application</span>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 32px 80px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>
          Apply to become a YPP Chapter President.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24, lineHeight: 1.5 }}>
          Create an account to start your application. It only takes a minute.
        </p>

        <SpamFolderNotice style={{ marginBottom: 24 }} />

        <form action={formAction}>
          <label className="form-label" style={{ marginTop: 0 }}>
            Full name
            <input className="input" name="name" placeholder="Your full name" required />
          </label>

          <label className="form-label">
            Email
            <input
              className="input"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              onInput={(e) => { emailRef.current = (e.target as HTMLInputElement).value; }}
            />
          </label>

          <label className="form-label">
            Password
            <input
              className="input"
              name="password"
              type="password"
              placeholder="Min 8 characters, letter + number"
              required
              onInput={(e) => { passwordRef.current = (e.target as HTMLInputElement).value; }}
            />
          </label>

          {state.status === "error" && state.message === "ACCOUNT_EXISTS_SIGNIN_REQUIRED" ? (
            <div role="alert" style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "#fef3c7", border: "1px solid #fde68a", fontSize: 13, lineHeight: 1.55, color: "#78350f" }}>
              <strong style={{ display: "block", marginBottom: 4 }}>You already have an account with this email.</strong>
              Sign in to continue your application.
              <div style={{ marginTop: 12 }}>
                <Link href="/login?callbackUrl=/chapter/apply" className="button" style={{ fontSize: 13, padding: "8px 14px", textDecoration: "none" }}>
                  Sign in to continue
                </Link>
              </div>
            </div>
          ) : state.message && state.message !== "ACCOUNT_CREATED" && state.message !== "ACCOUNT_CREATED_LOCAL" ? (
  <div className={state.status === "error" ? "form-error" : "form-success"} style={{ marginTop: 16 }}>
    {state.message}
  </div>
) : null}

          <SubmitButton />
        </form>

        <div className="login-help" style={{ marginTop: 24 }}>
          Already have an account? <Link href="/login?callbackUrl=/chapter/apply">Sign in</Link>
        </div>
      </div>
    </div>
  );
}