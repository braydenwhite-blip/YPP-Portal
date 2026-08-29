import Link from "next/link";

import BrandLockup from "@/components/brand-lockup";
import { UNIFIED_APPLICATION_STEPS } from "@/lib/unified-application/flow";

export const metadata = {
  title: "Apply — Instructor & Leadership — YPP Pathways Portal",
};

/**
 * Unified entry for instructor + leadership hiring (Phase 1).
 * Full merge of signup flows is in progress; Phase 1 currently uses instructor signup.
 */
export default function UnifiedApplyPage() {
  return (
    <div className="login-shell">
      <div className="login-grid" style={{ maxWidth: 960 }}>
        <section className="login-hero">
          <div className="login-logo login-logo--lockup">
            <BrandLockup height={40} className="brand-lockup" reloadOnClick />
          </div>
          <h1 className="page-title" style={{ fontSize: 28, marginTop: 16 }}>
            Apply to YPP
          </h1>
          <p className="page-subtitle" style={{ maxWidth: 420, lineHeight: 1.55 }}>
            One application for <strong>instructor</strong> and <strong>leadership</strong> paths.
            Start with basic info and your resume — detailed prompts come later if we move forward.
          </p>
        </section>

        <div className="login-card" style={{ alignSelf: "start" }}>
          <h2 className="page-title" style={{ fontSize: 18, marginTop: 0 }}>
            How it works
          </h2>
          <ol style={{ margin: "0 0 24px", paddingLeft: 20, display: "grid", gap: 14 }}>
            {UNIFIED_APPLICATION_STEPS.map((item) => (
              <li key={item.step} style={{ fontSize: 14, lineHeight: 1.5 }}>
                <strong>{item.title}</strong>
                <span style={{ display: "block", color: "var(--muted)", marginTop: 4 }}>
                  {item.body}
                </span>
              </li>
            ))}
          </ol>

          <Link
            href="/signup/instructor"
            className="button"
            style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 12 }}
          >
            Start application (Phase 1)
          </Link>

          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--primary)" }}>
              Sign in
            </Link>{" "}
            to check status.
          </p>
        </div>
      </div>
    </div>
  );
}
