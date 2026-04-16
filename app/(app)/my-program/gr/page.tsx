import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import GRDocumentView from "@/components/gr/gr-document-view";
import Link from "next/link";
import type { GoalRatingColor } from "@prisma/client";

export const metadata = { title: "My G&R — Goals & Resources" };

export default async function MyGRPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const doc = await getMyGRDocument();

  if (!doc) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship Program</p>
            <h1 className="page-title">My Goals & Resources</h1>
          </div>
        </div>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Your G&R document hasn&apos;t been assigned yet.
          </p>
          <p style={{ color: "var(--muted)" }}>
            Your program administrator will set up your Goals &amp; Resources document once your mentorship pairing is established.
          </p>
          <Link href="/my-program" className="button primary" style={{ marginTop: "1.5rem" }}>
            Back to My Program
          </Link>
        </div>
      </div>
    );
  }

  // If the document exists but isn't active yet, show a status note
  if (doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL") {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship Program</p>
            <h1 className="page-title">My Goals & Resources</h1>
          </div>
        </div>
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
            {doc.status === "PENDING_APPROVAL" ? "Pending Approval" : "Draft"}
          </span>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Your G&R document is being prepared.
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Your administrator is finalizing your goals. You&apos;ll be notified once it&apos;s active.
          </p>
          <Link href="/my-program" className="button" style={{ marginTop: "1.5rem" }}>
            Back to My Program
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

  const PRIORITY_ORDER: Record<string, number> = {
    CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3,
  };

  // Build a rating map from the latest review (grDocumentGoalId → rating)
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
      ratingComments: doc.latestReview?.goalRatings.find((gr) => gr.grDocumentGoalId === g.id)?.comments ?? null,
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
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">My Goals &amp; Resources</h1>
          <p className="page-subtitle">{doc.template.title}</p>
        </div>
      </div>

      <GRDocumentView document={serialized} isOwner={true} />
    </div>
  );
}
