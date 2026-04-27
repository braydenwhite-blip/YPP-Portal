/**
 * Avatar + name + status pill + chapter + subject + days-in-queue.
 * Used in the snapshot bar, in the confirm modal header, and in queue
 * dropdown rows. (§6.3 of the redesign plan.)
 */

import type { CSSProperties } from "react";
import type { InstructorApplicationStatus } from "@prisma/client";

export interface ApplicantIdentityProps {
  applicant: { id: string; name: string | null; avatarUrl?: string | null };
  preferredFirstName?: string | null;
  legalName?: string | null;
  status?: InstructorApplicationStatus;
  chapterName?: string | null;
  subjectsOfInterest?: string | null;
  daysInQueue?: number | null;
  schoolName?: string | null;
  graduationYear?: number | null;
  size?: "sm" | "md" | "lg";
  showSchoolLine?: boolean;
}

const SIZE: Record<"sm" | "md" | "lg", { avatar: number; name: number; meta: number; gap: number }> = {
  sm: { avatar: 28, name: 13, meta: 11, gap: 8 },
  md: { avatar: 40, name: 16, meta: 12, gap: 12 },
  lg: { avatar: 52, name: 22, meta: 13, gap: 14 },
};

const STATUS_LABELS: Partial<Record<InstructorApplicationStatus, string>> = {
  CHAIR_REVIEW: "Chair Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  INFO_REQUESTED: "Info Requested",
  WITHDRAWN: "Withdrawn",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  PRE_APPROVED: "Pre-Approved",
  UNDER_REVIEW: "Under Review",
  SUBMITTED: "Submitted",
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  CHAIR_REVIEW: { bg: "rgba(107, 33, 200, 0.12)", fg: "#5a1da8" },
  APPROVED: { bg: "rgba(22, 163, 74, 0.14)", fg: "#15803d" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.14)", fg: "#b91c1c" },
  ON_HOLD: { bg: "rgba(234, 179, 8, 0.14)", fg: "#a16207" },
  INFO_REQUESTED: { bg: "rgba(59, 130, 246, 0.14)", fg: "#1d4ed8" },
  WITHDRAWN: { bg: "rgba(168, 156, 184, 0.18)", fg: "#6b5f7a" },
};

function initialsFor(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";
}

function deriveDisplayName({
  preferredFirstName,
  legalName,
  applicant,
}: ApplicantIdentityProps): string {
  return (
    preferredFirstName?.trim() ||
    legalName?.trim() ||
    applicant.name?.trim() ||
    "Applicant"
  );
}

export default function ApplicantIdentity(props: ApplicantIdentityProps) {
  const {
    applicant,
    legalName,
    preferredFirstName,
    status,
    chapterName,
    subjectsOfInterest,
    daysInQueue,
    schoolName,
    graduationYear,
    size = "md",
    showSchoolLine = size !== "sm",
  } = props;

  const sizing = SIZE[size];
  const displayName = deriveDisplayName(props);
  const statusLabel = status ? STATUS_LABELS[status] : null;
  const statusTone = status ? STATUS_TONE[status] : null;

  const subjectsArr = (subjectsOfInterest ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const visibleSubjects = subjectsArr.slice(0, 2);
  const overflow = Math.max(0, subjectsArr.length - visibleSubjects.length);

  const avatarStyle: CSSProperties = {
    width: sizing.avatar,
    height: sizing.avatar,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--ypp-purple-500, #8b3fe8), var(--ypp-purple-600, #6b21c8))",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: Math.round(sizing.avatar * 0.4),
    flexShrink: 0,
    overflow: "hidden",
  };

  return (
    <div
      className={`applicant-identity size-${size}`}
      style={{ display: "inline-flex", alignItems: "center", gap: sizing.gap, minWidth: 0 }}
    >
      <span aria-hidden="true" style={avatarStyle}>
        {applicant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar is small, no LCP impact
          <img
            src={applicant.avatarUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initialsFor(displayName)
        )}
      </span>
      <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            aria-label={legalName ?? displayName}
            style={{
              fontSize: sizing.name,
              fontWeight: 600,
              color: "var(--ink-default, #1a0533)",
              maxWidth: 280,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </span>
          {legalName && legalName !== displayName ? (
            <span
              style={{
                fontSize: sizing.meta,
                color: "var(--ink-muted, #6b5f7a)",
                fontWeight: 400,
              }}
            >
              ({legalName})
            </span>
          ) : null}
          {statusLabel ? (
            <span
              className={`pill pill-${(status ?? "").toLowerCase()}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                background: statusTone?.bg ?? "rgba(107, 33, 200, 0.12)",
                color: statusTone?.fg ?? "#5a1da8",
              }}
            >
              {statusLabel}
            </span>
          ) : null}
        </span>
        {(chapterName || subjectsArr.length > 0 || daysInQueue !== null) && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              fontSize: sizing.meta,
              color: "var(--ink-muted, #6b5f7a)",
            }}
          >
            {chapterName ? <span>{chapterName}</span> : null}
            {chapterName && subjectsArr.length > 0 ? <span aria-hidden="true">·</span> : null}
            {visibleSubjects.length > 0 ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {visibleSubjects.join(", ")}
                {overflow > 0 ? (
                  <span title={subjectsArr.join(", ")}>+{overflow} more</span>
                ) : null}
              </span>
            ) : null}
            {(chapterName || subjectsArr.length > 0) && daysInQueue !== null && daysInQueue !== undefined ? (
              <span aria-hidden="true">·</span>
            ) : null}
            {daysInQueue !== null && daysInQueue !== undefined ? (
              <span>
                {daysInQueue >= 1
                  ? `${daysInQueue}d in queue`
                  : "queued today"}
              </span>
            ) : null}
          </span>
        )}
        {showSchoolLine && (schoolName || graduationYear) ? (
          <span style={{ fontSize: sizing.meta - 1, color: "var(--ink-faint, #a89cb8)" }}>
            {schoolName}
            {schoolName && graduationYear ? " · " : ""}
            {graduationYear ? `Class of ${graduationYear}` : ""}
          </span>
        ) : null}
      </span>
    </div>
  );
}
