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
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { prisma } from "@/lib/prisma";
import type { GoalRatingColor } from "@prisma/client";

import {
  ProgressUpdateForm,
  type ProgressGoalDraft,
} from "./progress-update-form";
import { ProgressReviewDossier } from "./progress-review-dossier";
import { ShareProgressUpdateControls } from "./share-progress-update";

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
  // Assigned mentor or admin — not "has MENTOR role", so instructors who mentor still compose.
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
  let compose: {
    mentorshipId: string;
    requiresChair: boolean;
    existingStatus: string | null;
    existingReviewId: string | null;
    draft: {
      overallRating: GoalRatingColor | null;
      overallComments: string;
      strengths: string;
      areas: string;
      plan: string;
      goals: ProgressGoalDraft[];
    };
  } | null = null;

  if (canCompose && activeMentorshipId) {
    const mentorship = await prisma.mentorship.findUnique({
      where: { id: activeMentorshipId },
      select: {
        id: true,
        governanceMode: true,
        programGroup: true,
      },
    });
    if (mentorship) {
      const reflection = await prisma.monthlySelfReflection.findFirst({
        where: { mentorshipId: mentorship.id, cycleMonth },
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

      const goals = await getGoalsForMentee(person.id, reflection?.cycleNumber);
      const narrative = unpackProgressNarrative(
        reflection?.goalReview?.overallComments
      );
      const ratingByGoal = new Map(
        (reflection?.goalReview?.goalRatings ?? []).map((r) => [
          r.grDocumentGoalId ?? r.goalId ?? "",
          r,
        ])
      );
      const actionsByGoal = new Map<string, string[]>();
      for (const a of reflection?.goalReview?.followUpActionItems ?? []) {
        const key = a.grDocumentGoalId ?? "__all__";
        const list = actionsByGoal.get(key) ?? [];
        list.push(a.title);
        actionsByGoal.set(key, list);
      }

      const goalDrafts: ProgressGoalDraft[] = goals.map((g) => {
        const existing = ratingByGoal.get(g.id);
        const parsed = parseCollaborateWith(
          existing?.comments ?? g.description ?? ""
        );
        const actionItems = [
          ...(actionsByGoal.get(g.id) ?? []),
          ...(g.grDocumentGoalId ? [] : actionsByGoal.get("__all__") ?? []),
        ].join("\n");
        return {
          goalId: g.id,
          source: g.grDocumentGoalId ? "gr" : "legacy",
          title: g.title,
          collaborateWith: parsed.collaborateWith ?? "",
          objective: parsed.objective || g.description || "",
          actionItems,
          rating:
            existing?.rating ??
            reflection?.goalReview?.overallRating ??
            ("ACHIEVED" as GoalRatingColor),
        };
      });

      compose = {
        mentorshipId: mentorship.id,
        requiresChair: mentorshipRequiresChairApproval({
          governanceMode: mentorship.governanceMode,
          programGroup: mentorship.programGroup,
        }),
        existingStatus: reflection?.goalReview?.status ?? null,
        existingReviewId: reflection?.goalReview?.id ?? null,
        draft: {
          overallRating: reflection?.goalReview?.overallRating ?? null,
          overallComments: narrative.overallComments ?? "",
          strengths: narrative.strengths ?? "",
          areas: narrative.areasForDevelopment ?? "",
          plan: reflection?.goalReview?.planOfAction ?? "",
          goals: goalDrafts,
        },
      };
    }
  }

  const menteeFirst =
    person.name.trim().split(/\s+/)[0] || (isSelf ? "Your" : "Their");

  return (
    <div className="flex flex-col gap-5">
      <header className="max-w-[56ch]">
        <h2 className="m-0 text-[18px] font-bold tracking-[-0.3px] text-ink">
          Progress update
        </h2>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-muted">
          {isSelf
            ? "Monthly progress updates from your mentor land here. Download the PDF or open the shared portal link anytime."
            : `Skim ${menteeFirst}'s month below, then write and send the update.`}
        </p>
      </header>

      {justSent ? (
        <CardV2 padding="md" className="border-l-4 border-l-complete-700">
          <p className="m-0 text-[14px] font-semibold text-ink">Sent</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            {menteeFirst} can open it under Past updates. Use Share to ping them
            again or copy the PDF link.
          </p>
        </CardV2>
      ) : null}

      {pendingChair ? (
        <CardV2 padding="md" className="border-l-4 border-l-progress-700">
          <p className="m-0 text-[14px] font-semibold text-ink">
            Waiting on chair approval
          </p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Once approved, it releases to {menteeFirst} automatically. You can
            still preview and share the PDF with the chair.
          </p>
        </CardV2>
      ) : null}

      {canCompose ? <ProgressReviewDossier workspace={workspace} /> : null}

      {canCompose && !compose && activeMentorshipId ? (
        <CardV2 padding="md" className="border-l-4 border-l-blocked-700">
          <p className="m-0 text-[14px] font-semibold text-ink">
            Couldn’t load this month’s form
          </p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Refresh the page and try again. If it keeps happening, open Mentorship
            setup for this person.
          </p>
        </CardV2>
      ) : null}

      {canCompose && !activeMentorshipId ? (
        <CardV2 padding="md">
          <p className="m-0 text-[14px] font-semibold text-ink">
            No active mentorship
          </p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Assign a mentor first, then come back to write the progress update.
          </p>
        </CardV2>
      ) : null}

      {canCompose && compose ? (
        compose.existingStatus === "APPROVED" && compose.existingReviewId ? (
          <CardV2 padding="md" className="flex flex-col gap-3">
            <div>
              <p className="m-0 text-[14px] font-semibold text-ink">
                {cycleLabel} already sent
              </p>
              <p className="m-0 mt-1 text-[13px] text-ink-muted">
                Download the PDF, copy links, or share again in the portal.
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
        ) : compose.existingStatus === "PENDING_CHAIR_APPROVAL" &&
          compose.existingReviewId ? (
          <CardV2
            padding="md"
            className="flex flex-col gap-3 border-l-4 border-l-progress-700"
          >
            <div>
              <p className="m-0 text-[14px] font-semibold text-ink">
                {cycleLabel} is with the chair
              </p>
              <p className="m-0 mt-1 text-[13px] text-ink-muted">
                Preview the PDF or share it with the chair while you wait.
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
        ) : (
          <ProgressUpdateForm
            mentorshipId={compose.mentorshipId}
            menteeId={person.id}
            menteeName={person.name}
            cycleLabel={cycleLabel}
            requiresChairApproval={compose.requiresChair}
            initialOverallRating={compose.draft.overallRating}
            initialOverallComments={compose.draft.overallComments}
            initialStrengths={compose.draft.strengths}
            initialAreas={compose.draft.areas}
            initialPlan={compose.draft.plan}
            initialGoals={compose.draft.goals}
          />
        )
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
