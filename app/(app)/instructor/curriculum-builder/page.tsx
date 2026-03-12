import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getInstructorTemplates,
  getInstructorOfferings,
  submitCurriculumForReview,
} from "@/lib/class-management-actions";
import Link from "next/link";
import { CurriculumBuilderClient } from "./client";
import {
  getClassTemplateCapabilities,
  getTemplateSubmissionStatus,
} from "@/lib/class-template-compat";
import { summarizeRichText } from "@/lib/rich-text-summary";

export default async function CurriculumBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const [capabilities, templates, offerings] = await Promise.all([
    getClassTemplateCapabilities(),
    getInstructorTemplates(session.user.id),
    getInstructorOfferings(session.user.id),
  ]);
  const hasReviewWorkflow = capabilities.hasReviewWorkflow;

  const difficultyLabels: Record<string, string> = {
    LEVEL_101: "101 - Beginner",
    LEVEL_201: "201 - Intermediate",
    LEVEL_301: "301 - Advanced",
    LEVEL_401: "401 - Expert",
  };

  const submissionStatusColors: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: "var(--gray-200)", color: "var(--text-secondary)" },
    SUBMITTED: { bg: "#fef9c3", color: "#854d0e" },
    APPROVED: { bg: "#dcfce7", color: "#166534" },
    NEEDS_REVISION: { bg: "#fee2e2", color: "#991b1b" },
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor</p>
          <h1 className="page-title">Curriculum Builder</h1>
          <p className="page-subtitle">Build structured, pedagogically-rich curricula and submit for approval.</p>
        </div>
        <Link href="/instructor/curriculum-builder#create" className="button primary">
          + New Curriculum
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {templates.length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Curricula Created</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {templates.filter((template) => getTemplateSubmissionStatus(template, hasReviewWorkflow) === "APPROVED").length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Approved</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {offerings.length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Active Offerings</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {offerings.reduce((sum, o) => sum + o._count.enrollments, 0)}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Students Enrolled</div>
        </div>
      </div>

      {!hasReviewWorkflow && (
        <div
          className="card"
          style={{ marginBottom: 24, background: "#fffbeb", border: "1px solid #fcd34d" }}
        >
          <p style={{ margin: 0, color: "#92400e", fontSize: 14 }}>
            Curriculum review badges and submission buttons will appear automatically after the latest curriculum database migration is applied.
          </p>
        </div>
      )}

      {/* Existing Templates */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-title">Your Curricula</div>
        {templates.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No curricula yet. Create your first curriculum to start building classes!
            </p>
          </div>
        ) : (
          <div className="grid two">
            {templates.map((template) => (
              <div key={template.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>{template.title}</h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                      {summarizeRichText(template.description, 120)}
                    </p>
                  </div>
                  <span
                    className={`pill ${template.isPublished ? "primary" : ""}`}
                    style={!template.isPublished ? { background: "var(--gray-200)" } : {}}
                  >
                    {template.isPublished ? "Published" : "Draft"}
                  </span>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="pill">{template.interestArea}</span>
                  <span className="pill">{difficultyLabels[template.difficultyLevel] || template.difficultyLevel}</span>
                  <span className="pill">{template.durationWeeks} weeks</span>
                  <span className="pill">{template.sessionsPerWeek}x/week</span>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>{template.learningOutcomes.length} outcomes</span>
                  <span>{template._count.offerings} offering{template._count.offerings !== 1 ? "s" : ""}</span>
                  <span>Ideal: {template.idealSize} students</span>
                </div>

                {/* Submission status badge */}
                {(() => {
                  const status = getTemplateSubmissionStatus(template, hasReviewWorkflow);
                  const colors = submissionStatusColors[status] ?? submissionStatusColors.DRAFT;
                  return (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: colors.bg,
                        color: colors.color,
                      }}>
                        {status.replace(/_/g, " ")}
                      </span>
                      {status === "NEEDS_REVISION" && (
                        <span style={{ fontSize: 12, color: "#991b1b" }}>Revision requested - update and resubmit</span>
                      )}
                    </div>
                  );
                })()}

                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/instructor/curriculum-builder#edit-${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                    Edit
                  </Link>
                  {(() => {
                    const status = getTemplateSubmissionStatus(template, hasReviewWorkflow);
                    const canSubmit = hasReviewWorkflow && (status === "DRAFT" || status === "NEEDS_REVISION");
                    return canSubmit ? (
                      <form action={submitCurriculumForReview}>
                        <input type="hidden" name="id" value={template.id} />
                        <button type="submit" className="button primary" style={{ fontSize: 13 }}>
                          Submit for Review
                        </button>
                      </form>
                    ) : null;
                  })()}
                  <Link href={`/lesson-plans?templateId=${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                    Build Lesson Plan
                  </Link>
                  <Link href={`/instructor/class-settings?template=${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                    Create Offering
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Offerings */}
      {offerings.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">Your Active Offerings</div>
          <div className="grid two">
            {offerings.map((offering) => (
              <Link
                key={offering.id}
                href={`/curriculum/${offering.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <h3>{offering.title}</h3>
                  <span className={`pill ${offering.status === "PUBLISHED" ? "primary" : ""}`}>
                    {offering.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                  {new Date(offering.startDate).toLocaleDateString()} - {new Date(offering.endDate).toLocaleDateString()}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="pill">{offering.template.interestArea}</span>
                  <span className="pill">{offering.deliveryMode.replace("_", " ")}</span>
                  <span className="pill">{offering.meetingDays.join(", ")}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  {offering._count.enrollments} / {offering.capacity} enrolled
                  {" | "}
                  {offering._count.sessions} sessions
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Create New Template Form */}
      <div id="create" style={{ marginBottom: 32 }}>
        <div className="section-title">Build New Curriculum</div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
          Fill out each section below. Save as a draft anytime - submit for review when your curriculum is ready for approval by your chapter lead or admin.
        </p>
        <CurriculumBuilderClient />
      </div>
    </div>
  );
}
