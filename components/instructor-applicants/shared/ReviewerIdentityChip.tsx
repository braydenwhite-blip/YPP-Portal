/**
 * Avatar + name + role pill — used across the score matrix, activity feed,
 * consensus callout, and queue dropdown rows. Replaces ad-hoc owner-chip
 * markup that previously appeared in `ApplicantCockpitHeader.tsx` and the
 * legacy chair workspace.
 */

import type { CSSProperties } from "react";

export type ReviewerRole =
  | "LEAD_INTERVIEWER"
  | "INTERVIEWER"
  | "REVIEWER"
  | "CHAIR"
  | "STAFF"
  | "SYSTEM";

export interface ReviewerIdentityChipProps {
  user: { id: string; name: string | null; avatarUrl?: string | null };
  role?: ReviewerRole;
  round?: number;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  className?: string;
}

const ROLE_LABELS: Record<ReviewerRole, string> = {
  LEAD_INTERVIEWER: "Lead",
  INTERVIEWER: "Interviewer",
  REVIEWER: "Reviewer",
  CHAIR: "Chair",
  STAFF: "Staff",
  SYSTEM: "System",
};

function initialsFor(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";
}

const SIZE_STYLES: Record<"sm" | "md" | "lg", { avatar: number; pad: string; font: string }> = {
  sm: { avatar: 22, pad: "4px 8px", font: "12px" },
  md: { avatar: 28, pad: "6px 10px", font: "13px" },
  lg: { avatar: 36, pad: "8px 12px", font: "15px" },
};

export default function ReviewerIdentityChip({
  user,
  role,
  round,
  size = "md",
  onClick,
  className,
}: ReviewerIdentityChipProps) {
  const sizing = SIZE_STYLES[size];
  const isClickable = Boolean(onClick);
  const Tag = isClickable ? "button" : "span";

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: sizing.pad,
    borderRadius: "999px",
    background: "var(--cockpit-surface, #fff)",
    border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
    color: "var(--ink-default, #1a0533)",
    fontSize: sizing.font,
    cursor: isClickable ? "pointer" : "default",
  };

  return (
    <Tag
      type={isClickable ? "button" : undefined}
      onClick={onClick}
      className={`reviewer-identity-chip${className ? ` ${className}` : ""}`}
      style={style}
    >
      <span
        aria-hidden="true"
        style={{
          width: sizing.avatar,
          height: sizing.avatar,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, var(--ypp-purple-500, #8b3fe8), var(--ypp-purple-600, #6b21c8))",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: Math.round(sizing.avatar * 0.42),
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar is small, no LCP impact
          <img
            src={user.avatarUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initialsFor(user.name)
        )}
      </span>
      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.15 }}>
        <span style={{ fontWeight: 600 }}>{user.name ?? "Unknown"}</span>
        {(role || round !== undefined) && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--ink-muted, #6b5f7a)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {role ? ROLE_LABELS[role] : ""}
            {role && round !== undefined ? " · " : ""}
            {round !== undefined ? `Round ${round}` : ""}
          </span>
        )}
      </span>
    </Tag>
  );
}
