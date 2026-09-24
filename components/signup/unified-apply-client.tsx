"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import BrandLockup from "@/components/brand-lockup";
import {
  HiringRolePicker,
  goToHiringRole,
  hiringRoleContinueLabel,
  type HiringRoleId,
} from "@/components/signup/hiring-role-picker";
import { UNIFIED_APPLICATION_STEPS } from "@/lib/unified-application/flow";

export function UnifiedApplyClient() {
  const router = useRouter();
  const [role, setRole] = useState<HiringRoleId>("instructor");

  return (
    <div className="login-shell">
      <div className="login-grid">
        <section className="login-hero">
          <div className="login-logo login-logo--lockup">
            <BrandLockup height={52} className="brand-lockup" priority reloadOnClick />
          </div>
          <h1 className="page-title" style={{ fontSize: 32, marginTop: 20 }}>
            Apply to YPP
          </h1>
          <p className="page-subtitle" style={{ maxWidth: 440, lineHeight: 1.55 }}>
            Choose the role you want, then continue — instructor, chapter president,
            technology manager, or general interest if you&apos;re still exploring.
          </p>

          <ul
            style={{
              margin: "24px 0 0",
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 12,
            }}
          >
            {UNIFIED_APPLICATION_STEPS.slice(0, 3).map((item) => (
              <li
                key={item.step}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--ypp-purple-100, #f3e8ff)",
                    color: "var(--ypp-purple-800, #5b21b6)",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.step}
                </span>
                <span>
                  <strong style={{ display: "block", fontWeight: 600 }}>{item.title}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="login-card login-card--brand" style={{ alignSelf: "start" }}>
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={40} className="brand-lockup" reloadOnClick />
            <div>
              <h2 className="login-card-welcome-title">Get started</h2>
              <p className="login-card-welcome-subtitle">Pick a role to continue</p>
            </div>
          </div>

          <HiringRolePicker value={role} onChange={setRole} layout="stack" />

          <button
            type="button"
            className="button"
            style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
            onClick={() => goToHiringRole(role, router)}
          >
            {hiringRoleContinueLabel(role)}
          </button>

          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
