"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import {
  requestPasswordReset,
  type PasswordResetFormState,
} from "@/lib/password-reset-actions";

const initialState: PasswordResetFormState = { status: "idle", message: "" };

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(requestPasswordReset, initialState);

  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header login-card-header--stacked">
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>
              Reset Your Password
            </h1>
            <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
              Enter your email to receive a reset link
            </p>
          </div>
        </div>

        {state.status === "success" ? (
          <div>
            <div className="form-success">
              {state.message}
            </div>
            <p style={{ marginTop: 16, fontSize: 14, color: "var(--muted)" }}>
              Check your inbox and spam folder. The link will expire in 1 hour.
            </p>
            <Link className="button outline" style={{ display: "block", textAlign: "center" }} href="/login">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form action={formAction}>
            <label className="form-label" style={{ marginTop: 0 }}>
              Email Address
              <input
                className="input"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </label>
            {state.status === "error" && (
              <div className="form-error">{state.message}</div>
            )}
            <SubmitButton />
          </form>
        )}

        <div className="login-help">
          Remember your password? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Sending\u2026" : "Send Reset Link"}
    </button>
  );
}
