import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstructorReadiness } from "@/lib/instructor-readiness";

const tabs = ["curricula", "lesson-plans", "offerings", "readiness"] as const;
type WorkspaceTab = (typeof tabs)[number];

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

  const [templates, lessonPlans, offerings, readiness] = await Promise.all([
    prisma.classTemplate.findMany({
      where: { createdById: session.user.id },
      include: {
        _count: { select: { offerings: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
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
    prisma.classOffering.findMany({
      where: { instructorId: session.user.id },
      include: {
        template: true,
        _count: {
          select: {
            enrollments: { where: { status: "ENROLLED" } },
          },
        },
      },
      orderBy: { startDate: "desc" },
    }),
    getInstructorReadiness(session.user.id),
  ]);

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
            {candidate.replace("-", " ")}
          </Link>
        ))}
      </div>

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
                        {template.description.slice(0, 120)}
                        {template.description.length > 120 ? "..." : ""}
                      </p>
                    </div>
                    <span className={`pill ${template.isPublished ? "primary" : ""}`}>
                      {template.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="pill">{difficultyLabel(template.difficultyLevel)}</span>
                    <span className="pill">{template.interestArea}</span>
                    <span className="pill">{template.durationWeeks} weeks</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                    Weekly plan rows: {weeklyPlanRows} | Published offerings: {template._count.offerings}
                  </div>
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
            offerings.map((offering) => (
              <Link
                key={offering.id}
                href={`/curriculum/${offering.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>{offering.title}</h3>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{offering.template.title}</p>
                  </div>
                  <span className="pill">{offering.status.replace("_", " ")}</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                  {new Date(offering.startDate).toLocaleDateString()} - {new Date(offering.endDate).toLocaleDateString()}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                  {offering._count.enrollments} enrolled | {offering.meetingDays.join(", ")} | {offering.meetingTime}
                </div>
              </Link>
            ))
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
    </div>
  );
}
