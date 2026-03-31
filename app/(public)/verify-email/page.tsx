import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";

/**
 * Legacy fallback page.
 *
 * Some auth flows may still send email links through Supabase, but accounts created
 * through the portal signup form are confirmed immediately and do not need a
 * separate verification email.
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
          If you arrived here from an older email link, you can go back to sign in.
          Accounts created through the portal signup form do not need a separate
          verification step.
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
