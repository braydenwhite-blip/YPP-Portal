"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import { createBrowserClientOrNull } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

function ResetPasswordPageContent() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserClientOrNull();
  const resetUnavailable = !supabase;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setStatus("error");
      setMessage("Password must contain at least one letter and one number.");
      setLoading(false);
      return;
    }

    if (!supabase) {
      setStatus("error");
      setMessage(
        "Password reset links are unavailable until Supabase public auth is configured."
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("success");
      setMessage("Your password has been reset successfully.");
    }
    setLoading(false);
  }

  if (status === "success") {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center" }}>
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>
                Password Reset Complete
              </h1>
            </div>
          </div>
          <div className="form-success">
            {message}
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
        <div className="login-card-header login-card-header--stacked">
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>
              Create New Password
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {resetUnavailable ? (
            <div className="form-error" style={{ marginBottom: 12 }}>
              Password reset links are unavailable until Supabase public auth is configured.
            </div>
          ) : null}
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

          {status === "error" && (
            <div className="form-error">{message}</div>
          )}

          <button className="button" type="submit" disabled={loading || resetUnavailable}>
            {loading ? "Resetting\u2026" : "Reset Password"}
          </button>
        </form>

        <div className="login-help">
          Remember your password? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordLoading() {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center", textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      </div>
    </div>
  );
}
