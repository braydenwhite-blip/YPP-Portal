"use client";

import type { ReactNode } from "react";

import BrandLockup from "@/components/brand-lockup";
import {
  HiringRolePicker,
  type HiringRoleId,
} from "@/components/signup/hiring-role-picker";

export const YPP_APPLY_SECTION_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--muted)",
  marginBottom: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export const YPP_APPLY_HR: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--border)",
  margin: "24px 0 20px",
};

export const YPP_APPLY_HELPER: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--muted)",
  marginTop: 5,
  lineHeight: 1.5,
};

const ROLE_COPY: Record<
  HiringRoleId,
  { title: string; intro: string; bullets: string[] }
> = {
  instructor: {
    title: "Instructor",
    intro:
      "Teach students in your chapter through courses or workshops. We’re looking for people who can explain ideas clearly and care about student growth.",
    bullets: [
      "Design and lead engaging learning experiences",
      "Support students through class sessions and feedback",
      "Collaborate with your chapter leadership and YPP staff",
    ],
  },
  cp: {
    title: "Chapter President",
    intro:
      "Coordinate the launch and operation of a Youth Passion Project chapter in your local community. We’re looking for engaged students who communicate well and aren’t afraid to reach out to many people.",
    bullets: [
      "Lead recruitment, management, and support of student volunteers and instructors",
      "Plan and oversee classes, events, and outreach to grow your chapter",
      "Serve as a key point of communication between YPP and your school district",
      "Represent Youth Passion Project professionally in your school and community",
    ],
  },
  staff: {
    title: "Technology Manager",
    intro:
      "Join YPP’s technology team. Eligibility: 9th–12th grade, enrolled in high school. Programming experience is required.",
    bullets: [
      "Design engaging ways to present YPP online",
      "Oversee development and ongoing improvement of the YPP portal and website",
      "Maintain and troubleshoot technical issues so the platform stays reliable",
      "Collaborate with design and outreach on digital content and tools",
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
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <BrandLockup height={30} className="brand-lockup" priority reloadOnClick />
        <span className="badge" style={{ fontSize: 11 }}>
          YPP Application
        </span>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 32px 80px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>Apply to YPP.</h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--muted)",
            margin: "0 0 20px",
            lineHeight: 1.5,
            maxWidth: 560,
          }}
        >
          Choose the role you want, then complete the application. You can switch roles anytime
          before you submit.
        </p>

        <HiringRolePicker value={role} navigateOnChange />

        <section
          style={{
            marginBottom: 28,
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid #ddd6fe",
            background: "#f5f3ff",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#5b21b6" }}>
            {copy.title}
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: "#4c1d95" }}>
            {copy.intro}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {copy.bullets.map((item) => (
              <li key={item} style={{ fontSize: 13, lineHeight: 1.45, color: "#5b21b6" }}>
                {item}
              </li>
            ))}
          </ul>
          {role === "cp" ? (
            <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: "#6b21c8" }}>
              Tip: start contacting your school’s administration about establishing a YPP chapter
              now — it helps in interviews.
            </p>
          ) : null}
        </section>

        {children}
      </div>
    </div>
  );
}
