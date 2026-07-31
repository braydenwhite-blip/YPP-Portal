import type { GoalRatingColor } from "@prisma/client";

import { EmptyStateV2, StatusBadge } from "@/components/ui-v2";
import GRDocumentView from "@/components/gr/gr-document-view";
import { LearnMore } from "@/components/mentorship/learn-more";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import {
  getWorkspaceGRDocument,
} from "@/lib/gr-actions";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

import { AssignGoalsForm } from "./assign-goals-form";
import { ProposeChangeForm } from "./propose-change-form";
import { ActivateGRButton } from "./activate-gr-button";

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  GLOBAL_LEADERSHIP: "Global Leadership",
};

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

const TIME_PHASE_LABELS: Record<string, string> = {
  MONTHLY: "This cycle",
  FIRST_MONTH: "First month",
  FIRST_QUARTER: "First quarter",
  LONG_TERM: "Long-term",
  FULL_YEAR: "Long-term",
};

/**
 * Mentorship G&R tab.
 * - On your own page: view goals & resources (never the setup form).
 * - On someone else's page: mentors/admins can set up and edit.
 */
export async function GoalsSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const personId = workspace.person.id;
  const isSelf = workspace.isSelf;
  // Never treat someone as editor of their own G&R — even admins who are also mentees.
  const canEdit =
    !isSelf &&
    (workspace.isMentor ||
      workspace.isAdmin ||
      workspace.canManageSetup ||
      workspace.isLeadership);

  const doc = await getWorkspaceGRDocument(personId);

  if (!doc) {
    if (!canEdit || !workspace.activeMentorshipId) {
      return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          <div>
            <h2 className="m-0 text-[18px] font-semibold tracking-[-0.3px] text-ink">
              Goals &amp; Responsibilities
            </h2>
            <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
              {isSelf
                ? "Your goals and resources will show up here once your mentor sets them up."
                : "Set up Goals & Responsibilities for this person here."}
            </p>
          </div>
          {isSelf ? (
            <EmptyStateV2
              title="Nothing here yet"
              body="When your mentor assigns your G&R, you’ll see your goals and shared resources on this page."
            />
          ) : (
            <EmptyStateV2
              title="No Goals & Responsibilities yet"
              body="Set them up below once you’re ready."
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="m-0 text-[18px] font-semibold tracking-[-0.3px] text-ink">
            Goals &amp; Responsibilities
          </h2>
          <p className="m-0 mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-muted">
            Add the goals for {workspace.person.name}. They&apos;ll see them here once
            you save.
          </p>
        </div>
        <AssignGoalsForm
          personId={personId}
          mentorshipId={workspace.activeMentorshipId}
        />
      </div>
    );
  }

  // Mentees wait while draft/pending; mentors can still open and activate.
  if (isSelf && (doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL")) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="m-0 text-[18px] font-semibold text-ink">
            Goals &amp; Responsibilities
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">{doc.template.title}</p>
        </div>
        <EmptyStateV2
          title="Being prepared"
          body="Your mentor is finishing your Goals & Responsibilities. You'll see them here when they're ready."
        />
      </div>
    );
  }

  const ratingMap: Record<string, string> = {};
  if (doc.latestReview) {
    for (const gr of doc.latestReview.goalRatings) {
      if (gr.grDocumentGoalId) ratingMap[gr.grDocumentGoalId] = gr.rating;
    }
  }

  const serialized = {
    id: doc.id,
    templateTitle: doc.template.title,
    roleType: doc.template.roleType,
    roleMission: doc.roleMission,
    status: doc.status,
    roleStartDate: doc.roleStartDate.toISOString(),
    mentorName: doc.mentorship.mentor.name ?? "Mentor",
    mentorEmail: doc.mentorship.mentor.email ?? "",
    mentorInfo: doc.mentorInfo as Record<string, string> | null,
    officerInfo: doc.officerInfo as Record<string, string> | null,
    officer: doc.officer ?? null,
    mentors: doc.mentors ?? [],
    goalsByLifecycle: doc.goalsByLifecycle,
    currentPriorities: doc.currentPriorities
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      )
      .map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        priority: g.priority,
        progressState: g.progressState,
        dueDate: g.dueDate?.toISOString() ?? null,
        isOverdue: g.isOverdue,
        isDueSoon: g.isDueSoon,
        rating: (ratingMap[g.id] ?? null) as GoalRatingColor | null,
      })),
    goals: doc.goals.map((g) => {
      const def = g.templateGoal?.kpiDefinitions?.[0] ?? null;
      return {
      id: g.id,
      title: g.title,
      description: g.description,
      timePhase: g.timePhase,
      isCustom: g.isCustom,
      lifecycleStatus: g.lifecycleStatus,
      progressState: g.progressState,
      priority: g.priority,
      dueDate: g.dueDate?.toISOString() ?? null,
      completedAt: g.completedAt?.toISOString() ?? null,
      rating: (ratingMap[g.id] ?? null) as GoalRatingColor | null,
      ratingComments:
        doc.latestReview?.goalRatings.find((gr) => gr.grDocumentGoalId === g.id)
          ?.comments ?? null,
      kpiTarget: def
        ? {
            definitionId: def.id,
            label: def.label,
            targetValue: def.targetValue,
            unit: def.unit,
          }
        : null,
      kpiValues: g.kpiValues.map((v) => ({
        value: v.value,
        measuredAt: v.measuredAt.toISOString(),
        notes: v.notes,
      })),
    };
    }),
    successCriteria: doc.successCriteria.map((sc) => ({
      timePhase: sc.timePhase,
      criteria: sc.criteria,
    })),
    resources: doc.resources.map((r) => ({
      title: r.resource.title,
      url: r.resource.url,
      description: r.resource.description,
    })),
    plansOfAction: doc.plansOfAction.map((p) => ({
      cycleNumber: p.cycleNumber,
      content: p.content,
      updatedAt: p.updatedAt.toISOString(),
    })),
    latestReview: doc.latestReview
      ? {
          id: doc.latestReview.id,
          cycleMonth: doc.latestReview.cycleMonth.toISOString(),
          overallRating: doc.latestReview.overallRating,
          overallComments: doc.latestReview.overallComments,
          planOfAction: doc.latestReview.planOfAction,
          isQuarterly: doc.latestReview.isQuarterly,
          projectedFuturePath: doc.latestReview.projectedFuturePath,
          promotionReadiness: doc.latestReview.promotionReadiness,
          releasedToMenteeAt:
            doc.latestReview.releasedToMenteeAt?.toISOString() ?? null,
          goalRatings: doc.latestReview.goalRatings.map((gr) => ({
            grDocumentGoalId: gr.grDocumentGoalId,
            rating: gr.rating as GoalRatingColor,
            comments: gr.comments ?? null,
          })),
        }
      : null,
    nextMonthGoals: doc.nextMonthGoals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      priority: g.priority,
      dueDate: g.dueDate?.toISOString() ?? null,
    })),
    pastReviews: doc.pastReviews.map((r) => ({
      id: r.id,
      cycleMonth: r.cycleMonth.toISOString(),
      overallRating: r.overallRating,
      overallComments: r.overallComments,
      planOfAction: r.planOfAction,
      isQuarterly: r.isQuarterly,
      releasedToMenteeAt: r.releasedToMenteeAt?.toISOString() ?? null,
      goalRatings: r.goalRatings.map((gr) => ({
        grDocumentGoalId: gr.grDocumentGoalId,
        rating: gr.rating,
        comments: gr.comments,
      })),
      goalSnapshots: r.goalSnapshots.map((s) => ({
        id: s.id,
        grDocumentGoalId: s.grDocumentGoalId,
        title: s.title,
        description: s.description,
        timePhase: s.timePhase,
        priority: s.priority,
        lifecycleStatusAtSnapshot: s.lifecycleStatusAtSnapshot,
        dueDateAtSnapshot: s.dueDateAtSnapshot?.toISOString() ?? null,
      })),
    })),
    roleLabel: ROLE_LABELS[doc.template.roleType] ?? doc.template.roleType,
    ratingHistoryByGoal: doc.ratingHistoryByGoal,
  };

  const activeGoals = doc.goals.filter((g) => g.lifecycleStatus === "ACTIVE");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[18px] font-semibold tracking-[-0.3px] text-ink">
            Goals &amp; Responsibilities
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            {isSelf
              ? "Your goals and resources — shared with your mentor."
              : `${doc.template.title} — edit here; they see the same page.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={
              doc.status === "ACTIVE"
                ? "success"
                : doc.status === "PENDING_APPROVAL"
                  ? "warning"
                  : "neutral"
            }
          >
            {doc.status === "ACTIVE"
              ? "Active"
              : doc.status === "PENDING_APPROVAL"
                ? "Pending"
                : "Draft"}
          </StatusBadge>
          {canEdit && doc.status === "DRAFT" ? (
            <ActivateGRButton documentId={doc.id} />
          ) : null}
        </div>
      </div>

      <GRDocumentView document={serialized} isOwner={isSelf} />

      {canEdit ? (
        <details className="rounded-[12px] border border-line-soft bg-surface p-4">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
            Propose a change
          </summary>
          <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
            Suggest a new goal, an edit, or a removal. An admin reviews every proposal
            before the document changes.
          </p>
          <ProposeChangeForm
            documentId={doc.id}
            goals={activeGoals.map((g) => ({
              id: g.id,
              title: g.title,
              timePhase: TIME_PHASE_LABELS[g.timePhase] ?? g.timePhase,
            }))}
            sourceReviewId={doc.latestReview?.id ?? null}
          />
        </details>
      ) : null}

      <LearnMore summary="What do the goal colors mean?">
        <RatingLegend audience={isSelf ? "mentee" : "mentor"} />
      </LearnMore>
    </div>
  );
}

/** @deprecated Use GoalsSection — kept as alias for older imports. */
export const MenteeGoalsSection = GoalsSection;
