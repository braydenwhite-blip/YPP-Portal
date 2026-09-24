"use client";

import type { ReactNode } from "react";

import BrandLockup from "@/components/brand-lockup";
import {
  HiringRolePicker,
  type HiringRoleId,
} from "@/components/signup/hiring-role-picker";

export const YPP_APPLY_SECTION_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export const YPP_APPLY_HR: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--border)",
  margin: "16px 0 14px",
};

export const YPP_APPLY_HELPER: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--muted)",
  marginTop: 3,
  lineHeight: 1.4,
};

const ROLE_COPY: Record<
  HiringRoleId,
  { title: string; intro: string; bullets: string[] }
> = {
  instructor: {
    title: "Instructor",
    intro:
      "Teach students in your chapter through courses or workshops. We’re looking for people who explain ideas clearly and care about student growth.",
    bullets: [
      "Lead engaging learning experiences",
      "Support students with feedback",
      "Collaborate with chapter leadership",
    ],
  },
  cp: {
    title: "Chapter President",
    intro:
      "Coordinate a local YPP chapter. We’re looking for engaged students who communicate well and reach out to many people.",
    bullets: [
      "Recruit and support volunteers and instructors",
      "Plan classes, events, and outreach",
      "Connect YPP with your school community",
    ],
  },
  staff: {
    title: "Technology Manager",
    intro:
      "Join YPP’s technology team (9th–12th grade). Programming experience is required.",
    bullets: [
      "Improve the portal and website",
      "Troubleshoot and keep systems reliable",
      "Collaborate on digital tools and content",
    ],
  },
};

/** Shared chrome for Instructor / CP / Technology Manager public apply pages. */
export function YppApplyShell({
  role,
  children,
}: {
  role: HiringRoleId;
  children: ReactNode;
}) {
  const copy = ROLE_COPY[role];

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <BrandLockup height={24} className="brand-lockup" priority reloadOnClick />
        <span className="badge" style={{ fontSize: 10, padding: "2px 8px" }}>
          YPP Application
        </span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 48px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
          Apply to YPP.
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            margin: "0 0 14px",
            lineHeight: 1.4,
            maxWidth: 480,
          }}
        >
          Choose a role, then complete the form. You can switch roles before submitting.
        </p>

        <HiringRolePicker value={role} navigateOnChange />

        <section
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd6fe",
            background: "#f5f3ff",
          }}
        >
          <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#5b21b6" }}>
            {copy.title}
          </h2>
          <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.4, color: "#4c1d95" }}>
            {copy.intro}
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 16,
              display: "grid",
              gap: 3,
            }}
          >
            {copy.bullets.map((item) => (
              <li key={item} style={{ fontSize: 12, lineHeight: 1.35, color: "#5b21b6" }}>
                {item}
              </li>
            ))}
          </ul>
          {role === "cp" ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.4, color: "#6b21c8" }}>
              Tip: start contacting your school about a YPP chapter now — it helps in interviews.
            </p>
          ) : null}
        </section>

        <div className="ypp-apply-form-compact">{children}</div>
      </div>

      <style>{`
        .ypp-apply-form-compact .form-label {
          margin-top: 10px;
          font-size: 12.5px;
        }
        .ypp-apply-form-compact .input,
        .ypp-apply-form-compact select.input,
        .ypp-apply-form-compact textarea.input {
          padding: 8px 10px;
          font-size: 13px;
          min-height: 36px;
        }
        .ypp-apply-form-compact textarea.input {
          min-height: 72px;
        }
        .ypp-apply-form-compact .grid.two {
          gap: 10px;
        }
        .ypp-apply-form-compact .button {
          margin-top: 14px !important;
          padding: 10px 14px;
          font-size: 13.5px;
        }
        @media (max-width: 560px) {
          .ypp-apply-role-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
