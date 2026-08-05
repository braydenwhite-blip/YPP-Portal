import {
  CardV2,
  EmptyStateV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { mentorshipRequiresChairApproval } from "@/lib/mentorship-canonical";
import { getCurrentCycleMonth } from "@/lib/mentorship-cycle";
import { getGoalsForMentee } from "@/lib/mentorship-gr-binding";
import {
  unpackProgressNarrative,
  parseCollaborateWith,
} from "@/lib/mentorship/monthly-progress-update-shared";
import { ensurePathwayCompetencyGoals } from "@/lib/mentorship/ensure-pathway-competency-goals";
import {
  bandRubricRows,
  dualBandBulletsForProgressGoal,
  resolveProgressRubricContext,
  type ProgressRubricContext,
} from "@/lib/mentorship/progress-rubric";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import type { GoalRatingColor } from "@prisma/client";
import { readReviewDocumentTitle } from "@/lib/mentorship/review-document-meta";

import {
  ProgressUpdateForm,
  type ProgressEmployeeProfile,
  type ProgressGoalDraft,
  type ProgressReviewTeamAssign,
} from "./progress-update-form";
import { ShareProgressUpdateControls } from "./share-progress-update";
import {
  ReviewCopySwitcher,
  type ReviewCopyOption,
} from "./review-copy-switcher";

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** e.g. "July 2026" — monthly performance review covers the prior calendar month. */
function formatReviewPeriodLabel(cycleMonth: Date): string {
  return cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type ComposeState = {
  mentorshipId: string;
  requiresChair: boolean;
  existingStatus: string | null;
  existingReviewId: string | null;
  /** When set, this copy was already released to the mentee. */
  releasedToMenteeAt: Date | null;
  cycleMonth: Date;
  documentTitle: string | null;
  rubric: ProgressRubricContext;
  bandReference: Array<{ number: number; title: string; bullets: string[] }>;
  draft: {
    overallRating: GoalRatingColor | null;
    overallComments: string;
    strengths: string;
    areas: string;
    plan: string;
    goals: ProgressGoalDraft[];
  };
};

/**
 * Progress update — mentor fills the Monthly Progress Update and sends it to
 * the mentee (via chair when required). Mentees see released updates here.
 */
export async function ProgressUpdateSection({
  workspace,
  justSent = false,
  pendingChair = false,
  reviewId,
  sectionHref,
}: {
  workspace: MentorshipWorkspace;
  justSent?: boolean;
  pendingChair?: boolean;
  /** Open a specific review document copy when provided. */
  reviewId?: string;
  sectionHref?: (sectionId: string) => string;
}) {
  const { isSelf, person, capabilities, lifecycle, activeMentorshipId } = workspace;
  const canCompose =
    !isSelf &&
    (workspace.isMentor ||
      capabilities.canDraftReview ||
      workspace.isAdmin);

  // Mentor / Role Chair edits on this form are admin-only.
  const canAssignReviewTeam = workspace.isAdmin;

  let reviewTeamAssign: ProgressReviewTeamAssign | null = null;
  if (canAssignReviewTeam) {
    const [mentorCandidates, chairCandidates] = await Promise.all([
      prisma.user.findMany({
        where: {
          archivedAt: null,
          id: { not: person.id },
          OR: [
            {
              primaryRole: {
                in: ["ADMIN", "STAFF", "MENTOR", "CHAPTER_PRESIDENT", "HIRING_CHAIR"],
              },
            },
            { mentorPairs: { some: { status: "ACTIVE" } } },
          ],
        },
        select: { id: true, name: true, primaryRole: true, title: true, canonicalTitle: true },
        orderBy: { name: "asc" },
        take: 400,
      }),
      prisma.user.findMany({
        where: {
          archivedAt: null,
          id: { not: person.id },
          OR: [
            {
              primaryRole: {
                in: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"],
              },
            },
            {
              roles: {
                some: {
                  role: {
                    in: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"],
                  },
                },
              },
            },
          ],
        },
        select: { id: true, name: true, primaryRole: true, title: true, canonicalTitle: true },
        orderBy: { name: "asc" },
        take: 400,
      }),
    ]);

    const mapCandidate = (c: {
      id: string;
      name: string | null;
      primaryRole: string | null;
      title: string | null;
      canonicalTitle: string | null;
    }) => ({
      id: c.id,
      name: c.name?.trim() || "Unknown",
      role: c.primaryRole,
      title: c.title?.trim() || c.canonicalTitle?.trim() || null,
    });

    reviewTeamAssign = {
      canAssign: true,
      mentorId: workspace.overview.mentorId,
      chairId: workspace.overview.chairId,
      hasActiveMentorship: Boolean(activeMentorshipId),
      mentorCandidates: mentorCandidates.map(mapCandidate),
      chairCandidates: chairCandidates.map(mapCandidate),
    };
  }

  const allCopies = await prisma.mentorGoalReview.findMany({
    where: {
      menteeId: person.id,
      ...(isSelf ? { releasedToMenteeAt: { not: null } } : {}),
    },
    orderBy: [{ cycleMonth: "desc" }, { createdAt: "desc" }],
    take: 24,
    select: {
      id: true,
      cycleMonth: true,
      isQuarterly: true,
      status: true,
      releasedToMenteeAt: true,
      overallRating: true,
      overallComments: true,
      planOfAction: true,
      mentor: { select: { name: true } },
      nextMonthGoalDraftsJson: true,
    },
  });

  const released = allCopies.filter((r) => r.releasedToMenteeAt);

  if (!lifecycle.hasActiveMentorship && allCopies.length === 0) {
    return (
      <EmptyStateV2
        title="No progress updates yet"
        body={
          isSelf
            ? "Once you have a mentor, monthly progress updates will show up here."
            : "Progress updates start after they have a mentor."
        }
      />
    );
  }

  const { cycleMonth: currentCycleMonth, cycleLabel } = getCurrentCycleMonth();
  const menteeFirst =
    person.name.trim().split(/\s+/)[0] || (isSelf ? "Your" : "Their");

  const progressBase =
    sectionHref?.("progress") ??
    `/mentorship/people/${person.id}?section=progress`;

  const selectedCopy =
    (reviewId
      ? allCopies.find((c) => c.id === reviewId)
      : null) ??
    allCopies.find((c) => c.status === "DRAFT") ??
    allCopies.find((c) => c.status === "PENDING_CHAIR_APPROVAL") ??
    allCopies[0] ??
    null;

  const selectedCycleMonth = selectedCopy?.cycleMonth ?? currentCycleMonth;

  let compose: ComposeState | null = null;
  let composeError: string | null = null;

  if (canCompose && activeMentorshipId) {
    try {
      compose = await loadComposeState({
        mentorshipId: activeMentorshipId,
        personId: person.id,
        cycleMonth: selectedCycleMonth,
        reviewId: selectedCopy?.id ?? reviewId,
      });
    } catch (err) {
      composeError =
        err instanceof Error ? err.message : "Could not load the write form.";
      const fallbackRubric = resolveProgressRubricContext({ primaryRole: null });
      compose = {
        mentorshipId: activeMentorshipId,
        requiresChair: false,
        existingStatus: null,
        existingReviewId: selectedCopy?.id ?? null,
        releasedToMenteeAt: selectedCopy?.releasedToMenteeAt ?? null,
        cycleMonth: selectedCycleMonth,
        documentTitle: readReviewDocumentTitle(
          selectedCopy?.nextMonthGoalDraftsJson,
        ),
        rubric: fallbackRubric,
        bandReference: bandRubricRows({
          trackId: fallbackRubric.trackId,
          roleId: fallbackRubric.roleId,
        }),
        draft: {
          overallRating: null,
          overallComments: "",
          strengths: "",
          areas: "",
          plan: "",
          goals: [],
        },
      };
    }
  }

  const lockedApproved =
    compose?.existingStatus === "APPROVED" && Boolean(compose.existingReviewId);
  const lockedPending =
    compose?.existingStatus === "PENDING_CHAIR_APPROVAL" &&
    Boolean(compose.existingReviewId);
  const isSentCopy = Boolean(compose?.releasedToMenteeAt);
  const showWriteForm = canCompose && compose != null;

  const activeReviewId = compose?.existingReviewId ?? selectedCopy?.id ?? null;
  const periodLabel =
    compose?.documentTitle?.trim() ||
    readReviewDocumentTitle(selectedCopy?.nextMonthGoalDraftsJson) ||
    formatReviewPeriodLabel(compose?.cycleMonth ?? selectedCycleMonth);

  const copyOptions: ReviewCopyOption[] = allCopies.map((c) => {
    const titleCycle = c.cycleMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const title =
      readReviewDocumentTitle(c.nextMonthGoalDraftsJson) ||
      `${titleCycle} Performance Review`;
    const statusLabel =
      c.releasedToMenteeAt
        ? "· Sent"
        : c.status === "PENDING_CHAIR_APPROVAL"
          ? "· Chair"
          : c.status === "DRAFT"
            ? "· Draft"
            : "";
    return {
      id: c.id,
      title,
      statusLabel,
      href: `${progressBase}${progressBase.includes("?") ? "&" : "?"}reviewId=${encodeURIComponent(c.id)}`,
      pdfHref: `/mentorship/people/${person.id}/monthly-update/print?reviewId=${encodeURIComponent(c.id)}&month=${encodeURIComponent(monthKey(c.cycleMonth))}`,
    };
  });

  const monthKeyValue = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  const activePdfHref = activeReviewId
    ? `/mentorship/people/${person.id}/monthly-update/print?reviewId=${encodeURIComponent(activeReviewId)}&month=${encodeURIComponent(monthKeyValue(compose?.cycleMonth ?? selectedCycleMonth))}`
    : null;

  // Mentor write path: only the Performance Review form (mockup).
  if (showWriteForm && compose) {
    return (
      <div id="write-progress-update" className="flex flex-col gap-4">
        {copyOptions.length > 0 ? (
          <ReviewCopySwitcher
            key={activeReviewId ?? "none"}
            copies={copyOptions}
            activeId={activeReviewId}
          />
        ) : null}

        {isSentCopy || justSent ? (
          <CardV2 padding="md" className="border-l-4 border-l-complete-700">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-complete-800">
              Review sent
            </p>
            <p className="m-0 mt-1 text-[14px] font-semibold text-ink">
              {justSent && !isSentCopy
                ? lockedApproved
                  ? "Updated version sent"
                  : "Sent"
                : "You’re editing a review that was already sent"}
            </p>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              {menteeFirst} can already see this copy. Save and send again to push
              an updated version. You can print a PDF anytime from the button below.
            </p>
            {activePdfHref ? (
              <div className="mt-3">
                <a
                  href={activePdfHref}
                  className="inline-flex min-h-8 items-center justify-center rounded-full bg-brand-600 px-3.5 text-[12.5px] font-semibold text-white no-underline hover:brightness-95"
                >
                  Print / download PDF
                </a>
              </div>
            ) : null}
          </CardV2>
        ) : activePdfHref ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={activePdfHref}
              className="inline-flex min-h-8 items-center justify-center rounded-full border border-line-soft bg-white px-3.5 text-[12.5px] font-semibold text-ink no-underline hover:border-brand-300 hover:text-brand-800"
            >
              Print / download PDF
            </a>
            <span className="text-[12.5px] text-ink-muted">
              Works for drafts and sent copies.
            </span>
          </div>
        ) : null}

        {pendingChair ? (
          <CardV2 padding="md" className="border-l-4 border-l-progress-700">
            <p className="m-0 text-[14px] font-semibold text-ink">
              Waiting on chair approval
            </p>
          </CardV2>
        ) : null}
        {composeError ? (
          <CardV2 padding="md" className="border-l-4 border-l-warning-700">
            <p className="m-0 text-[13px] text-ink">
              Loaded a blank form ({composeError}). You can still write and send.
            </p>
          </CardV2>
        ) : null}
        {lockedPending && compose.existingReviewId ? (
          <CardV2
            padding="md"
            className="flex flex-col gap-3 border-l-4 border-l-progress-700"
          >
            <p className="m-0 text-[14px] font-semibold text-ink">
              {cycleLabel} is with the chair — you can still revise below.
            </p>
            <ShareProgressUpdateControls
              personId={person.id}
              reviewId={compose.existingReviewId}
              monthKey={monthKey(compose.cycleMonth)}
              canNotifyChair={Boolean(workspace.relationships.chairName)}
              menteeFirstName={menteeFirst}
            />
          </CardV2>
        ) : null}

        <ProgressUpdateForm
          mentorshipId={compose.mentorshipId}
          menteeId={person.id}
          menteeName={person.name}
          cycleLabel={periodLabel}
          requiresChairApproval={compose.requiresChair}
          isUpdate={lockedApproved || lockedPending || isSentCopy}
          rubric={compose.rubric}
          bandReference={compose.bandReference}
          employee={employeeProfileFromWorkspace(workspace)}
          initialOverallRating={compose.draft.overallRating}
          initialOverallComments={compose.draft.overallComments}
          initialStrengths={compose.draft.strengths}
          initialAreas={compose.draft.areas}
          initialPlan={compose.draft.plan}
          initialGoals={compose.draft.goals}
          reviewId={compose.existingReviewId}
          reviewTeamAssign={reviewTeamAssign}
          reviewSent={isSentCopy}
        />

        {released.length > 0 ? (
          <details className="w-full rounded-[12px] border border-line-soft">
            <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-ink-muted marker:content-none [&::-webkit-details-marker]:hidden">
              Past reviews ({released.length})
            </summary>
            <ul className="m-0 flex list-none flex-col gap-2 border-t border-line-soft px-4 py-3 p-0">
              {released.map((review) => (
                <li
                  key={review.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                >
                  <a
                    href={`${progressBase}${progressBase.includes("?") ? "&" : "?"}reviewId=${encodeURIComponent(review.id)}`}
                    className="font-medium text-ink no-underline hover:text-brand-700"
                  >
                    {readReviewDocumentTitle(review.nextMonthGoalDraftsJson) ||
                      formatMonth(review.cycleMonth)}
                  </a>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={RATING_TONE[review.overallRating] ?? "neutral"}
                    >
                      {RATING_LABELS[review.overallRating] ?? review.overallRating}
                    </StatusBadge>
                    <a
                      href={`/mentorship/people/${person.id}/monthly-update/print?reviewId=${encodeURIComponent(review.id)}&month=${encodeURIComponent(monthKey(review.cycleMonth))}`}
                      className="text-[12px] font-semibold text-brand-700 no-underline hover:underline"
                    >
                      PDF
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    );
  }

  // Mentee (or mentor without compose): past released reviews only.
  const activeReleased =
    (selectedCopy && selectedCopy.releasedToMenteeAt
      ? released.find((r) => r.id === selectedCopy.id)
      : null) ??
    released[0] ??
    null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[22px] font-bold tracking-[-0.03em] text-ink">
            Performance Review
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            {isSelf
              ? "Reviews your mentor sends land here. Open one to read it, or download a PDF."
              : !activeMentorshipId && allCopies.length > 0
                ? "Select a copy below to open or print it. Assign a mentor to write a new review."
                : !activeMentorshipId
                  ? "Assign a mentor before writing a review."
                  : "Open a copy above (or create a new review) to edit it here."}
          </p>
        </div>
        {activeReleased || selectedCopy ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={`/mentorship/people/${person.id}/monthly-update/print?reviewId=${encodeURIComponent((selectedCopy ?? activeReleased)!.id)}&month=${encodeURIComponent(monthKey((selectedCopy ?? activeReleased)!.cycleMonth))}`}
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-brand-600 px-4 text-[13px] font-semibold text-white no-underline hover:brightness-95"
            >
              View & download PDF
            </a>
          </div>
        ) : null}
      </header>

      {copyOptions.length > 0 ? (
        <ReviewCopySwitcher
          key={selectedCopy?.id ?? "none"}
          copies={copyOptions}
          activeId={selectedCopy?.id ?? activeReleased?.id ?? null}
        />
      ) : null}

      {canCompose && !activeMentorshipId ? (
        <CardV2 padding="md">
          <p className="m-0 text-[14px] font-semibold text-ink">No active mentorship</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            {allCopies.length > 0
              ? "You can still open and print existing copies above. Assign a mentor to write a new one."
              : "Assign a mentor first, then come back to write the performance review."}
          </p>
        </CardV2>
      ) : null}

      {isSelf && released.length === 0 ? (
        <EmptyStateV2
          title="Nothing here yet"
          body="When your mentor sends a performance review, it will appear here."
        />
      ) : null}

      {isSelf && activeReleased ? (
        <ReleasedReviewReader
          review={activeReleased}
          personId={person.id}
          isActive
        />
      ) : null}

      {isSelf && released.length > 1 ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[15px] font-bold text-ink">All reviews</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {released.map((review) => {
              const isActive = activeReleased?.id === review.id;
              const title =
                readReviewDocumentTitle(review.nextMonthGoalDraftsJson) ||
                formatMonth(review.cycleMonth);
              return (
                <li key={review.id}>
                  <a
                    href={`${progressBase}${progressBase.includes("?") ? "&" : "?"}reviewId=${encodeURIComponent(review.id)}`}
                    className={[
                      "flex flex-wrap items-center justify-between gap-2 rounded-[12px] border px-4 py-3 no-underline",
                      isActive
                        ? "border-brand-300 bg-brand-50/40"
                        : "border-line-soft bg-white hover:border-brand-200",
                    ].join(" ")}
                  >
                    <span>
                      <span className="block text-[14px] font-semibold text-ink">{title}</span>
                      <span className="mt-0.5 block text-[12px] text-ink-muted">
                        From {review.mentor.name ?? "your mentor"}
                      </span>
                    </span>
                    <StatusBadge tone={RATING_TONE[review.overallRating] ?? "neutral"}>
                      {RATING_LABELS[review.overallRating] ?? review.overallRating}
                    </StatusBadge>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!isSelf && released.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[15px] font-bold text-ink">Past reviews</h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {released.map((review) => (
              <li key={review.id}>
                <ReleasedReviewReader
                  review={review}
                  personId={person.id}
                  isActive={selectedCopy?.id === review.id}
                  canShare
                  canNotifyMentee={canCompose}
                  canNotifyChair={
                    canCompose && Boolean(workspace.relationships.chairName)
                  }
                  menteeFirstName={menteeFirst}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReleasedReviewReader({
  review,
  personId,
  isActive = false,
  canShare = false,
  canNotifyMentee = false,
  canNotifyChair = false,
  menteeFirstName = "them",
}: {
  review: {
    id: string;
    cycleMonth: Date;
    overallRating: GoalRatingColor;
    overallComments: string;
    planOfAction: string;
    nextMonthGoalDraftsJson: unknown;
    mentor: { name: string | null };
  };
  personId: string;
  isActive?: boolean;
  canShare?: boolean;
  canNotifyMentee?: boolean;
  canNotifyChair?: boolean;
  menteeFirstName?: string;
}) {
  const narrative = unpackProgressNarrative(review.overallComments);
  const title =
    readReviewDocumentTitle(review.nextMonthGoalDraftsJson) ||
    formatMonth(review.cycleMonth);
  const pdfHref = `/mentorship/people/${personId}/monthly-update/print?reviewId=${encodeURIComponent(review.id)}&month=${encodeURIComponent(monthKey(review.cycleMonth))}`;

  return (
    <CardV2
      padding="md"
      id={isActive ? "active-review-copy" : undefined}
      className={[
        "flex flex-col gap-4",
        isActive ? "ring-2 ring-brand-300" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[16px] font-bold text-ink">{title}</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            From {review.mentor.name ?? "your mentor"} · {formatMonth(review.cycleMonth)}
          </p>
        </div>
        <StatusBadge tone={RATING_TONE[review.overallRating] ?? "neutral"}>
          {RATING_LABELS[review.overallRating] ?? review.overallRating}
        </StatusBadge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={pdfHref}
          className="inline-flex min-h-8 items-center justify-center rounded-full bg-brand-600 px-3.5 text-[12.5px] font-semibold text-white no-underline hover:brightness-95"
        >
          View & download PDF
        </a>
        {canShare ? (
          <ShareProgressUpdateControls
            personId={personId}
            reviewId={review.id}
            monthKey={monthKey(review.cycleMonth)}
            canNotifyMentee={canNotifyMentee}
            canNotifyChair={canNotifyChair}
            menteeFirstName={menteeFirstName}
            compact
            hideDownload
          />
        ) : null}
      </div>

      {narrative.overallComments ? (
        <section>
          <h4 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Overall comments
          </h4>
          <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {narrative.overallComments}
          </p>
        </section>
      ) : null}

      {narrative.strengths ? (
        <section>
          <h4 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Strengths
          </h4>
          <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {narrative.strengths}
          </p>
        </section>
      ) : null}

      {narrative.areasForDevelopment ? (
        <section>
          <h4 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Areas for development
          </h4>
          <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {narrative.areasForDevelopment}
          </p>
        </section>
      ) : null}

      {review.planOfAction?.trim() ? (
        <section>
          <h4 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Plan of action
          </h4>
          <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {review.planOfAction.trim()}
          </p>
        </section>
      ) : null}
    </CardV2>
  );
}

function employeeProfileFromWorkspace(
  workspace: MentorshipWorkspace,
): ProgressEmployeeProfile {
  const { person, overview } = workspace;
  const mentorDisplay = overview.mentorName
    ? overview.mentorTitle
      ? `${overview.mentorName} (${overview.mentorTitle})`
      : overview.mentorName
    : person.mentorshipExempt
      ? "Board member"
      : null;
  const chairDisplay = overview.chairName
    ? overview.chairTitle
      ? `${overview.chairName} (${overview.chairTitle})`
      : overview.chairName
    : null;
  return {
    name: person.name,
    role: person.title ?? person.roleLabel,
    department: person.departmentName,
    gradeLabel: person.gradeLabel,
    hometown: person.hometown,
    location: person.location,
    hireDateLabel: person.hireDateLabel,
    mentorDisplay,
    chairDisplay,
  };
}

async function loadComposeState(args: {
  mentorshipId: string;
  personId: string;
  cycleMonth: Date;
  reviewId?: string | null;
}): Promise<ComposeState> {
  const { mentorshipId, personId, cycleMonth, reviewId } = args;
  const [mentorship, mentee] = await Promise.all([
    prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: {
        id: true,
        governanceMode: true,
        programGroup: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: personId },
      select: { primaryRole: true, title: true, canonicalTitle: true },
    }),
  ]);
  if (!mentorship) {
    throw new Error("Mentorship not found.");
  }

  const rubric = resolveProgressRubricContext({
    primaryRole: mentee?.primaryRole ?? null,
    title: mentee?.title ?? mentee?.canonicalTitle ?? null,
  });
  const bandReference = bandRubricRows({
    trackId: rubric.trackId,
    roleId: rubric.roleId,
  });

  const monthEnd = new Date(
    Date.UTC(cycleMonth.getUTCFullYear(), cycleMonth.getUTCMonth() + 1, 1)
  );

  const reviewSelect = {
    id: true,
    status: true,
    mentorshipId: true,
    releasedToMenteeAt: true,
    overallRating: true,
    overallComments: true,
    planOfAction: true,
    cycleNumber: true,
    cycleMonth: true,
    nextMonthGoalDraftsJson: true,
    goalRatings: {
      select: {
        rating: true,
        comments: true,
        grDocumentGoalId: true,
        goalId: true,
      },
    },
    followUpActionItems: {
      select: { title: true, grDocumentGoalId: true },
    },
  } as const;

  // Load by review id + mentee (not only the current ACTIVE pairing) so sent
  // copies from a prior mentorship still open for edit / PDF.
  const existingById = reviewId
    ? await prisma.mentorGoalReview.findFirst({
        where: { id: reviewId, menteeId: personId },
        select: reviewSelect,
      })
    : null;

  const existingForMonth =
    existingById ??
    (await prisma.mentorGoalReview.findFirst({
      where: {
        menteeId: personId,
        mentorshipId: mentorship.id,
        cycleMonth: { gte: cycleMonth, lt: monthEnd },
      },
      orderBy: [{ releasedToMenteeAt: "desc" }, { createdAt: "desc" }],
      select: reviewSelect,
    }));

  const reflection = existingForMonth
    ? null
    : await prisma.monthlySelfReflection.findFirst({
        where: {
          mentorshipId: mentorship.id,
          cycleMonth: { gte: cycleMonth, lt: monthEnd },
        },
        orderBy: { cycleNumber: "desc" },
        select: {
          id: true,
          cycleNumber: true,
          goalReview: {
            select: reviewSelect,
          },
        },
      });

  const review = existingForMonth ?? reflection?.goalReview ?? null;
  const cycleNumber = existingForMonth?.cycleNumber ?? reflection?.cycleNumber;
  const resolvedCycleMonth = review?.cycleMonth ?? cycleMonth;
  const composeMentorshipId = review?.mentorshipId ?? mentorship.id;

  const pathwayMentorshipId = composeMentorshipId;
  const viewer = await getSessionUser();
  const pathwayGoals = viewer
    ? await ensurePathwayCompetencyGoals({
        menteeId: personId,
        mentorshipId: pathwayMentorshipId,
        actorId: viewer.id,
      }).catch(() => [])
    : [];

  const liveGoals = await getGoalsForMentee(personId, cycleNumber).catch(() => []);
  const competencyTitles = new Set(
    pathwayGoals.map((g) => g.title.trim().toLowerCase()),
  );
  const matchedLive = liveGoals.filter((g) =>
    competencyTitles.has(g.title.trim().toLowerCase()),
  );
  const goals = pathwayGoals.length > 0
    ? pathwayGoals
    : matchedLive.length > 0
      ? matchedLive
      : liveGoals;

  const narrative = unpackProgressNarrative(review?.overallComments);
  const ratingByGoal = new Map(
    (review?.goalRatings ?? []).map((r) => [r.grDocumentGoalId ?? r.goalId ?? "", r])
  );
  const actionsByGoal = new Map<string, string[]>();
  for (const a of review?.followUpActionItems ?? []) {
    const key = a.grDocumentGoalId ?? "__all__";
    const list = actionsByGoal.get(key) ?? [];
    list.push(a.title);
    actionsByGoal.set(key, list);
  }

  const goalDrafts: ProgressGoalDraft[] = goals.map((g) => {
    const existing = ratingByGoal.get(g.id);
    const parsed = parseCollaborateWith(existing?.comments ?? "");
    const actionItems = [
      ...(actionsByGoal.get(g.id) ?? []),
      ...(g.grDocumentGoalId ? [] : actionsByGoal.get("__all__") ?? []),
    ].join("\n");
    const dual = dualBandBulletsForProgressGoal({
      title: g.title,
      description: g.description,
      trackId: rubric.trackId,
      roleId: rubric.roleId,
    });
    return {
      goalId: g.id,
      source: g.grDocumentGoalId ? "gr" : "legacy",
      title: g.title,
      collaborateWith: parsed.collaborateWith ?? "",
      objective: parsed.objective || g.description?.trim() || "",
      actionItems,
      rating:
        existing?.rating ??
        review?.overallRating ??
        ("ACHIEVED" as GoalRatingColor),
      expectationBullets: dual.currentBullets,
      currentExpectationBullets: dual.currentBullets,
      nextExpectationBullets: dual.nextBullets,
      currentExpectationLabel: dual.currentLabel,
      nextExpectationLabel: dual.nextLabel,
      oneLiner: dual.oneLiner,
    };
  });

  // Chair / governance rules come from the ACTIVE pairing when present;
  // fall back to the review's own mentorship if we're editing a prior copy.
  let requiresChair = mentorshipRequiresChairApproval({
    governanceMode: mentorship.governanceMode,
    programGroup: mentorship.programGroup,
  });
  if (composeMentorshipId !== mentorship.id) {
    const reviewMentorship = await prisma.mentorship.findUnique({
      where: { id: composeMentorshipId },
      select: { governanceMode: true, programGroup: true },
    });
    if (reviewMentorship) {
      requiresChair = mentorshipRequiresChairApproval({
        governanceMode: reviewMentorship.governanceMode,
        programGroup: reviewMentorship.programGroup,
      });
    }
  }

  return {
    mentorshipId: composeMentorshipId,
    requiresChair,
    existingStatus: review?.status ?? null,
    existingReviewId: review?.id ?? null,
    releasedToMenteeAt: review?.releasedToMenteeAt ?? null,
    cycleMonth: resolvedCycleMonth,
    documentTitle: readReviewDocumentTitle(review?.nextMonthGoalDraftsJson),
    rubric,
    bandReference,
    draft: {
      overallRating: review?.overallRating ?? null,
      overallComments: narrative.overallComments ?? "",
      strengths: narrative.strengths ?? "",
      areas: narrative.areasForDevelopment ?? "",
      plan: review?.planOfAction ?? "",
      goals: goalDrafts,
    },
  };
}
