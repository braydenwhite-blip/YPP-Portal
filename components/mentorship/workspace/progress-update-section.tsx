import Link from "next/link";

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
import {
  bandRubricRows,
  bulletsForProgressGoal,
  resolveProgressRubricContext,
  type ProgressRubricContext,
} from "@/lib/mentorship/progress-rubric";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { prisma } from "@/lib/prisma";
import type { GoalRatingColor } from "@prisma/client";

import {
  ProgressUpdateForm,
  type ProgressGoalDraft,
} from "./progress-update-form";
import { ProgressReviewDossier } from "./progress-review-dossier";
import { ShareProgressUpdateControls } from "./share-progress-update";
import { InstructorReviewFeedbackContext } from "./instructor-review-feedback-context";

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

type ComposeState = {
  mentorshipId: string;
  requiresChair: boolean;
  existingStatus: string | null;
  existingReviewId: string | null;
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
}: {
  workspace: MentorshipWorkspace;
  justSent?: boolean;
  pendingChair?: boolean;
}) {
  const { isSelf, person, capabilities, lifecycle, activeMentorshipId } = workspace;
  const canCompose =
    !isSelf &&
    (workspace.isMentor ||
      capabilities.canDraftReview ||
      workspace.isAdmin);

  const released = await prisma.mentorGoalReview.findMany({
    where: { menteeId: person.id, releasedToMenteeAt: { not: null } },
    orderBy: { releasedToMenteeAt: "desc" },
    take: 12,
    select: {
      id: true,
      cycleMonth: true,
      overallRating: true,
      overallComments: true,
      planOfAction: true,
      releasedToMenteeAt: true,
      mentor: { select: { name: true } },
    },
  });

  if (!lifecycle.hasActiveMentorship && released.length === 0) {
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

  const { cycleMonth, cycleLabel } = getCurrentCycleMonth();
  const menteeFirst =
    person.name.trim().split(/\s+/)[0] || (isSelf ? "Your" : "Their");

  let compose: ComposeState | null = null;
  let composeError: string | null = null;

  if (canCompose && activeMentorshipId) {
    try {
      compose = await loadComposeState({
        mentorshipId: activeMentorshipId,
        personId: person.id,
        cycleMonth,
      });
    } catch (err) {
      composeError =
        err instanceof Error ? err.message : "Could not load the write form.";
      const fallbackRubric = resolveProgressRubricContext({ primaryRole: null });
      // Still offer a blank form so the mentor can write.
      compose = {
        mentorshipId: activeMentorshipId,
        requiresChair: false,
        existingStatus: null,
        existingReviewId: null,
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
  // Always offer the write form — mentors can send an updated version after
  // new mentee feedback answers land for the same month.
  const showWriteForm = canCompose && compose != null;

  return (
    <div className="flex flex-col gap-5">
      <header className="max-w-[56ch]">
        <h2 className="m-0 text-[18px] font-bold tracking-[-0.3px] text-ink">
          Progress update
        </h2>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-muted">
          {isSelf
            ? "Monthly progress updates from your mentor land here — written against your Goals & Rubric."
            : showWriteForm
              ? lockedApproved || lockedPending
                ? `Update ${menteeFirst}'s ${cycleLabel} G&R progress check — rate competencies and write evidence against the bullets.`
                : `Write ${menteeFirst}'s ${cycleLabel} progress as a G&R check — ratings plus written evidence against their band.`
              : !activeMentorshipId
                ? "Assign a mentor before writing an update."
                : `Open Feedback first if you still need ${menteeFirst}'s answers.`}
        </p>
      </header>

      {justSent ? (
        <CardV2 padding="md" className="border-l-4 border-l-complete-700">
          <p className="m-0 text-[14px] font-semibold text-ink">
            {lockedApproved ? "Updated version sent" : "Sent"}
          </p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            {menteeFirst} can open it under Past updates.
          </p>
        </CardV2>
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

      {canCompose && !activeMentorshipId ? (
        <CardV2 padding="md">
          <p className="m-0 text-[14px] font-semibold text-ink">No active mentorship</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Assign a mentor first, then come back to write the progress update.
          </p>
        </CardV2>
      ) : null}

      {lockedApproved && compose?.existingReviewId ? (
        <CardV2 padding="md" className="flex flex-col gap-3">
          <div>
            <p className="m-0 text-[14px] font-semibold text-ink">
              {cycleLabel} already has a sent update
            </p>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              Share the current PDF below, or edit the form and send an updated
              version after new feedback answers.
            </p>
          </div>
          <ShareProgressUpdateControls
            personId={person.id}
            reviewId={compose.existingReviewId}
            monthKey={monthKey(cycleMonth)}
            canNotifyMentee
            canNotifyChair={Boolean(workspace.relationships.chairName)}
            menteeFirstName={menteeFirst}
          />
        </CardV2>
      ) : null}

      {lockedPending && compose?.existingReviewId ? (
        <CardV2
          padding="md"
          className="flex flex-col gap-3 border-l-4 border-l-progress-700"
        >
          <div>
            <p className="m-0 text-[14px] font-semibold text-ink">
              {cycleLabel} is with the chair
            </p>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              You can still revise below and re-send to the chair.
            </p>
          </div>
          <ShareProgressUpdateControls
            personId={person.id}
            reviewId={compose.existingReviewId}
            monthKey={monthKey(cycleMonth)}
            canNotifyChair={Boolean(workspace.relationships.chairName)}
            menteeFirstName={menteeFirst}
          />
        </CardV2>
      ) : null}

      {canCompose ? (
        <CardV2 padding="md" className="border border-line bg-surface">
          <InstructorReviewFeedbackContext
            instructorId={person.id}
            density="calm"
          />
        </CardV2>
      ) : null}

      {showWriteForm && compose ? (
        <div id="write-progress-update" className="scroll-mt-6">
          <ProgressUpdateForm
            mentorshipId={compose.mentorshipId}
            menteeId={person.id}
            menteeName={person.name}
            cycleLabel={cycleLabel}
            requiresChairApproval={compose.requiresChair}
            isUpdate={lockedApproved || lockedPending}
            rubric={compose.rubric}
            bandReference={compose.bandReference}
            initialOverallRating={compose.draft.overallRating}
            initialOverallComments={compose.draft.overallComments}
            initialStrengths={compose.draft.strengths}
            initialAreas={compose.draft.areas}
            initialPlan={compose.draft.plan}
            initialGoals={compose.draft.goals}
          />
        </div>
      ) : null}

      {canCompose ? (
        <details className="rounded-[14px] border border-line-soft bg-surface" open>
          <summary className="cursor-pointer list-none px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-[14px] font-semibold text-ink">
              Quick look at {menteeFirst}&apos;s month
            </span>
            <span className="mt-0.5 block text-[12.5px] font-normal text-ink-muted">
              Their feedback answers, meetings, and open work — optional while you write.
            </span>
          </summary>
          <div className="border-t border-line-soft px-1 pb-1">
            <ProgressReviewDossier workspace={workspace} embedded />
          </div>
        </details>
      ) : null}

      {canCompose ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Need their answers first?{" "}
          <Link
            href={`/mentorship/people/${person.id}?section=reviews`}
            className="font-semibold text-brand-700 no-underline hover:underline"
          >
            Open Feedback →
          </Link>
        </p>
      ) : null}

      {!canCompose && isSelf && released.length === 0 ? (
        <EmptyStateV2
          title="Nothing here yet"
          body="When your mentor sends a monthly progress update, it will appear below."
        />
      ) : null}

      {released.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[15px] font-bold text-ink">Past updates</h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {released.map((review) => {
              const narrative = unpackProgressNarrative(review.overallComments);
              return (
                <li key={review.id}>
                  <CardV2 padding="md" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="m-0 text-[14.5px] font-bold text-ink">
                          {formatMonth(review.cycleMonth)}
                        </p>
                        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                          From {review.mentor.name ?? "your mentor"}
                          {review.releasedToMenteeAt
                            ? ` · ${review.releasedToMenteeAt.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge
                        tone={RATING_TONE[review.overallRating] ?? "neutral"}
                      >
                        {RATING_LABELS[review.overallRating] ?? review.overallRating}
                      </StatusBadge>
                    </div>
                    {narrative.overallComments ? (
                      <p className="m-0 line-clamp-3 text-[13.5px] leading-relaxed text-ink">
                        {narrative.overallComments}
                      </p>
                    ) : null}
                    <ShareProgressUpdateControls
                      personId={person.id}
                      reviewId={review.id}
                      monthKey={monthKey(review.cycleMonth)}
                      canNotifyMentee={canCompose}
                      canNotifyChair={
                        canCompose && Boolean(workspace.relationships.chairName)
                      }
                      menteeFirstName={menteeFirst}
                      compact
                    />
                  </CardV2>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

async function loadComposeState(args: {
  mentorshipId: string;
  personId: string;
  cycleMonth: Date;
}): Promise<ComposeState> {
  const { mentorshipId, personId, cycleMonth } = args;
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
      select: { primaryRole: true },
    }),
  ]);
  if (!mentorship) {
    throw new Error("Mentorship not found.");
  }

  const rubric = resolveProgressRubricContext({
    primaryRole: mentee?.primaryRole ?? null,
  });
  const bandReference = bandRubricRows({
    trackId: rubric.trackId,
    roleId: rubric.roleId,
  });

  const monthEnd = new Date(
    Date.UTC(cycleMonth.getUTCFullYear(), cycleMonth.getUTCMonth() + 1, 1)
  );

  const existingForMonth = await prisma.mentorGoalReview.findFirst({
    where: {
      mentorshipId: mentorship.id,
      cycleMonth: { gte: cycleMonth, lt: monthEnd },
    },
    orderBy: [{ releasedToMenteeAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      overallRating: true,
      overallComments: true,
      planOfAction: true,
      cycleNumber: true,
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
    },
  });

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
            select: {
              id: true,
              status: true,
              overallRating: true,
              overallComments: true,
              planOfAction: true,
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
            },
          },
        },
      });

  const review = existingForMonth ?? reflection?.goalReview ?? null;
  const cycleNumber = existingForMonth?.cycleNumber ?? reflection?.cycleNumber;

  const goals = await getGoalsForMentee(personId, cycleNumber).catch(() => []);
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
    return {
      goalId: g.id,
      source: g.grDocumentGoalId ? "gr" : "legacy",
      title: g.title,
      collaborateWith: parsed.collaborateWith ?? "",
      objective: parsed.objective,
      actionItems,
      rating:
        existing?.rating ??
        review?.overallRating ??
        ("ACHIEVED" as GoalRatingColor),
      expectationBullets: bulletsForProgressGoal({
        title: g.title,
        description: g.description,
        trackId: rubric.trackId,
        roleId: rubric.roleId,
      }),
    };
  });

  return {
    mentorshipId: mentorship.id,
    requiresChair: mentorshipRequiresChairApproval({
      governanceMode: mentorship.governanceMode,
      programGroup: mentorship.programGroup,
    }),
    existingStatus: review?.status ?? null,
    existingReviewId: review?.id ?? null,
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
