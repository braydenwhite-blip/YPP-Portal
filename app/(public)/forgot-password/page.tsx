"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("success");
      setMessage("If an account exists with that email, a password reset link has been sent.");
    }
    setLoading(false);
  }

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

        {status === "success" ? (
          <div>
            <div className="form-success">
              {message}
            </div>
            <p style={{ marginTop: 16, fontSize: 14, color: "var(--muted)" }}>
              Check your inbox and spam folder. The link will expire in 1 hour.
            </p>
            <Link className="button outline" style={{ display: "block", textAlign: "center" }} href="/login">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
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
            {status === "error" && (
              <div className="form-error">{message}</div>
            )}
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Sending\u2026" : "Send Reset Link"}
            </button>
          </form>
        )}

        <div className="login-help">
          Remember your password? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
