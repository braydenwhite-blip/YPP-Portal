import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";

/**
 * Email verification is now handled by Supabase Auth automatically.
 * Supabase sends a confirmation email on signup and redirects to /auth/confirm.
 * This page serves as a fallback for legacy links or manual navigation.
 */
export default async function VerifyEmailPage() {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header login-card-header--stacked">
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          <div>
            <h2 className="page-title" style={{ fontSize: 20 }}>Email Verification</h2>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
          Email verification is handled automatically. Check your inbox for a
          verification link from Supabase. If you&apos;ve already verified your
          email, you can sign in below.
        </p>

        <Link href="/login" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
          Sign In
        </Link>

        <div style={{ marginTop: 16 }}>
          <Link href="/login" style={{ fontSize: 13, color: "var(--muted)" }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
