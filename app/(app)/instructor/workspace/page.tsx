import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstructorReadiness } from "@/lib/instructor-readiness";
import { toggleInstructorPathwaySpec } from "@/lib/instructor-pathway-actions";
import { INSTRUCTOR_MILESTONES } from "@/lib/xp-config";
import { WorkspaceCreateButton } from "@/components/workspace-create-button";
import { normalizeStatus, getStatusBadgeStyle } from "@/lib/status-utils";
import {
  getClassTemplateCapabilities,
  getTemplateSubmissionStatus,
} from "@/lib/class-template-compat";
import { summarizeRichText } from "@/lib/rich-text-summary";
import {
  getInstructorOfferings,
  getInstructorTemplates,
} from "@/lib/class-management-actions";
import {
  getActivePathwaysForInstructorWorkspace,
  hasInstructorPathwaySpecTable,
} from "@/lib/instructor-pathway-spec-compat";

const tabs = ["curricula", "lesson-plans", "offerings", "readiness", "my-pathway"] as const;
type WorkspaceTab = (typeof tabs)[number];

const TAB_LABELS: Record<WorkspaceTab, string> = {
  curricula: "Curricula",
  "lesson-plans": "Lesson Plans",
  offerings: "Offerings",
  readiness: "Readiness",
  "my-pathway": "My Pathway",
};

const LEVELS = ["LEVEL_101", "LEVEL_201", "LEVEL_301", "LEVEL_401"] as const;
const LEVEL_LABELS: Record<string, string> = {
  LEVEL_101: "Level 101",
  LEVEL_201: "Level 201",
  LEVEL_301: "Level 301",
  LEVEL_401: "Level 401",
};
const LEVEL_DESCRIPTIONS: Record<string, string> = {
  LEVEL_101: "Foundations — teach entry-level classes",
  LEVEL_201: "Intermediate — teach 200-level courses",
  LEVEL_301: "Advanced — teach 300-level courses",
  LEVEL_401: "Expert — teach all levels including 401",
};

function safeTab(tab: string | undefined): WorkspaceTab {
  if (!tab) return "curricula";
  return tabs.includes(tab as WorkspaceTab) ? (tab as WorkspaceTab) : "curricula";
}

function difficultyLabel(level: string) {
  const map: Record<string, string> = {
    LEVEL_101: "101",
    LEVEL_201: "201",
    LEVEL_301: "301",
    LEVEL_401: "401",
  };
  return map[level] || level;
}

export default async function InstructorWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const canAccess = roles.includes("INSTRUCTOR") || roles.includes("ADMIN") || roles.includes("CHAPTER_LEAD");
  if (!canAccess) redirect("/");

  const tab = safeTab((await searchParams).tab);

  const [capabilities, hasPathwaySpecsTable, templates, lessonPlans, offerings, readiness, teachingPermissions, allPathways, activeOfferings, menteeCount] = await Promise.all([
    getClassTemplateCapabilities(),
    hasInstructorPathwaySpecTable(),
    getInstructorTemplates(session.user.id),
    prisma.lessonPlan.findMany({
      where: { authorId: session.user.id },
      include: {
        activities: true,
        classTemplate: {
          select: { id: true, title: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    getInstructorOfferings(session.user.id),
    getInstructorReadiness(session.user.id),
    prisma.instructorTeachingPermission.findMany({
      where: { instructorId: session.user.id },
      select: { level: true, grantedAt: true },
    }),
    getActivePathwaysForInstructorWorkspace(session.user.id),
    prisma.classOffering.findMany({
      where: { instructorId: session.user.id, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        startDate: true,
        _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
      },
    }),
    prisma.mentorship.count({
      where: { mentorId: session.user.id, status: "ACTIVE" },
    }).catch(() => 0),
  ]);
  const hasReviewWorkflow = capabilities.hasReviewWorkflow;

  const totalPlannedWeeks = templates.reduce((sum, t) => {
    const weeklyPlanRows = Array.isArray(t.weeklyTopics) ? t.weeklyTopics.length : 0;
    return sum + Math.max(weeklyPlanRows, t.durationWeeks);
  }, 0);
  const lessonPlanCount = lessonPlans.length;
  const coveredWeeks = templates.reduce((sum, template) => {
    const weeklyPlanRows = Array.isArray(template.weeklyTopics) ? template.weeklyTopics.length : 0;
    const targetWeeks = Math.max(weeklyPlanRows, template.durationWeeks);
    const linkedPlans = lessonPlans.filter((plan) => plan.classTemplateId === template.id).length;
    return sum + Math.min(targetWeeks, linkedPlans);
  }, 0);
  const estimatedCoverage =
    totalPlannedWeeks > 0 ? Math.min(100, Math.round((coveredWeeks / totalPlannedWeeks) * 100)) : 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Instructor Workspace</h1>
          <p className="page-subtitle">
            Plan curricula, build lesson plans, publish offerings, and clear readiness blockers in one place.
          </p>
        </div>
        <WorkspaceCreateButton />
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{templates.length}</div>
          <div className="kpi-label">Curricula</div>
        </div>
        <div className="card">
          <div className="kpi">{lessonPlanCount}</div>
          <div className="kpi-label">Lesson Plans</div>
        </div>
        <div className="card">
          <div className="kpi">{offerings.length}</div>
          <div className="kpi-label">Offerings</div>
        </div>
        <div className="card">
          <div className="kpi">{readiness.canPublishFirstOffering ? "Ready" : "Blocked"}</div>
          <div className="kpi-label">Readiness</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Curriculum-to-Lesson Coverage</h3>
            <p style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 14 }}>
              Estimated coverage tracks lesson plans created against planned curriculum weeks.
            </p>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ypp-purple)" }}>{estimatedCoverage}%</div>
        </div>
        <div style={{ marginTop: 10, width: "100%", height: 8, background: "var(--gray-200)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ width: `${estimatedCoverage}%`, height: "100%", background: "var(--ypp-purple)", borderRadius: 6 }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          {coveredWeeks} covered week slots from {lessonPlanCount} lesson plans across {totalPlannedWeeks} planned week slots.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map((candidate) => (
          <Link
            key={candidate}
            href={`/instructor/workspace?tab=${candidate}`}
            className="button secondary"
            style={tab === candidate ? { background: "var(--ypp-purple)", color: "white", borderColor: "var(--ypp-purple)" } : {}}
          >
            {TAB_LABELS[candidate]}
          </Link>
        ))}
      </div>

      {!hasReviewWorkflow && (
        <div
          className="card"
          style={{ marginBottom: 18, background: "#fffbeb", border: "1px solid #fcd34d" }}
        >
          <p style={{ margin: 0, color: "#92400e", fontSize: 14 }}>
            Curriculum review status will appear automatically after the latest curriculum database migration is applied.
          </p>
        </div>
      )}

      {tab === "curricula" && (
        <div className="grid two">
          {templates.length === 0 ? (
            <div className="card">
              <h3>No Curricula Yet</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Create your first curriculum template, then attach lesson plans and publish an offering.
              </p>
              <Link href="/instructor/curriculum-builder" className="button primary" style={{ marginTop: 10 }}>
                Open Curriculum Builder
              </Link>
            </div>
          ) : (
            templates.map((template) => {
              const weeklyPlanRows = Array.isArray(template.weeklyTopics) ? template.weeklyTopics.length : 0;
              return (
                <div key={template.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                    <div>
                      <h3>{template.title}</h3>
                      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                        {summarizeRichText(template.description, 120)}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      {(() => {
                        const rawStatus = getTemplateSubmissionStatus(template, hasReviewWorkflow);
                        const normalized = normalizeStatus(rawStatus, "template", { isPublished: template.isPublished });
                        return (
                          <span className="pill" style={getStatusBadgeStyle(normalized)}>
                            {normalized}
                          </span>
                        );
                      })()}
                      {template.isPublished && (
                        <span className="pill primary" style={{ fontSize: 11 }}>Live</span>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="pill">{difficultyLabel(template.difficultyLevel)}</span>
                    <span className="pill">{template.interestArea}</span>
                    <span className="pill">{template.durationWeeks} weeks</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                    Weekly plan rows: {weeklyPlanRows} | Published offerings: {template._count.offerings}
                  </div>
                  {/* Inline "Create Offering" prompt for approved curricula with no offerings */}
                  {getTemplateSubmissionStatus(template, hasReviewWorkflow) === "APPROVED" && template._count.offerings === 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        background: "#e8f5e9",
                        border: "1px solid #a5d6a7",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 13, color: "#2e7d32" }}>
                        ✓ Curriculum approved! Ready to teach?
                      </p>
                      <Link
                        href={`/instructor/class-settings?template=${template.id}`}
                        className="button primary"
                        style={{ fontSize: 12, whiteSpace: "nowrap", textDecoration: "none" }}
                      >
                        Create Offering →
                      </Link>
                    </div>
                  )}
                  <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/instructor/curriculum-builder#edit-${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                      Edit Curriculum
                    </Link>
                    <Link
                      href={`/lesson-plans?templateId=${template.id}`}
                      className="button secondary"
                      style={{ fontSize: 13 }}
                    >
                      Build Lesson Plan
                    </Link>
                    <Link href={`/instructor/class-settings?template=${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                      Create Offering
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "lesson-plans" && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0 }}>Lesson Plan Library</h3>
                <p style={{ marginTop: 6, color: "var(--text-secondary)" }}>
                  Use the builder for custom plans and templates for re-use.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/lesson-plans" className="button primary">Open Builder</Link>
                <Link href="/instructor/lesson-plans/templates" className="button secondary">Template Library</Link>
              </div>
            </div>
          </div>
          <div className="grid two">
            {lessonPlans.slice(0, 12).map((plan) => (
              <div className="card" key={plan.id}>
                <h3>{plan.title}</h3>
                {plan.description && (
                  <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{plan.description.slice(0, 130)}</p>
                )}
                <div style={{ marginTop: 8, display: "flex", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>{plan.totalMinutes} min</span>
                  <span>{plan.activities.length} activities</span>
                  <span>{plan.isTemplate ? "Template" : "Personal"}</span>
                  {plan.classTemplate ? <span>Linked: {plan.classTemplate.title}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "offerings" && (
        <div className="grid two">
          {offerings.length === 0 ? (
            <div className="card">
              <h3>No Offerings Yet</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Create an offering from one of your curricula and publish when ready.
              </p>
              <Link href="/instructor/class-settings" className="button primary" style={{ marginTop: 10 }}>
                Create Offering
              </Link>
            </div>
          ) : (
            offerings.map((offering) => {
              const normalizedOfferingStatus = normalizeStatus(offering.status, "offering");
              const isPublished = offering.status === "PUBLISHED";
              return (
                <div key={offering.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3>{offering.title}</h3>
                      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{offering.template.title}</p>
                    </div>
                    <span className="pill" style={getStatusBadgeStyle(normalizedOfferingStatus)}>
                      {normalizedOfferingStatus}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                    {new Date(offering.startDate).toLocaleDateString()} - {new Date(offering.endDate).toLocaleDateString()}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                    {offering._count.enrollments} enrolled | {offering.meetingDays.join(", ")} | {offering.meetingTime}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    <Link href={`/curriculum/${offering.id}`} className="button secondary" style={{ fontSize: 12, textDecoration: "none" }}>
                      Manage →
                    </Link>
                  </div>
                  {isPublished && (
                    <details style={{ marginTop: 14 }}>
                      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ypp-purple, #7c3aed)" }}>
                        Enroll Students via Cohort
                      </summary>
                      <div style={{ marginTop: 10 }}>
                        {/* CohortManager is a client component — embed via dynamic import not needed; it renders client-side */}
                        <p style={{ fontSize: 12, color: "var(--muted)" }}>
                          Visit{" "}
                          <a href={`/curriculum/${offering.id}`} style={{ color: "var(--ypp-purple, #7c3aed)" }}>
                            the offering page
                          </a>{" "}
                          to manage cohort enrollment, or use the{" "}
                          <a href={`/instructor/sequence-builder`} style={{ color: "var(--ypp-purple, #7c3aed)" }}>
                            Sequence Builder
                          </a>
                          .
                        </p>
                      </div>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "readiness" && (
        <div className="card">
          <h3>Readiness Status</h3>
          <p style={{ marginTop: 6, color: "var(--text-secondary)" }}>
            Publishing your first offering depends on training and interview gate completion.
          </p>

          <div className="grid three" style={{ marginTop: 14 }}>
            <div>
              <div className="kpi">{readiness.completedRequiredModules}/{readiness.requiredModulesCount}</div>
              <div className="kpi-label">Required Modules</div>
            </div>
            <div>
              <div className="kpi">{readiness.interviewStatus.replace(/_/g, " ")}</div>
              <div className="kpi-label">Interview Gate</div>
            </div>
            <div>
              <div className="kpi">{readiness.canPublishFirstOffering ? "Ready" : "Blocked"}</div>
              <div className="kpi-label">First Publish</div>
            </div>
          </div>

          {readiness.missingRequirements.length > 0 ? (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {readiness.missingRequirements.map((req) => (
                <div key={req.code} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
                  <div style={{ fontWeight: 600 }}>{req.title}</div>
                  <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 14 }}>{req.detail}</div>
                  <Link href={req.href} className="link" style={{ marginTop: 6, display: "inline-block" }}>
                    Resolve now
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 14, padding: 12, background: "#f0fdf4", color: "#166534", borderRadius: 10 }}>
              You are clear to publish your first offering.
            </div>
          )}
        </div>
      )}

      {tab === "my-pathway" && (() => {
        const grantedLevels = new Set(teachingPermissions.map((p) => p.level));
        const highestGranted = LEVELS.filter((l) => grantedLevels.has(l)).pop() ?? null;
        const currentLevelIndex = highestGranted ? LEVELS.indexOf(highestGranted) : -1;
        const nextLevel = currentLevelIndex < LEVELS.length - 1 ? LEVELS[currentLevelIndex + 1] : null;
        const trainingPct =
          readiness.requiredModulesCount > 0
            ? Math.round((readiness.completedRequiredModules / readiness.requiredModulesCount) * 100)
            : 0;
        const interviewStatus = readiness.interviewStatus;
        const interviewPassed = interviewStatus === "PASSED" || interviewStatus === "WAIVED";

        // Compute earned milestones from available data
        const earnedMilestoneKeys = new Set<string>();
        if (readiness.trainingComplete) earnedMilestoneKeys.add("COMPLETE_INSTRUCTOR_TRAINING");
        if (interviewPassed) earnedMilestoneKeys.add("PASS_INTERVIEW_GATE");
        if (offerings.length >= 1) earnedMilestoneKeys.add("TEACH_FIRST_CLASS");
        if (offerings.length >= 10) earnedMilestoneKeys.add("TEACH_10_CLASSES");
        if (grantedLevels.has("LEVEL_201")) earnedMilestoneKeys.add("UNLOCK_LEVEL_201");
        if (grantedLevels.has("LEVEL_301")) earnedMilestoneKeys.add("UNLOCK_LEVEL_301");
        if (grantedLevels.has("LEVEL_401")) earnedMilestoneKeys.add("UNLOCK_LEVEL_401");
        if (templates.some((template) => getTemplateSubmissionStatus(template, hasReviewWorkflow) === "APPROVED")) earnedMilestoneKeys.add("CURRICULUM_APPROVED");
        if (menteeCount >= 5) earnedMilestoneKeys.add("MENTOR_5_STUDENTS");

        return (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Level Progression Roadmap */}
            <div className="card">
              <h3 style={{ marginBottom: 4 }}>Your Instructor Pathway</h3>
              <p style={{ marginTop: 0, marginBottom: 16, color: "var(--text-secondary)", fontSize: 14 }}>
                Complete training, pass your interview, and earn teaching permissions at each level.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {LEVELS.map((level, idx) => {
                  const granted = grantedLevels.has(level);
                  const isCurrent = !granted && idx === currentLevelIndex + 1;
                  const isLocked = !granted && !isCurrent;
                  return (
                    <div
                      key={level}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: `1px solid ${granted ? "#16a34a" : isCurrent ? "var(--ypp-purple)" : "var(--border)"}`,
                        background: granted ? "#f0fdf4" : isCurrent ? "#faf5ff" : "var(--surface)",
                        opacity: isLocked ? 0.55 : 1,
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: granted ? "#16a34a" : isCurrent ? "var(--ypp-purple)" : "var(--gray-200)",
                        color: granted || isCurrent ? "white" : "var(--text-secondary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 13,
                      }}>
                        {granted ? "✓" : idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{LEVEL_LABELS[level]}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                          {LEVEL_DESCRIPTIONS[level]}
                        </div>
                        {granted && (() => {
                          const perm = teachingPermissions.find((p) => p.level === level);
                          return perm ? (
                            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>
                              Granted {new Date(perm.grantedAt).toLocaleDateString()}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <span
                        className="pill"
                        style={granted ? { background: "#dcfce7", color: "#166534" } : isCurrent ? { background: "#ede9fe", color: "#5b21b6" } : {}}
                      >
                        {granted ? "Unlocked" : isCurrent ? "In Progress" : "Locked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Training Progress Card */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Step 1 — Complete Training Academy</h3>
                  <p style={{ marginTop: 6, marginBottom: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                    Finish all required modules to unlock your readiness review and interview gate.
                  </p>
                </div>
                <span
                  className="pill"
                  style={readiness.trainingComplete ? { background: "#dcfce7", color: "#166534" } : { background: "#ede9fe", color: "#5b21b6" }}
                >
                  {readiness.trainingComplete ? "Complete" : "In Progress"}
                </span>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span>{readiness.completedRequiredModules} of {readiness.requiredModulesCount} required modules complete</span>
                  <span style={{ fontWeight: 700, color: "var(--ypp-purple)" }}>{trainingPct}%</span>
                </div>
                <div style={{ height: 10, background: "var(--gray-200)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${trainingPct}%`, height: "100%", background: readiness.trainingComplete ? "#16a34a" : "var(--ypp-purple)", borderRadius: 6, transition: "width 0.3s" }} />
                </div>
              </div>
              <Link
                href="/instructor-training"
                className="button primary"
                style={{ marginTop: 14, display: "inline-block", textDecoration: "none" }}
              >
                {readiness.trainingComplete ? "View Training Certificate" : "Continue Training Academy"}
              </Link>
            </div>

            {/* Interview Gate Card */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Step 2 — Pass the Interview Gate</h3>
                  <p style={{ marginTop: 6, marginBottom: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                    Schedule and complete your instructor interview to unlock first-class publishing.
                  </p>
                </div>
                <span
                  className="pill"
                  style={interviewPassed
                    ? { background: "#dcfce7", color: "#166534" }
                    : interviewStatus === "SCHEDULED"
                      ? { background: "#fef9c3", color: "#854d0e" }
                      : interviewStatus === "HOLD" || interviewStatus === "FAILED"
                        ? { background: "#fee2e2", color: "#991b1b" }
                        : {}}
                >
                  {interviewStatus.replace(/_/g, " ")}
                </span>
              </div>
              {!interviewPassed && (
                <Link
                  href="/instructor-training"
                  className="button secondary"
                  style={{ marginTop: 14, display: "inline-block", textDecoration: "none", fontSize: 14 }}
                >
                  {interviewStatus === "SCHEDULED" ? "View Interview Details" : "Schedule Interview"}
                </Link>
              )}
              {interviewPassed && (
                <div style={{ marginTop: 12, padding: 10, background: "#f0fdf4", borderRadius: 8, fontSize: 14, color: "#166534" }}>
                  Interview complete — you are authorized to publish your first class.
                </div>
              )}
            </div>

            {/* Step 3: Build Your Curriculum */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Step 3 — Build Your Curriculum</h3>
                  <p style={{ marginTop: 6, marginBottom: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                    Design your course using the structured YPP curriculum template — lesson plans, engagement strategy, and all. Submit for approval when ready.
                  </p>
                </div>
                {(() => {
                  const approvedCount = templates.filter((template) => getTemplateSubmissionStatus(template, hasReviewWorkflow) === "APPROVED").length;
                  const submittedCount = hasReviewWorkflow
                    ? templates.filter((template) => getTemplateSubmissionStatus(template, hasReviewWorkflow) === "SUBMITTED").length
                    : 0;
                  const draftCount = templates.filter((template) => {
                    const status = getTemplateSubmissionStatus(template, hasReviewWorkflow);
                    return status === "DRAFT" || status === "NEEDS_REVISION";
                  }).length;
                  if (approvedCount > 0) return <span className="pill" style={{ background: "#dcfce7", color: "#166534" }}>{approvedCount} Approved</span>;
                  if (submittedCount > 0) return <span className="pill" style={{ background: "#fef9c3", color: "#854d0e" }}>{submittedCount} Under Review</span>;
                  if (draftCount > 0) return <span className="pill" style={{ background: "#ede9fe", color: "#5b21b6" }}>{draftCount} Draft</span>;
                  return <span className="pill">Not Started</span>;
                })()}
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href="/instructor/curriculum-builder#create"
                  className="button primary"
                  style={{ textDecoration: "none" }}
                >
                  Build New Curriculum
                </Link>
                {templates.length > 0 && (
                  <Link
                    href="/instructor/curriculum-builder"
                    className="button secondary"
                    style={{ textDecoration: "none" }}
                  >
                    View My Curricula ({templates.length})
                  </Link>
                )}
              </div>
            </div>

            {/* Next Level Requirements */}
            {nextLevel && (
              <div className="card">
                <h3 style={{ marginBottom: 8 }}>What You Need to Unlock {LEVEL_LABELS[nextLevel]}</h3>
                {readiness.missingRequirements.length > 0 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {readiness.missingRequirements.map((req) => (
                      <div key={req.code} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{req.title}</div>
                        <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 13 }}>{req.detail}</div>
                        <Link href={req.href} className="link" style={{ marginTop: 6, display: "inline-block", fontSize: 13 }}>
                          Resolve now →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 12, background: "#f0fdf4", color: "#166534", borderRadius: 10, fontSize: 14 }}>
                    All current requirements met — contact your chapter lead to request {LEVEL_LABELS[nextLevel]} approval.
                  </div>
                )}
              </div>
            )}

            {highestGranted === "LEVEL_401" && (
              <div className="card" style={{ borderColor: "#16a34a", background: "#f0fdf4" }}>
                <h3 style={{ margin: 0, color: "#166534" }}>You have reached Level 401 — Expert Instructor</h3>
                <p style={{ marginTop: 8, color: "#166534", fontSize: 14 }}>
                  You are authorized to teach all course levels. Thank you for your dedication to YPP.
                </p>
              </div>
            )}

            {/* Phase 2: Specialty Tracks */}
            <div className="card">
              <h3 style={{ marginBottom: 4 }}>My Teaching Specialties</h3>
              <p style={{ marginTop: 0, marginBottom: 16, color: "var(--text-secondary)", fontSize: 14 }}>
                Select the YPP pathways you teach or plan to teach. This helps students and admins find the right instructor.
              </p>
              {!hasPathwaySpecsTable && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#fffbeb",
                    border: "1px solid #fcd34d",
                    color: "#92400e",
                    fontSize: 13,
                  }}
                >
                  Teaching-specialty selections will appear here after the latest pathway database migration is applied.
                </div>
              )}
              {allPathways.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No active pathways configured yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {allPathways.map((pathway) => {
                    const isAssigned = pathway.instructorSpecs.length > 0;
                    return (
                      <div
                        key={pathway.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 16px",
                          borderRadius: 10,
                          border: `1px solid ${isAssigned ? "var(--ypp-purple)" : "var(--border)"}`,
                          background: isAssigned ? "#faf5ff" : "var(--surface)",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{pathway.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          {pathway.interestArea} · {pathway.steps.length} course steps
                        </div>
                      </div>
                      {hasPathwaySpecsTable ? (
                        <form action={toggleInstructorPathwaySpec.bind(null, pathway.id)}>
                          <button
                            type="submit"
                            className={`button small ${isAssigned ? "primary" : "secondary"}`}
                          >
                            {isAssigned ? "Teaching" : "+ Add"}
                          </button>
                        </form>
                      ) : (
                        <span
                          className="pill"
                          style={{ background: "var(--gray-100)", color: "var(--text-secondary)" }}
                        >
                          Unavailable
                        </span>
                      )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Phase 2: My Active Classes */}
            <div className="card">
              <h3 style={{ marginBottom: 4 }}>My Active Classes</h3>
              <p style={{ marginTop: 0, marginBottom: 12, color: "var(--text-secondary)", fontSize: 14 }}>
                Your published offerings and current student enrollment.
              </p>
              {activeOfferings.length === 0 ? (
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No published classes yet.</p>
                  <Link href="/instructor/class-settings" className="button secondary" style={{ marginTop: 8, display: "inline-block", textDecoration: "none", fontSize: 13 }}>
                    Create an Offering
                  </Link>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {activeOfferings.map((offering) => (
                    <Link
                      key={offering.id}
                      href={`/curriculum/${offering.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{offering.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          Started {new Date(offering.startDate).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="pill" style={{ background: "#ede9fe", color: "#5b21b6", whiteSpace: "nowrap" }}>
                        {offering._count.enrollments} enrolled
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {/* Phase 5: Achievements / Milestones */}
            <div className="card">
              <h3 style={{ marginBottom: 4 }}>Instructor Achievements</h3>
              <p style={{ marginTop: 0, marginBottom: 16, color: "var(--text-secondary)", fontSize: 14 }}>
                Earn XP and recognition as you grow through your instructor journey.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {INSTRUCTOR_MILESTONES.map((milestone) => {
                  const earned = earnedMilestoneKeys.has(milestone.key);
                  return (
                    <div
                      key={milestone.key}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1px solid ${earned ? "#16a34a" : "var(--border)"}`,
                        background: earned ? "#f0fdf4" : "var(--surface)",
                        opacity: earned ? 1 : 0.6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div style={{ fontSize: 20 }}>{earned ? "✓" : "○"}</div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 20,
                          background: earned ? "#dcfce7" : "var(--gray-200)",
                          color: earned ? "#166534" : "var(--text-secondary)",
                        }}>
                          +{milestone.xp} XP
                        </span>
                      </div>
                      <div style={{ marginTop: 8, fontWeight: 600, fontSize: 13 }}>{milestone.label}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>{milestone.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
