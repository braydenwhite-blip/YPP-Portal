import Link from "next/link";

import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import type { CurrentGRSummary, ReviewHistory } from "@/lib/gr-actions";
import { ActiveReviewCycleCard } from "@/components/people-strategy/active-review-cycle-card";
import { CurrentGRCard } from "@/components/people-strategy/current-gr-card";
import { ReviewHistoryPanel } from "@/components/people-strategy/review-history-panel";
import { ReviewsSection } from "@/components/mentorship/workspace/reviews-section";
import { ReviewDraftPanel } from "@/components/mentorship/workspace/review-draft-panel";
import { ChairApprovalPanel } from "@/components/mentorship/workspace/chair-approval-panel";
import { KickoffStatusRow } from "@/components/mentorship/kickoff-status-row";
import { MenteeGoalsSection } from "@/components/mentorship/workspace/goals-section";
import { CheckInsSection } from "@/components/mentorship/workspace/sections";
import { SelfGoalsSection } from "@/components/mentorship/workspace/self-sections";
import { ReassignMentorForm } from "@/components/people-strategy/reassign-mentor-form";

type KickoffRepairInput = {
  kickoffScheduledAt: Date | null;
  kickoffCompletedAt: Date | null;
} | null;

type MentorCandidate = { id: string; name: string };

/**
 * The "Review & G&R" flow: active cycle status, repair paths, the inline
 * draft/approve steps, reviews, current G&R doc, goals + check-ins, and
 * review history. Extracted from `/people/[id]` so it can also render
 * natively as the mentee tab on `/mentorship` — same props, same behavior,
 * two hosts.
 */
export function MenteeDevelopmentPanel({
  personId,
  personName,
  workspace,
  grSummary,
  reviewHistory,
  panel,
  sectionHrefBase,
  showAdminPrompts = false,
  mentorCandidates = [],
  kickoffRepair = null,
}: {
  personId: string;
  personName: string;
  workspace: MentorshipWorkspace;
  grSummary: CurrentGRSummary | null;
  reviewHistory: ReviewHistory | null;
  panel?: string;
  sectionHrefBase?: string;
  showAdminPrompts?: boolean;
  mentorCandidates?: MentorCandidate[];
  kickoffRepair?: KickoffRepairInput;
}) {
  const base = sectionHrefBase ?? `/people/${personId}`;

  return (
    <div className="mb-4 flex flex-col gap-4">
      <ActiveReviewCycleCard cycleState={workspace.cycleState} />

      {/* Repair paths — when the loop can't run yet, the fix lives right
          here instead of deep in an admin cockpit tab. */}
      {!workspace.lifecycle.hasActiveMentorship && showAdminPrompts ? (
        <ReassignMentorForm menteeId={personId} candidates={mentorCandidates} />
      ) : null}
      {workspace.lifecycle.hasActiveMentorship &&
      !workspace.lifecycle.kickoffComplete &&
      kickoffRepair ? (
        <KickoffStatusRow
          mentorshipId={workspace.activeMentorshipId!}
          kickoffScheduledAt={kickoffRepair.kickoffScheduledAt}
          kickoffCompletedAt={kickoffRepair.kickoffCompletedAt}
          canMarkComplete={workspace.capabilities.canDraftReview}
        />
      ) : null}
      {workspace.lifecycle.hasActiveMentorship &&
      workspace.lifecycle.kickoffComplete &&
      workspace.lifecycle.grDocStatus === "NONE" &&
      showAdminPrompts ? (
        <section className="rounded-[12px] border border-[#ebebf2] bg-[#fafafd] px-4 py-3">
          <p className="m-0 text-[13.5px] text-[#1c1a2e]">
            <strong>{personName} has no Goals &amp; Responsibilities document yet.</strong>{" "}
            Reviews are far more useful once a G&amp;R plan is assigned.
          </p>
          <Link
            href="/mentorship?view=admin&tab=templates"
            className="mt-1 inline-block text-[13px] font-semibold text-[#6b21c8] hover:underline"
          >
            Assign G&amp;R goals →
          </Link>
        </section>
      ) : null}

      {/* The inline steps of the loop — ?panel=draft (mentor's review
          writer) and ?panel=approve (chair's decision). When the panel is
          asked for but it isn't that party's turn, say why instead of
          silently showing the plain profile. */}
      {panel === "draft" &&
      workspace.capabilities.canDraftReview &&
      (workspace.lifecycle.cycleStage === "REFLECTION_SUBMITTED" ||
        workspace.lifecycle.cycleStage === "CHANGES_REQUESTED") ? (
        <ReviewDraftPanel
          menteeId={personId}
          menteeName={personName}
          commitments={workspace.commitments}
        />
      ) : panel === "approve" &&
        workspace.capabilities.canApprove &&
        (workspace.lifecycle.cycleStage === "REVIEW_SUBMITTED" ||
          workspace.lifecycle.cycleStage === "CHANGES_REQUESTED") ? (
        <ChairApprovalPanel menteeId={personId} />
      ) : panel === "draft" || panel === "approve" ? (
        <section className="rounded-[12px] border border-[#ebebf2] bg-[#fafafd] px-4 py-3">
          <p className="m-0 text-[13px] text-[#717189]">
            Nothing to {panel === "draft" ? "draft" : "approve"} right now —{" "}
            {workspace.cycleState.nextAction.label}.
          </p>
        </section>
      ) : null}

      <ReviewsSection workspace={workspace} sectionHref={(s) => `${base}?section=${s}`} />

      {grSummary ? <CurrentGRCard summary={grSummary} personName={personName} /> : null}

      <details className="group overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="text-[13.5px] font-semibold text-[#1c1a2e]">Full G&amp;R &amp; check-ins</span>
          <span className="text-[12px] text-[#9a9ab0]">
            Full document, propose changes, log a check-in
            <span className="ml-2 transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-[#f1f1f6] p-4">
          {workspace.isSelf ? <SelfGoalsSection /> : <MenteeGoalsSection workspace={workspace} />}
          <CheckInsSection workspace={workspace} />
        </div>
      </details>

      {reviewHistory ? (
        <ReviewHistoryPanel history={reviewHistory} personName={personName} />
      ) : null}
    </div>
  );
}
