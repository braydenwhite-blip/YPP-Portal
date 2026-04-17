import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { approveCurriculum, requestCurriculumRevision } from "@/lib/curriculum-review-actions";
import { getClassTemplateCapabilities } from "@/lib/class-template-compat";
import { getLearnerFitSummary } from "@/lib/learner-fit";

export default async function AdminCurriculaPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  if (!isAdmin && !isChapterLead) redirect("/");

  // Admins see all submitted curricula; chapter presidents see their chapter's
  let chapterId: string | null = null;
  if (isChapterLead && !isAdmin && session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { chapterId: true },
    });
    chapterId = dbUser?.chapterId ?? null;
  }

  const capabilities = await getClassTemplateCapabilities();
  if (!capabilities.hasReviewWorkflow || !capabilities.hasAdvancedCurriculumFields) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">{isAdmin ? "Admin" : "Chapter President"}</p>
            <h1 className="page-title">Curriculum Review Queue</h1>
            <p className="page-subtitle">Review and approve instructor-submitted curricula before they go live.</p>
          </div>
        </div>

        <div className="card" style={{ background: "#fffbeb", border: "1px solid #fcd34d" }}>
          <p style={{ margin: 0, color: "#92400e" }}>
            The curriculum review workflow will appear here after the latest curriculum database migration is applied.
          </p>
        </div>
      </div>
    );
  }

  const submitted = await prisma.classTemplate.findMany({
    where: {
      submissionStatus: { in: ["SUBMITTED", "APPROVED", "NEEDS_REVISION"] },
      ...(isChapterLead && !isAdmin && chapterId ? { chapterId } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      interestArea: true,
      difficultyLevel: true,
      learnerFitLabel: true,
      learnerFitDescription: true,
      durationWeeks: true,
      submissionStatus: true,
      submittedAt: true,
      reviewNotes: true,
      targetAgeGroup: true,
      classDurationMin: true,
      learningOutcomes: true,
      engagementStrategy: true,
      weeklyTopics: true,
      createdBy: {
        select: { id: true, name: true, email: true, chapter: { select: { name: true } } },
      },
      reviewedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const byStatus = {
    SUBMITTED: submitted.filter((c) => c.submissionStatus === "SUBMITTED"),
    APPROVED: submitted.filter((c) => c.submissionStatus === "APPROVED"),
    NEEDS_REVISION: submitted.filter((c) => c.submissionStatus === "NEEDS_REVISION"),
  };

  const statusColors: Record<string, { bg: string; color: string }> = {
    SUBMITTED: { bg: "#fef9c3", color: "#854d0e" },
    APPROVED: { bg: "#dcfce7", color: "#166534" },
    NEEDS_REVISION: { bg: "#fee2e2", color: "#991b1b" },
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">{isAdmin ? "Admin" : "Chapter President"}</p>
          <h1 className="page-title">Curriculum Review Queue</h1>
          <p className="page-subtitle">Review and approve instructor-submitted curricula before they go live.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{byStatus.SUBMITTED.length}</div>
          <div className="kpi-label">Awaiting Review</div>
        </div>
        <div className="card">
          <div className="kpi">{byStatus.APPROVED.length}</div>
          <div className="kpi-label">Approved</div>
        </div>
        <div className="card">
          <div className="kpi">{byStatus.NEEDS_REVISION.length}</div>
          <div className="kpi-label">Needs Revision</div>
        </div>
      </div>

      {/* Pending Review */}
      {byStatus.SUBMITTED.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title" style={{ color: "#854d0e", marginBottom: 12 }}>
            Awaiting Review ({byStatus.SUBMITTED.length})
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            {byStatus.SUBMITTED.map((curriculum) => (
              <CurriculumReviewCard
                key={curriculum.id}
                curriculum={curriculum}
                statusColors={statusColors}
              />
            ))}
          </div>
        </div>
      )}

      {submitted.length === 0 && (
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>No curricula submitted for review yet.</p>
        </div>
      )}

      {/* Previously reviewed */}
      {(byStatus.APPROVED.length > 0 || byStatus.NEEDS_REVISION.length > 0) && (
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>Previously Reviewed</div>
          <div style={{ display: "grid", gap: 12 }}>
            {[...byStatus.APPROVED, ...byStatus.NEEDS_REVISION].map((curriculum) => (
              <div key={curriculum.id} className="card" style={{ opacity: 0.85 }}>
                {(() => {
                  const learnerFit = getLearnerFitSummary({
                    learnerFitLabel: (curriculum as { learnerFitLabel?: string | null }).learnerFitLabel,
                    learnerFitDescription: (curriculum as { learnerFitDescription?: string | null }).learnerFitDescription,
                    difficultyLevel: curriculum.difficultyLevel,
                  });

                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <h3 style={{ margin: 0 }}>{curriculum.title}</h3>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                            {curriculum.createdBy.name} · {curriculum.createdBy.chapter?.name ?? "No chapter"} · {curriculum.interestArea} · {learnerFit.label}
                          </div>
                        </div>
                        <span style={{
                          padding: "3px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: statusColors[curriculum.submissionStatus]?.bg,
                          color: statusColors[curriculum.submissionStatus]?.color,
                        }}>
                          {curriculum.submissionStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                      {curriculum.reviewNotes && (
                        <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--surface-alt, #f9f9f9)", borderRadius: 8, fontSize: 13 }}>
                          <strong>Review notes:</strong> {curriculum.reviewNotes}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CurriculumReviewCard({
  curriculum,
  statusColors,
}: {
  curriculum: {
    id: string;
    title: string;
    description: string;
    interestArea: string;
    difficultyLevel: string;
    learnerFitLabel?: string | null;
    learnerFitDescription?: string | null;
    durationWeeks: number;
    submissionStatus: string;
    submittedAt: Date | null;
    reviewNotes: string | null;
    targetAgeGroup: string | null;
    classDurationMin: number | null;
    learningOutcomes: string[];
    engagementStrategy: unknown;
    weeklyTopics: unknown;
    createdBy: { id: string; name: string | null; email: string; chapter: { name: string } | null };
    reviewedBy: { id: string; name: string | null } | null;
  };
  statusColors: Record<string, { bg: string; color: string }>;
}) {
  const lessons = Array.isArray(curriculum.weeklyTopics) ? curriculum.weeklyTopics as Array<Record<string, string>> : [];
  const strategy = curriculum.engagementStrategy && typeof curriculum.engagementStrategy === "object"
    ? curriculum.engagementStrategy as Record<string, string>
    : null;
  const learnerFit = getLearnerFitSummary({
    learnerFitLabel: curriculum.learnerFitLabel,
    learnerFitDescription: curriculum.learnerFitDescription,
    difficultyLevel: curriculum.difficultyLevel,
  });

  return (
    <div className="card" style={{ border: "2px solid #fbbf24" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>{curriculum.title}</h3>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
            <strong>{curriculum.createdBy.name}</strong> · {curriculum.createdBy.email} · {curriculum.createdBy.chapter?.name ?? "No chapter"}
          </div>
        </div>
        <span style={{
          padding: "4px 14px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          background: statusColors[curriculum.submissionStatus]?.bg,
          color: statusColors[curriculum.submissionStatus]?.color,
        }}>
          {curriculum.submissionStatus.replace("_", " ")}
        </span>
      </div>

      {/* Meta pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <span className="pill">{curriculum.interestArea}</span>
        <span className="pill" style={{ background: learnerFit.accent + "18", color: learnerFit.accent }}>
          {learnerFit.label}
        </span>
        <span className="pill">{curriculum.durationWeeks} lessons</span>
        {curriculum.targetAgeGroup && <span className="pill">Ages {curriculum.targetAgeGroup}</span>}
        {curriculum.classDurationMin && <span className="pill">{curriculum.classDurationMin} min/class</span>}
        {curriculum.submittedAt && (
          <span className="pill">Submitted {new Date(curriculum.submittedAt).toLocaleDateString()}</span>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
        {learnerFit.description}
      </div>

      {/* Description */}
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14, color: "var(--text-secondary)" }}>
        {curriculum.description.slice(0, 200)}{curriculum.description.length > 200 ? "..." : ""}
      </p>

      {/* Learning Outcomes */}
      {curriculum.learningOutcomes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Course Vision</div>
          {curriculum.learningOutcomes.map((outcome, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>• {outcome}</div>
          ))}
        </div>
      )}

      {/* Lesson Sequence Preview */}
      {lessons.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Lesson Sequence ({lessons.length} lessons)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#faf5ff" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid var(--border)", width: 40 }}>#</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid var(--border)" }}>Topic</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid var(--border)" }}>What Students Do</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid var(--border)" }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {lessons.slice(0, 8).map((lesson, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 10px", border: "1px solid var(--border)", textAlign: "center", fontWeight: 700, color: "var(--ypp-purple)" }}>{i + 1}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid var(--border)" }}>{lesson.topic || "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid var(--border)" }}>{lesson.activities || "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid var(--border)" }}>{lesson.progressNote || "—"}</td>
                  </tr>
                ))}
                {lessons.length > 8 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 10px", textAlign: "center", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 12 }}>
                      + {lessons.length - 8} more lessons
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Engagement Strategy */}
      {strategy && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#faf5ff", borderRadius: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "var(--ypp-purple)" }}>Engagement Strategy</div>
          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
            {strategy.energyStyle && <div><strong>Energy:</strong> {strategy.energyStyle}</div>}
            {strategy.differentiationPlan && <div><strong>Differentiation:</strong> {strategy.differentiationPlan}</div>}
            {strategy.technologyTools && <div><strong>Tech/Tools:</strong> {strategy.technologyTools}</div>}
            {strategy.studentVoiceMoments && <div><strong>Student Voice:</strong> {strategy.studentVoiceMoments}</div>}
            {strategy.assessmentApproach && <div><strong>Assessment:</strong> {strategy.assessmentApproach}</div>}
          </div>
        </div>
      )}

      {/* Review actions */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <form action={approveCurriculum} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="id" value={curriculum.id} />
          <button type="submit" className="button primary" style={{ fontSize: 13 }}>
            Approve
          </button>
        </form>
        <form action={requestCurriculumRevision} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="id" value={curriculum.id} />
          <input
            name="reviewNotes"
            className="input"
            placeholder="Notes for instructor (required for revision request)"
            style={{ fontSize: 13, minWidth: 240 }}
            required
          />
          <button type="submit" className="button secondary" style={{ fontSize: 13 }}>
            Request Revision
          </button>
        </form>
      </div>
    </div>
  );
}
