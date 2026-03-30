import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";

/**
 * Magic link login is now handled by Supabase Auth.
 * Supabase sends an OTP email link that redirects to /auth/callback.
 * This page serves as a fallback for legacy links.
 */
export default async function MagicLinkPage() {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header login-card-header--stacked">
          <BrandLockup height={36} className="brand-lockup" reloadOnClick />
          <div>
            <h2 className="page-title" style={{ fontSize: 20 }}>Magic Link</h2>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
          Magic link sign-in is available from the login page. Please request a new
          magic link using the toggle on the sign-in form.
        </p>
        <Link href="/login" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
