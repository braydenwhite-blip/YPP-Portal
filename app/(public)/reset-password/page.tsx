"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { validateResetToken, resetPassword, ActionResult } from "@/lib/password-reset-actions";

const initialState: ActionResult = { status: "idle", message: "" };

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [state, formAction] = useFormState(resetPassword, initialState);

  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setTokenError("Invalid reset link. Please request a new password reset.");
        setValidating(false);
        return;
      }

      const result = await validateResetToken(token);
      setTokenValid(result.valid);
      setTokenError(result.error || null);
      setEmail(result.email || null);
      setValidating(false);
    }

    checkToken();
  }, [token]);

  if (validating) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center", textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center" }}>
          <div className="login-card-header">
            <Image
              src="/logo-icon.svg"
              alt="YPP"
              width={44}
              height={44}
            />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>
                Reset Link Invalid
              </h1>
            </div>
          </div>
          <div className="form-error">
            {tokenError || "This reset link is invalid or has expired."}
          </div>
          <Link className="button" style={{ display: "block", textAlign: "center" }} href="/forgot-password">
            Request New Reset Link
          </Link>
          <div className="login-help">
            Remember your password? <Link href="/login">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center" }}>
          <div className="login-card-header">
            <Image
              src="/logo-icon.svg"
              alt="YPP"
              width={44}
              height={44}
            />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>
                Password Reset Complete
              </h1>
            </div>
          </div>
          <div className="form-success">
            {state.message}
          </div>
          <Link className="button" style={{ display: "block", textAlign: "center" }} href="/login">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header">
          <Image
            src="/logo-icon.svg"
            alt="YPP"
            width={44}
            height={44}
          />
          <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>
              Create New Password
            </h1>
            {email && (
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                For {email}
              </p>
            )}
          </div>
        </div>

        <form action={formAction}>
          <input type="hidden" name="token" value={token} />

          <label className="form-label" style={{ marginTop: 0 }}>
            New Password
            <input
              className="input"
              name="password"
              type="password"
              placeholder="Min 8 characters, letter + number"
              minLength={8}
              required
            />
          </label>

          <label className="form-label">
            Confirm Password
            <input
              className="input"
              name="confirmPassword"
              type="password"
              placeholder="Enter password again"
              minLength={8}
              required
            />
          </label>

          {state.status === "error" && (
            <div className="form-error">{state.message}</div>
          )}

          <button className="button" type="submit">
            Reset Password
          </button>
        </form>

        <div className="login-help">
          Remember your password? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
