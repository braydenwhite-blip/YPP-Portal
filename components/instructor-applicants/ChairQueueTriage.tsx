import Link from "next/link";

import { ButtonLink, CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import {
  applicantAvatarColor,
  applicantInitials,
  averageReviewScore,
  formatWorkspaceDisplayName,
  recommendedNextStep,
  sortWorkspaceApplicants,
  workspaceStageLabel,
} from "@/lib/instructor-applicants/workspace-display";
import type { WorkspaceApplicant } from "./InstructorApplicantsWorkspace";

/**
 * Chair Queue triage list — the decision queue as something you work *through*.
 *
 * Each queued applicant is one scannable row carrying the four signals a chair
 * actually triages on: how long they've waited, how many panel reviews are in,
 * the average score, and the consensus recommendation. The decision itself
 * still happens in the Final Review cockpit (`/[id]/review`); this row links
 * straight there. Server-rendered — no client state, the helpers are pure.
 */

const REC_TONE: Record<
  ReturnType<typeof recommendedNextStep>["tone"],
  StatusTone
> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
};

function daysInQueue(app: WorkspaceApplicant): number | null {
  const when = app.chairQueuedAt ?? app.createdAt;
  if (!when) return null;
  return Math.floor((Date.now() - new Date(when).getTime()) / 86_400_000);
}

export default function ChairQueueTriage({
  applications,
}: {
  applications: WorkspaceApplicant[];
}) {
  const sorted = sortWorkspaceApplicants(applications);

  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {sorted.map((app) => {
        const name = formatWorkspaceDisplayName(app);
        const initials = applicantInitials(name);
        const color = applicantAvatarColor(app.id);
        const stage = workspaceStageLabel(app.status);
        const chapterName = app.applicant.chapter?.name ?? "Direct";
        const reviewCount = app.interviewReviews.length;
        const avg = averageReviewScore(app.interviewReviews);
        const rec = recommendedNextStep(app.interviewReviews);
        const days = daysInQueue(app);
        const urgent = days !== null && days >= 7;
        const reviewHref = `/admin/instructor-applicants/${app.id}/review`;

        return (
          <CardV2
            as="li"
            key={app.id}
            padding="md"
            className={urgent ? "border-danger-700/30" : undefined}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {/* Identity */}
              <div className="flex min-w-[220px] flex-1 items-center gap-3">
                <span
                  className="flex size-[40px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: color }}
                  aria-hidden
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <Link
                    href={reviewHref}
                    className="block truncate text-[14.5px] font-bold text-ink hover:underline"
                  >
                    {name}
                  </Link>
                  <p className="m-0 truncate text-[12.5px] text-ink-muted">
                    {chapterName} · {stage}
                  </p>
                </div>
              </div>

              {/* Signals */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={reviewCount > 0 ? "neutral" : "warning"}>
                  {reviewCount > 0
                    ? `${reviewCount} review${reviewCount === 1 ? "" : "s"} in`
                    : "No reviews"}
                </StatusBadge>
                {avg !== null ? (
                  <span className="whitespace-nowrap text-[12.5px] font-semibold text-ink">
                    <span aria-hidden className="text-[#e0a008]">
                      ★
                    </span>{" "}
                    {avg}
                    <span className="text-ink-muted"> / 5</span>
                  </span>
                ) : null}
                {days !== null ? (
                  <StatusBadge tone={urgent ? "danger" : days >= 3 ? "warning" : "neutral"}>
                    {days === 0 ? "Queued today" : `${days}d in queue`}
                  </StatusBadge>
                ) : null}
              </div>

              {/* Consensus + CTA */}
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone={REC_TONE[rec.tone]} title={rec.detail}>
                  {rec.label}
                </StatusBadge>
                <ButtonLink href={reviewHref} variant="primary" size="sm">
                  Open decision cockpit →
                </ButtonLink>
              </div>
            </div>
          </CardV2>
        );
      })}
    </ul>
  );
}
