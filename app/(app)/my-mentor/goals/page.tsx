import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { getLeadershipContext } from "@/lib/leadership-context";
import GRDocumentView from "@/components/gr/gr-document-view";
import { RoleStrip } from "@/components/leadership-pathway/role-strip";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import { GoalsCalm, type CalmGoal } from "@/components/mentorship/calm";
import { getGrowthConnectLine } from "@/lib/growth-model";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";
import type { GoalRatingColor } from "@prisma/client";

export const metadata = { title: "Goals — My development" };

export default async function MyGoalsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const [doc, leadership] = await Promise.all([
    getMyGRDocument(),
    getLeadershipContext(session.user.id),
  ]);

  if (!doc) {
    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship · My development"
          title="Goals & Responsibilities"
        />
        <MyMentorSubnav />
        {leadership?.stageId && (
          <RoleStrip
            stageId={leadership.stageId}
            nextStageId={leadership.nextStageId}
            mentorName={leadership.primaryMentor?.name ?? null}
            mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
          />
        )}
        <CardV2 padding="lg" className="text-center">
          <p className="m-0 text-[15px] font-semibold text-ink">
            Your goals aren&apos;t set up yet.
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            Once you&apos;re paired with a mentor, the two of you will set goals
            together here. There&apos;s nothing you need to do yet.
          </p>
          <div className="mt-4">
            <ButtonLink href="/mentorship?view=me" variant="secondary" size="sm">
              Back to My development
            </ButtonLink>
          </div>
        </CardV2>
      </div>
    );
  }

  if (doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL") {
    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship · My development"
          title="Goals & Responsibilities"
        />
        <MyMentorSubnav />
        <CardV2 padding="lg" className="text-center">
          <StatusBadge tone={doc.status === "PENDING_APPROVAL" ? "warning" : "neutral"}>
            {doc.status === "PENDING_APPROVAL" ? "Being finalized" : "In progress"}
          </StatusBadge>
          <p className="mt-3 text-[15px] font-semibold text-ink">
            Your goals are being prepared.
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            Your mentor is finalizing your goals. You&apos;ll be notified once
            they&apos;re ready.
          </p>
          <div className="mt-4">
            <ButtonLink href="/mentorship?view=me" variant="secondary" size="sm">
              Back to My development
            </ButtonLink>
          </div>
        </CardV2>
      </div>
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    INSTRUCTOR: "Instructor",
    CHAPTER_PRESIDENT: "Chapter President",
    GLOBAL_LEADERSHIP: "Global Leadership",
  };

  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

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
    mentorName: doc.mentorship.mentor.name,
    mentorEmail: doc.mentorship.mentor.email,
    mentorInfo: doc.mentorInfo as Record<string, string> | null,
    officerInfo: doc.officerInfo as Record<string, string> | null,
    goalsByLifecycle: doc.goalsByLifecycle,
    currentPriorities: doc.currentPriorities
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
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
    goals: doc.goals.map((g) => ({
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
        doc.latestReview?.goalRatings.find((gr) => gr.grDocumentGoalId === g.id)?.comments ?? null,
      kpiValues: g.kpiValues.map((v) => ({
        value: v.value,
        measuredAt: v.measuredAt.toISOString(),
        notes: v.notes,
      })),
    })),
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
          releasedToMenteeAt: doc.latestReview.releasedToMenteeAt?.toISOString() ?? null,
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
    unseenMilestones: [],
    reviewAck: null,
  };

  // Calm lead (Phase 7): the few goals actually in motion, with their released
  // rubric color in supportive language and one "update progress" move. The
  // full G&R document is demoted behind a CalmCollapse in Calm mode and renders
  // inline in Executive.
  const calmGoals: CalmGoal[] = serialized.currentPriorities
    .filter((g) => g.progressState !== "DONE")
    .slice(0, 5)
    .map((g) => ({
      id: g.id,
      title: g.title,
      rating: g.rating,
      meta: g.dueDate
        ? `Due ${new Date(g.dueDate).toLocaleDateString()}`
        : g.progressState
          ? g.progressState.replace(/_/g, " ").toLowerCase()
          : null,
    }));

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · My development"
        title="Goals & Responsibilities"
        subtitle={doc.template.title}
      />

      <MyMentorSubnav />

      {leadership?.stageId && (
        <RoleStrip
          stageId={leadership.stageId}
          nextStageId={leadership.nextStageId}
          mentorName={leadership.primaryMentor?.name ?? null}
          mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
        />
      )}

      <p className="m-0 max-w-[64ch] text-[13px] leading-relaxed text-ink-muted">
        {getGrowthConnectLine("goals")}
      </p>

      <CalmOnly>
        <GoalsCalm goals={calmGoals} />
      </CalmOnly>

      <CalmCollapse label="Your full goals & resources" hint="every goal, KPIs, and history">
        <GRDocumentView document={serialized} isOwner={true} />
      </CalmCollapse>

      <LearnMore summary="What do these goal status colors mean?">
        <RatingLegend audience="mentee" />
      </LearnMore>
    </div>
  );
}
