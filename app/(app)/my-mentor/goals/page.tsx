import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { getLeadershipContext } from "@/lib/leadership-context";
import GRDocumentView from "@/components/gr/gr-document-view";
import { RoleStrip } from "@/components/leadership-pathway/role-strip";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";
import Link from "next/link";
import type { GoalRatingColor } from "@prisma/client";

export const metadata = { title: "My Goals — My Mentorship" };

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
      <div>
        <div className="topbar">
          <div>
            <p className="badge">My Mentorship</p>
            <h1 className="page-title">My Goals &amp; Resources</h1>
          </div>
        </div>
        <MyMentorSubnav />
        <div style={{ display: "grid", gap: 16 }}>
          {leadership?.stageId && (
            <RoleStrip
              stageId={leadership.stageId}
              nextStageId={leadership.nextStageId}
              mentorName={leadership.primaryMentor?.name ?? null}
              mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
            />
          )}
          <div
            style={{
              padding: "28px 20px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, color: "var(--text)", margin: "0 0 4px", fontWeight: 600 }}>
              Your goals aren&apos;t set up yet.
            </p>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 auto", maxWidth: 420 }}>
              Once you&apos;re paired with a mentor, the two of you will set goals
              together here. There&apos;s nothing you need to do yet.
            </p>
            <Link href="/my-mentor" className="button" style={{ marginTop: 16 }}>
              Back to My Mentorship
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL") {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">My Mentorship</p>
            <h1 className="page-title">My Goals &amp; Resources</h1>
          </div>
        </div>
        <MyMentorSubnav />
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <span
            className="badge"
            style={{
              background: doc.status === "PENDING_APPROVAL" ? "#fef9c3" : "#f1f5f9",
              color: doc.status === "PENDING_APPROVAL" ? "#854d0e" : "#475569",
              marginBottom: "1rem",
              display: "inline-block",
            }}
          >
            {doc.status === "PENDING_APPROVAL" ? "Being finalized" : "In progress"}
          </span>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Your goals are being prepared.
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Your mentor is finalizing your goals. You&apos;ll be notified once they&apos;re ready.
          </p>
          <Link href="/my-mentor" className="button" style={{ marginTop: "1.5rem" }}>
            Back to My Mentorship
          </Link>
        </div>
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
    unseenMilestones: doc.unseenMilestones,
    reviewAck: doc.reviewAck,
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Mentorship</p>
          <h1 className="page-title">My Goals &amp; Resources</h1>
          <p className="page-subtitle">{doc.template.title}</p>
        </div>
      </div>

      <MyMentorSubnav />

      {leadership?.stageId && (
        <div style={{ marginBottom: 16 }}>
          <RoleStrip
            stageId={leadership.stageId}
            nextStageId={leadership.nextStageId}
            mentorName={leadership.primaryMentor?.name ?? null}
            mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
          />
        </div>
      )}

      <GRDocumentView document={serialized} isOwner={true} />

      <div style={{ marginTop: 20 }}>
        <RatingLegend audience="mentee" title="What your goal status colors mean" />
      </div>
    </div>
  );
}
