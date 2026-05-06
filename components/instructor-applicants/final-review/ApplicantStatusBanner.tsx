/**
 * When the application is no longer in CHAIR_REVIEW, the snapshot bar shows
 * an audit-mode banner instead of the readiness meter. (§6.7)
 */

import type { ChairDecisionAction, InstructorApplicationStatus } from "@prisma/client";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved with conditions",
  REJECT: "Rejected",
  HOLD: "On hold",
  WAITLIST: "Waitlisted",
  REQUEST_INFO: "Info requested",
  REQUEST_SECOND_INTERVIEW: "Sent to second interview",
};

const STATUS_TONE: Partial<Record<InstructorApplicationStatus, { fg: string; bg: string }>> = {
  APPROVED: { fg: "#15803d", bg: "rgba(22, 163, 74, 0.1)" },
  REJECTED: { fg: "#b91c1c", bg: "rgba(239, 68, 68, 0.1)" },
  ON_HOLD: { fg: "#a16207", bg: "rgba(234, 179, 8, 0.12)" },
  INFO_REQUESTED: { fg: "#1d4ed8", bg: "rgba(59, 130, 246, 0.1)" },
  WITHDRAWN: { fg: "#6b5f7a", bg: "rgba(168, 156, 184, 0.18)" },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export interface ApplicantStatusBannerProps {
  status: InstructorApplicationStatus;
  latestDecision: { action: ChairDecisionAction; decidedAt: string } | null;
  decidedByName?: string | null;
  canRescind?: boolean;
  onRescindClick?: () => void;
}

export default function ApplicantStatusBanner({
  status,
  latestDecision,
  decidedByName,
  canRescind,
  onRescindClick,
}: ApplicantStatusBannerProps) {
  const tone = STATUS_TONE[status] ?? { fg: "#5a1da8", bg: "rgba(107, 33, 200, 0.1)" };
  const actionLabel = latestDecision ? ACTION_LABEL[latestDecision.action] : status;
  const decidedRel = latestDecision ? relativeTime(latestDecision.decidedAt) : null;

  return (
    <div
      className="applicant-status-banner"
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: 12,
        background: tone.bg,
        borderLeft: `4px solid ${tone.fg}`,
        color: "var(--ink-default, #1a0533)",
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <span style={{ color: tone.fg, fontWeight: 700 }}>{actionLabel}</span>
      {decidedByName ? (
        <span style={{ color: "var(--ink-muted, #6b5f7a)" }}>by {decidedByName}</span>
      ) : null}
      {decidedRel ? (
        <span style={{ color: "var(--ink-muted, #6b5f7a)" }}>· {decidedRel}</span>
      ) : null}
      {canRescind && onRescindClick ? (
        <button
          type="button"
          onClick={onRescindClick}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            marginLeft: 6,
            color: "#b91c1c",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Rescind
        </button>
      ) : null}
    </div>
  );
}
