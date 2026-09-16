"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import BrandLockup from "@/components/brand-lockup";
import {
  HiringRolePicker,
  hiringRoleContinueLabel,
  hiringRoleHref,
  type HiringRoleId,
} from "@/components/signup/hiring-role-picker";
import { UNIFIED_APPLICATION_STEPS } from "@/lib/unified-application/flow";

export function UnifiedApplyClient() {
  const router = useRouter();
  const [role, setRole] = useState<HiringRoleId>("instructor");

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
          <p className="page-subtitle" style={{ maxWidth: 440, lineHeight: 1.55 }}>
            Select a role, then continue to that application — instructor, chapter
            president, or technology manager.
          </p>
        </section>

        <div className="login-card" style={{ alignSelf: "start" }}>
          <HiringRolePicker value={role} onChange={setRole} />

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

          <button
            type="button"
            className="button"
            style={{ width: "100%", marginBottom: 12 }}
            onClick={() => router.push(hiringRoleHref(role))}
          >
            {hiringRoleContinueLabel(role)}
          </button>

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
