import type { GoalRatingColor, GRTimePhase } from "@prisma/client";

import {
  CardV2,
  EmptyStateV2,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { prisma } from "@/lib/prisma";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

import { AssignGoalsForm } from "./assign-goals-form";
import { ProposeChangeForm } from "./propose-change-form";

/**
 * The mentor/leadership view of a mentee's Goals & Responsibilities document —
 * the one canonical development model, seen from the other side of the
 * relationship. Read view + "propose a change" (admin-approved), replacing the
 * old standalone /mentorship/mentees/[id]/gr page and the Growth-OS-backed
 * "Plan" tab.
 */

const TIME_PHASE_LABELS: Record<GRTimePhase, string> = {
  MONTHLY: "This cycle",
  FIRST_MONTH: "First month (Short term)",
  FIRST_QUARTER: "First quarter",
  LONG_TERM: "Long-term",
  FULL_YEAR: "Long-term",
};

const PRIMARY_PHASES: GRTimePhase[] = ["MONTHLY", "FIRST_MONTH", "FIRST_QUARTER"];

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};
const PROGRESS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export async function MenteeGoalsSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const personId = workspace.person.id;

  const doc = await prisma.gRDocument.findFirst({
    where: { userId: personId, status: { in: ["DRAFT", "PENDING_APPROVAL", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { title: true } },
      goals: {
        where: { lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] } },
        orderBy: [
          { timePhase: "asc" },
          { priority: "desc" },
          { dueDate: "asc" },
          { sortOrder: "asc" },
        ],
      },
      resources: {
        include: { resource: { select: { title: true, url: true, description: true } } },
        orderBy: { sortOrder: "asc" },
      },
      plansOfAction: { orderBy: { cycleNumber: "desc" }, take: 1 },
    },
  });

  if (!doc) {
    const canAssign =
      (workspace.pov === "mentor" || workspace.isAdmin) &&
      !!workspace.activeMentorshipId;

    if (!canAssign) {
      return (
        <EmptyStateV2
          title="No goals yet"
          body={
            workspace.isSelf
              ? "Your mentor will add them here."
              : "The mentor can add them on this tab."
          }
        />
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="m-0 text-[18px] font-bold tracking-[-0.3px] text-ink">
            Set up goals
          </h2>
          <p className="m-0 mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-muted">
            Write a few goals for this mentee. Keep them concrete — you can add more later.
          </p>
        </div>
        <AssignGoalsForm
          personId={personId}
          mentorshipId={workspace.activeMentorshipId!}
        />
      </div>
    );
  }

  // Ratings context from the latest released review.
  const latestReview = await prisma.mentorGoalReview.findFirst({
    where: { mentorshipId: doc.mentorshipId, releasedToMenteeAt: { not: null } },
    orderBy: { cycleMonth: "desc" },
    select: {
      id: true,
      goalRatings: { select: { grDocumentGoalId: true, rating: true, comments: true } },
    },
  });
  const ratingByGoalId = new Map<string, { rating: GoalRatingColor; comments: string | null }>();
  for (const r of latestReview?.goalRatings ?? []) {
    if (r.grDocumentGoalId) {
      ratingByGoalId.set(r.grDocumentGoalId, { rating: r.rating, comments: r.comments });
    }
  }

  const activeGoals = doc.goals.filter((g) => g.lifecycleStatus === "ACTIVE");
  const nearTerm = activeGoals.filter((g) => PRIMARY_PHASES.includes(g.timePhase));
  const longTerm = activeGoals.filter((g) => !PRIMARY_PHASES.includes(g.timePhase));
  const completed = doc.goals.filter((g) => g.lifecycleStatus === "COMPLETED");
  const plan = doc.plansOfAction[0] ?? null;

  const preparing = doc.status !== "ACTIVE";

  const goalCard = (goal: (typeof doc.goals)[number]) => {
    const rated = ratingByGoalId.get(goal.id);
    const cfg = rated ? getGoalRatingCopy(rated.rating) : null;
    return (
      <CardV2 key={goal.id} padding="md" className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            className={cn(
              "m-0 text-[14px] font-semibold text-ink",
              goal.lifecycleStatus === "COMPLETED" && "text-ink-muted line-through"
            )}
          >
            {goal.title}
          </h3>
          <div className="flex items-center gap-2">
            <StatusBadge
              tone={
                goal.progressState === "DONE"
                  ? "success"
                  : goal.progressState === "BLOCKED"
                    ? "danger"
                    : goal.progressState === "IN_PROGRESS"
                      ? "info"
                      : "neutral"
              }
            >
              {PROGRESS_LABELS[goal.progressState] ?? goal.progressState}
            </StatusBadge>
            {rated && cfg ? (
              <StatusBadge tone={RATING_TONE[String(rated.rating)] ?? "info"} withDot>
                {cfg.label}
              </StatusBadge>
            ) : null}
            <span className="text-[11.5px] font-semibold text-ink-muted">
              {TIME_PHASE_LABELS[goal.timePhase]}
            </span>
          </div>
        </div>
        {goal.description ? (
          <p className="m-0 text-[13px] leading-relaxed text-ink-muted">{goal.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 text-[12px] text-ink-muted">
          {goal.dueDate ? <span>Due {goal.dueDate.toLocaleDateString()}</span> : null}
          {goal.completedAt ? (
            <span className="text-complete-700">
              Completed {goal.completedAt.toLocaleDateString()}
            </span>
          ) : null}
          {rated?.comments ? <span className="italic">“{rated.comments}”</span> : null}
        </div>
      </CardV2>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <CardV2 padding="lg" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-ink">
              Goals
            </h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">{doc.template.title}</p>
          </div>
          <StatusBadge tone={preparing ? "warning" : "success"}>
            {preparing ? "Being prepared" : workspace.goals.progressLabel}
          </StatusBadge>
        </div>
        {doc.roleMission ? (
          <p className="m-0 max-w-[70ch] text-[13.5px] leading-relaxed text-ink">
            {doc.roleMission}
          </p>
        ) : null}
      </CardV2>

      {nearTerm.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            In motion now
          </h3>
          {nearTerm.map(goalCard)}
        </section>
      ) : null}

      {longTerm.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted">
            Long-term goals ({longTerm.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">{longTerm.map(goalCard)}</div>
        </details>
      ) : null}

      {completed.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted">
            Completed ({completed.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">{completed.map(goalCard)}</div>
        </details>
      ) : null}

      {plan ? (
        <CardV2 padding="md" className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="m-0 text-[13px] font-bold text-ink">Plan</p>
            <span className="text-[12px] text-ink-muted">
              Cycle {plan.cycleNumber} · updated {plan.updatedAt.toLocaleDateString()}
            </span>
          </div>
          <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            {plan.content}
          </p>
        </CardV2>
      ) : null}

      {doc.resources.length > 0 ? (
        <CardV2 padding="md" className="flex flex-col gap-2">
          <p className="m-0 text-[13px] font-bold text-ink">Shared resources</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {doc.resources.map((r) => (
              <li key={r.id} className="text-[13px]">
                {r.resource.url ? (
                  <a
                    href={r.resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {r.resource.title}
                  </a>
                ) : (
                  <span className="font-semibold text-ink">{r.resource.title}</span>
                )}
                {r.resource.description ? (
                  <span className="text-ink-muted"> — {r.resource.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      <details className="rounded-[12px] border border-line-soft bg-surface p-4">
        <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
          Propose a change to these goals
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
          sourceReviewId={latestReview?.id ?? null}
        />
      </details>
    </div>
  );
}
