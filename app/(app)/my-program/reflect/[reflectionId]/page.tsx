import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getReflectionById } from "@/lib/self-reflection-actions";
import Link from "next/link";

export const metadata = { title: "Reflection — My Program" };

const RATING_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444", bg: "#fef2f2" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706", bg: "#fffbeb" },
  ACHIEVED: { label: "Achieved", color: "#16a34a", bg: "#f0fdf4" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#6b21c8", bg: "#faf5ff" },
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <p
        style={{
          fontWeight: 700,
          fontSize: "0.82rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--muted)",
          marginBottom: "1rem",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <p style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.3rem" }}>{label}</p>
      <p style={{ color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{value}</p>
    </div>
  );
}

export default async function ReflectionViewPage({ params }: { params: Promise<{ reflectionId: string }> }) {
  const { reflectionId } = await params;

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const reflection = await getReflectionById(reflectionId);
  if (!reflection) notFound();

  const cycleLabel = `Cycle ${reflection.cycleNumber}${reflection.cycleNumber % 3 === 0 ? " (Quarterly)" : ""}`;
  const review = reflection.goalReview;
  const rating = review?.overallRating ? RATING_CONFIG[review.overallRating] : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Program</p>
          <h1 className="page-title">{cycleLabel}</h1>
          <p className="page-subtitle">
            {new Date(reflection.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })} ·
            Submitted {new Date(reflection.submittedAt).toLocaleDateString()}
          </p>
        </div>
        <Link href="/my-program" className="button ghost small">
          ← My Program
        </Link>
      </div>

      {/* Released goal review banner */}
      {review && rating && (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius-md)",
            background: rating.bg,
            border: `1px solid ${rating.color}44`,
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div>
            <p style={{ fontWeight: 700, color: rating.color }}>Mentor Review Released</p>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.2rem" }}>
              Overall rating:{" "}
              <span style={{ fontWeight: 600, color: rating.color }}>{rating.label}</span>
              {review.pointsAwarded !== null && (
                <> · <span style={{ fontWeight: 600 }}>+{review.pointsAwarded} achievement points</span></>
              )}
            </p>
          </div>
          <span className="pill" style={{ background: `${rating.color}22`, color: rating.color, flexShrink: 0 }}>
            {rating.label}
          </span>
        </div>
      )}

      {/* Section 1 */}
      <SectionCard title="Section 1 — Overall Reflection">
        <Field label="Overall Reflection" value={reflection.overallReflection} />
      </SectionCard>

      {/* Section 2 */}
      <SectionCard title="Section 2 — Engagement & Fulfillment">
        <Field label="Overall Engagement & Fulfillment" value={reflection.engagementOverall} />
        <Field label="What's Working Well" value={reflection.workingWell} />
        <Field label="Support Needed" value={reflection.supportNeeded} />
        <Field label="Mentor Helpfulness" value={reflection.mentorHelpfulness} />
      </SectionCard>

      {/* Section 3 */}
      <SectionCard title="Section 3 — Team Collaboration">
        <Field label="Collaboration Assessment" value={reflection.collaborationAssessment} />
        <Field label="Team Members Above & Beyond" value={reflection.teamMembersAboveAndBeyond} />
        <Field label="Collaboration Improvements" value={reflection.collaborationImprovements} />
      </SectionCard>

      {/* Section 4: Goal Progress */}
      <SectionCard title="Section 4 — Goal Progress">
        {reflection.goalResponses.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No role-specific goals were active for this cycle, so this section was skipped.
          </p>
        ) : (
          reflection.goalResponses.map((resp, idx) => (
            <div
              key={resp.id}
              style={{
                padding: "1rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                marginBottom: idx < reflection.goalResponses.length - 1 ? "0.75rem" : 0,
              }}
            >
              <p style={{ fontWeight: 700, marginBottom: "0.75rem" }}>
                Goal {idx + 1}: {resp.goal.title}
              </p>
              <Field label="Progress Made" value={resp.progressMade} />
              <div style={{ marginBottom: "0.75rem" }}>
                <span
                  className={`pill ${resp.objectiveAchieved ? "pill-success" : "pill-pending"}`}
                  style={{ fontSize: "0.8rem" }}
                >
                  {resp.objectiveAchieved ? "Objective achieved" : "Objective not yet achieved"}
                </span>
              </div>
              <Field label="Accomplishments" value={resp.accomplishments} />
              <Field label="Blockers" value={resp.blockers} />
              <Field label="Next Month's Plans" value={resp.nextMonthPlans} />
            </div>
          ))
        )}
      </SectionCard>

      {/* Section 5 */}
      {reflection.additionalReflections && (
        <SectionCard title="Section 5 — Additional Reflections">
          <Field label="Additional Notes" value={reflection.additionalReflections} />
        </SectionCard>
      )}

      {/* Released mentor review */}
      {review && (
        <SectionCard title="Mentor Review">
          <Field label="Overall Comments" value={review.overallComments} />
          <Field label="Plan of Action" value={review.planOfAction} />
          {review.projectedFuturePath && (
            <Field label="Projected Future Path" value={review.projectedFuturePath} />
          )}
          {review.promotionReadiness && (
            <Field label="Promotion Readiness" value={review.promotionReadiness} />
          )}
          {review.releasedToMenteeAt && (
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.5rem" }}>
              Released {new Date(review.releasedToMenteeAt).toLocaleDateString()}
            </p>
          )}
        </SectionCard>
      )}

      {!review && (
        <div className="card" style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>
          <p>Your mentor&apos;s review is pending. You&apos;ll see it here once it&apos;s approved and released.</p>
        </div>
      )}
    </div>
  );
}
