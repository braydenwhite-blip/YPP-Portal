/**
 * When the application is no longer in CHAIR_REVIEW, the snapshot bar shows
 * an audit-mode banner instead of the readiness meter. (§6.7)
 */

import type { ChairDecisionAction, InstructorApplicationStatus } from "@prisma/client";
import { BannerV2, cn } from "@/components/ui-v2";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approved",
  APPROVE_WITH_CONDITIONS: "Approved with conditions",
  REJECT: "Rejected",
  HOLD: "On hold",
  WAITLIST: "Waitlisted",
  REQUEST_INFO: "Info requested",
  REQUEST_SECOND_INTERVIEW: "Sent to second interview",
};

type BannerTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const STATUS_TONE: Partial<
  Record<InstructorApplicationStatus, { tone: BannerTone; fg: string; accent: string }>
> = {
  APPROVED: { tone: "success", fg: "text-success-700", accent: "border-l-success-700" },
  REJECTED: { tone: "danger", fg: "text-danger-700", accent: "border-l-danger-700" },
  ON_HOLD: { tone: "warning", fg: "text-warning-700", accent: "border-l-warning-700" },
  INFO_REQUESTED: { tone: "info", fg: "text-info-700", accent: "border-l-info-700" },
  WITHDRAWN: { tone: "neutral", fg: "text-ink-muted", accent: "border-l-ink-muted" },
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
  const tone = STATUS_TONE[status] ?? {
    tone: "brand" as BannerTone,
    fg: "text-brand-700",
    accent: "border-l-brand-600",
  };
  const actionLabel = latestDecision ? ACTION_LABEL[latestDecision.action] : status;
  const decidedRel = latestDecision ? relativeTime(latestDecision.decidedAt) : null;

  return (
    <BannerV2
      tone={tone.tone}
      role="status"
      motionKey="applicant-status-banner"
      className={cn(
        "applicant-status-banner inline-flex w-auto items-center gap-2.5 border-l-4 px-4 py-2.5 text-[13px] leading-[1.4] text-ink",
        tone.accent
      )}
    >
      <span className={cn("font-bold", tone.fg)}>{actionLabel}</span>
      {decidedByName ? <span className="text-ink-muted"> by {decidedByName}</span> : null}
      {decidedRel ? <span className="text-ink-muted"> · {decidedRel}</span> : null}
      {canRescind && onRescindClick ? (
        <button
          type="button"
          onClick={onRescindClick}
          className="ml-1.5 cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-danger-700 underline underline-offset-2"
        >
          Rescind
        </button>
      ) : null}
    </BannerV2>
  );
}
