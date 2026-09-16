"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import BrandLockup from "@/components/brand-lockup";
import SpamFolderNotice from "@/components/spam-folder-notice";
import { SharedApplyFields } from "@/components/signup/shared-apply-fields";
import {
  YppApplyShell,
  YPP_APPLY_HELPER,
  YPP_APPLY_HR,
  YPP_APPLY_SECTION_STYLE,
} from "@/components/signup/ypp-apply-shell";
import { navigateToAuthDestination } from "@/lib/auth-client-navigation";
import { submitUnifiedApply } from "@/lib/unified-apply-actions";
import { createBrowserClientOrNull } from "@/lib/supabase/client";
import { canUseLocalPasswordFallback } from "@/lib/supabase/config";

const initialState = { status: "idle" as const, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="button"
      type="submit"
      disabled={pending}
      style={{ marginTop: 24, width: "100%" }}
      aria-disabled={pending}
    >
      {pending ? "Submitting…" : "Submit Application"}
    </button>
  );
}

export default function TechnologyManagerSignupPage() {
  const [state, formAction] = useActionState(submitUnifiedApply, initialState);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const emailRef = useRef("");
  const passwordRef = useRef("");

  useEffect(() => {
    if (state.status !== "success") return;
    if (state.message === "ACCOUNT_CREATED_LOCAL") {
      navigateToAuthDestination("/application-status");
      return;
    }
    if (state.message === "ACCOUNT_CREATED") {
      setAutoLoggingIn(true);
      async function doSignIn() {
        const email = emailRef.current;
        const password = passwordRef.current;
        const supabaseClient = createBrowserClientOrNull();
        if (supabaseClient) {
          const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (!error) {
            navigateToAuthDestination("/application-status");
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
            navigateToAuthDestination("/application-status");
            return;
          }
        }
        setAutoLoginError("Your application was submitted. Sign in to check status.");
      }
      doSignIn();
    }
  }, [state.status, state.message]);

  if (autoLoggingIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360, padding: "0 24px" }}>
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          {autoLoginError ? (
            <>
              <h1 className="page-title" style={{ fontSize: 20, marginTop: 20 }}>
                Application submitted
              </h1>
              <p className="page-subtitle" style={{ fontSize: 13 }}>
                {autoLoginError}
              </p>
              <Link
                href={`/login?callbackUrl=/application-status${
                  emailRef.current ? `&email=${encodeURIComponent(emailRef.current)}` : ""
                }`}
                className="button"
                style={{ display: "inline-block", marginTop: 16, textDecoration: "none" }}
              >
                Sign in
              </Link>
              <SpamFolderNotice style={{ marginTop: 16, textAlign: "left" }} />
            </>
          ) : (
            <>
              <h1 className="page-title" style={{ fontSize: 20, marginTop: 20 }}>
                Setting up your account…
              </h1>
              <p className="page-subtitle" style={{ fontSize: 13 }}>
                Taking you to your application status
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <YppApplyShell role="staff">
      <form action={formAction}>
        <input type="hidden" name="hiringRole" value="staff" />

        <SharedApplyFields emailRef={emailRef} passwordRef={passwordRef} />

        <hr style={YPP_APPLY_HR} />

        <div>
          <div style={YPP_APPLY_SECTION_STYLE}>Technology manager details</div>
          <label className="form-label" style={{ marginTop: 0 }}>
            Grade *
            <select className="input" name="grade" required defaultValue="">
              <option value="" disabled>
                Select grade
              </option>
              <option value="9">9th</option>
              <option value="10">10th</option>
              <option value="11">11th</option>
              <option value="12">12th</option>
            </select>
          </label>
          <label className="form-label">
            Describe your experience with programming *
            <textarea
              className="input"
              name="programmingExperience"
              rows={6}
              required
              placeholder="Include any projects you have participated in."
            />
            <span style={YPP_APPLY_HELPER}>
              Experience is required for this role. Share languages, tools, and projects you’ve built
              or contributed to.
            </span>
          </label>
        </div>

        {state.status === "error" && state.message === "ACCOUNT_EXISTS_SIGNIN_REQUIRED" ? (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: 10,
              background: "#fef3c7",
              border: "1px solid #fde68a",
              fontSize: 13,
              lineHeight: 1.55,
              color: "#78350f",
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>
              You already have an account with this email.
            </strong>
            Sign in to continue your application.
            <div style={{ marginTop: 12 }}>
              <Link
                href="/login?callbackUrl=/applications/technology-manager"
                className="button"
                style={{ fontSize: 13, padding: "8px 14px", textDecoration: "none" }}
              >
                Sign in to continue
              </Link>
            </div>
          </div>
        ) : state.message &&
          state.message !== "ACCOUNT_CREATED" &&
          state.message !== "ACCOUNT_CREATED_LOCAL" ? (
          <div
            className={state.status === "error" ? "form-error" : "form-success"}
            style={{ marginTop: 16 }}
          >
            {state.message}
          </div>
        ) : null}

        <SubmitButton />
      </form>

      <div className="login-help" style={{ marginTop: 24 }}>
        Already have an account?{" "}
        <Link href="/login?callbackUrl=/applications/technology-manager">Sign in</Link>
      </div>
    </YppApplyShell>
  );
}
