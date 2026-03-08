import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getReflectionForReview } from "@/lib/goal-review-actions";
import ReviewForm from "./review-form";
import Link from "next/link";

export const metadata = { title: "Write Review — Mentorship Program" };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_CHAIR_APPROVAL: "Pending Chair Approval",
  CHANGES_REQUESTED: "Changes Requested",
  APPROVED: "Approved & Released",
};

export default async function WriteReviewPage({ params }: { params: Promise<{ reflectionId: string }> }) {
  const { reflectionId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("MENTOR") && !roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const reflection = await getReflectionForReview(reflectionId);
  if (!reflection) notFound();

  const isReadOnly =
    reflection.goalReview?.status === "APPROVED" ||
    reflection.goalReview?.status === "PENDING_CHAIR_APPROVAL";

  const cycleLabel = `Cycle ${reflection.cycleNumber}${reflection.cycleNumber % 3 === 0 ? " (Quarterly)" : ""}`;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">
            {isReadOnly ? "View Review" : reflection.goalReview ? "Revise Review" : "Write Review"}
          </h1>
          <p className="page-subtitle">
            {reflection.mentee.name} · {cycleLabel} ·{" "}
            {new Date(reflection.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Link href="/mentorship-program/reviews" className="button ghost small">
          ← Review Queue
        </Link>
      </div>

      {/* Mentee context card */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontWeight: 600 }}>{reflection.mentee.name}</p>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{reflection.mentee.email}</p>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Submitted {new Date(reflection.submittedAt).toLocaleDateString()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            {reflection.goalReview && (
              <span className="pill">
                {STATUS_LABELS[reflection.goalReview.status] ?? reflection.goalReview.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mentee's reflection narrative sections (collapsed summary) */}
      <details className="card" style={{ marginBottom: "1.25rem", cursor: "pointer" }}>
        <summary style={{ fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
          Mentee Narrative Responses (click to expand)
        </summary>
        <div style={{ marginTop: "1rem" }}>
          <Section label="Overall Reflection" value={reflection.overallReflection} />
          <Section label="Engagement & Fulfillment" value={reflection.engagementOverall} />
          <Section label="What's Working Well" value={reflection.workingWell} />
          <Section label="Support Needed" value={reflection.supportNeeded} />
          <Section label="Mentor Helpfulness" value={reflection.mentorHelpfulness} />
          <Section label="Team Collaboration" value={reflection.collaborationAssessment} />
          {reflection.teamMembersAboveAndBeyond && (
            <Section label="Team Members Above & Beyond" value={reflection.teamMembersAboveAndBeyond} />
          )}
          {reflection.collaborationImprovements && (
            <Section label="Collaboration Improvements" value={reflection.collaborationImprovements} />
          )}
          {reflection.additionalReflections && (
            <Section label="Additional Notes" value={reflection.additionalReflections} />
          )}
        </div>
      </details>

      <ReviewForm
        reflectionId={reflectionId}
        goalResponses={reflection.goalResponses.map((gr) => ({
          goal: gr.goal,
          progressMade: gr.progressMade,
          objectiveAchieved: gr.objectiveAchieved,
          accomplishments: gr.accomplishments,
          blockers: gr.blockers,
          nextMonthPlans: gr.nextMonthPlans,
        }))}
        isQuarterly={reflection.cycleNumber % 3 === 0}
        cycleNumber={reflection.cycleNumber}
        existingReview={
          reflection.goalReview
            ? {
                id: reflection.goalReview.id,
                overallRating: reflection.goalReview.overallRating,
                overallComments: reflection.goalReview.overallComments,
                planOfAction: reflection.goalReview.planOfAction,
                projectedFuturePath: reflection.goalReview.projectedFuturePath,
                promotionReadiness: reflection.goalReview.promotionReadiness,
                status: reflection.goalReview.status,
                goalRatings: reflection.goalReview.goalRatings.map((r) => ({
                  goalId: r.goalId,
                  rating: r.rating,
                  comments: r.comments,
                })),
                chairComments: reflection.goalReview.chairComments,
              }
            : null
        }
        isReadOnly={isReadOnly}
      />
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <p style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.25rem" }}>{label}</p>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0, fontSize: "0.9rem" }}>{value}</p>
    </div>
  );
}
