import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PathwayActionButtons } from "./pathway-actions-client";

function formatCourseLabel(format: string, level: string | null) {
  if (format === "LEVELED" && level) return level.replace("LEVEL_", "");
  return format.replace(/_/g, " ");
}

export default async function PathwaysPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Load all active pathways with steps
  const allPathways = await prisma.pathway.findMany({
    where: { isActive: true },
    include: {
      steps: {
        include: { course: true },
        orderBy: { stepOrder: "asc" },
      },
      _count: { select: { certificates: true } },
    },
    orderBy: { name: "asc" },
  });

  // Load user enrollments across all pathway courses
  const allCourseIds = allPathways.flatMap((p) => p.steps.map((s) => s.courseId));
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: allCourseIds } },
    select: { courseId: true, status: true },
  });
  const enrollmentMap = new Map(enrollments.map((e) => [e.courseId, e.status]));

  // Compute per-pathway metrics
  type PathwaySummary = {
    pathway: typeof allPathways[0];
    isEnrolled: boolean;
    completedCount: number;
    totalCount: number;
    progressPercent: number;
    nextStep: typeof allPathways[0]["steps"][0] | null;
  };

  const summaries: PathwaySummary[] = allPathways.map((pathway) => {
    const steps = pathway.steps;
    const completedCount = steps.filter((s) => enrollmentMap.get(s.courseId) === "COMPLETED").length;
    const enrolledCount = steps.filter((s) => enrollmentMap.has(s.courseId)).length;
    const isEnrolled = enrolledCount > 0;
    const totalCount = steps.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const nextStep = steps.find((s) => enrollmentMap.get(s.courseId) !== "COMPLETED" && enrollmentMap.has(s.courseId)) ?? null;

    return { pathway, isEnrolled, completedCount, totalCount, progressPercent, nextStep };
  });

  const enrolledSummaries = summaries.filter((s) => s.isEnrolled);
  const availableSummaries = summaries.filter((s) => !s.isEnrolled);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">YPP Pathways</p>
          <h1 className="page-title">Pathways</h1>
        </div>
        <Link href="/pathways/progress" className="button outline small">
          My Progress
        </Link>
      </div>

      {/* Info cards */}
      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>What are Pathways?</h3>
          <p>
            Pathways guide you from foundational courses (101) through mastery (301+), connecting
            curriculum, mentorship, and real-world projects in one clear progression.
          </p>
          <div className="timeline" style={{ marginTop: 12 }}>
            <div className="timeline-item"><strong>Curriculum:</strong> leveled 101/201/301, Passion Labs, and the Commons.</div>
            <div className="timeline-item"><strong>Mentorship:</strong> monthly and quarterly check-ins to keep you on track.</div>
            <div className="timeline-item"><strong>Events:</strong> showcases, festivals, and competition prep along the way.</div>
          </div>
        </div>
        <div className="card">
          <h3>Your Progress at a Glance</h3>
          <div className="grid two" style={{ marginTop: 8 }}>
            <div>
              <div className="kpi">{enrolledSummaries.length}</div>
              <div className="kpi-label">Active Pathways</div>
            </div>
            <div>
              <div className="kpi">{enrolledSummaries.filter((s) => s.progressPercent === 100).length}</div>
              <div className="kpi-label">Completed</div>
            </div>
            <div>
              <div className="kpi">{enrolledSummaries.reduce((sum, s) => sum + s.completedCount, 0)}</div>
              <div className="kpi-label">Courses Done</div>
            </div>
            <div>
              <div className="kpi">{availableSummaries.length}</div>
              <div className="kpi-label">Available to Join</div>
            </div>
          </div>
        </div>
      </div>

      {/* My Pathways */}
      {enrolledSummaries.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">My Pathways</div>
          <div className="grid two">
            {enrolledSummaries.map(({ pathway, completedCount, totalCount, progressPercent, nextStep }) => (
              <div key={pathway.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ marginBottom: 2 }}>
                        <Link href={`/pathways/${pathway.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                          {pathway.name}
                        </Link>
                      </h3>
                      <span className="pill">{pathway.interestArea}</span>
                    </div>
                    {progressPercent === 100 && (
                      <span className="pill" style={{ background: "var(--green-100, #f0fff4)", color: "var(--green-700, #276749)" }}>
                        Complete
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "8px 0 0", color: "var(--gray-600)", fontSize: 14 }}>{pathway.description}</p>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-600)", marginBottom: 4 }}>
                    <span>{completedCount} / {totalCount} steps complete</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div style={{ height: 8, background: "var(--gray-200, #e2e8f0)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progressPercent}%`, background: "var(--ypp-purple)", borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                </div>

                {/* Step pills */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {pathway.steps.map((step) => {
                    const status = enrollmentMap.get(step.courseId);
                    return (
                      <span
                        key={step.id}
                        className="pill"
                        style={{
                          background: status === "COMPLETED" ? "var(--green-100, #f0fff4)" : status ? "var(--purple-100, #faf5ff)" : "var(--gray-100, #f7fafc)",
                          color: status === "COMPLETED" ? "var(--green-700, #276749)" : status ? "var(--ypp-purple)" : "var(--gray-500)",
                          fontSize: 12,
                        }}
                      >
                        {formatCourseLabel(step.course.format, step.course.level)}
                      </span>
                    );
                  })}
                </div>

                <PathwayActionButtons
                  pathwayId={pathway.id}
                  isEnrolled={true}
                  progressPercent={progressPercent}
                  nextStepHref={nextStep ? `/pathways/${pathway.id}` : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Pathways */}
      <div>
        <div className="section-title">{enrolledSummaries.length > 0 ? "More Pathways" : "Available Pathways"}</div>
        {availableSummaries.length === 0 ? (
          <div className="card">
            <p>You&apos;ve joined all available pathways.</p>
          </div>
        ) : (
          <div className="grid two">
            {availableSummaries.map(({ pathway }) => (
              <div key={pathway.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <h3 style={{ marginBottom: 2 }}>
                    <Link href={`/pathways/${pathway.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {pathway.name}
                    </Link>
                  </h3>
                  <span className="pill">{pathway.interestArea}</span>
                  <p style={{ margin: "8px 0 0", color: "var(--gray-600)", fontSize: 14 }}>{pathway.description}</p>
                </div>

                {/* Step preview */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  {pathway.steps.map((step, idx) => (
                    <span key={step.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {idx > 0 && <span style={{ color: "var(--gray-400)", fontSize: 12 }}>→</span>}
                      <span className="pill" style={{ fontSize: 12 }}>
                        {formatCourseLabel(step.course.format, step.course.level)}
                      </span>
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <PathwayActionButtons
                    pathwayId={pathway.id}
                    isEnrolled={false}
                    progressPercent={0}
                  />
                  <Link href={`/pathways/${pathway.id}`} style={{ fontSize: 13, color: "var(--gray-500)" }}>
                    View details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
