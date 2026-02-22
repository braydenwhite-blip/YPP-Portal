import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PathwayActionButtons } from "../pathway-actions-client";
import { StepEnrollButton } from "./step-enroll-client";

function formatCourseLabel(format: string, level: string | null) {
  if (format === "LEVELED" && level) return level.replace("LEVEL_", "");
  return format.replace(/_/g, " ");
}

export default async function PathwayDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    include: {
      steps: {
        include: { course: true },
        orderBy: { stepOrder: "asc" },
      },
    },
  });

  if (!pathway) notFound();

  const stepCourseIds = pathway.steps.map((s) => s.courseId);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: stepCourseIds } },
    select: { courseId: true, status: true },
  });
  const enrollmentMap = new Map(enrollments.map((e) => [e.courseId, e.status]));

  const completedCount = pathway.steps.filter((s) => enrollmentMap.get(s.courseId) === "COMPLETED").length;
  const enrolledCount = enrollments.length;
  const totalCount = pathway.steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isEnrolled = enrolledCount > 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  // Enrolled student count
  const enrolledStudentsCount = await prisma.enrollment.groupBy({
    by: ["userId"],
    where: { courseId: { in: stepCourseIds } },
    _count: true,
  }).then((r) => r.length);

  // Certificate for this user
  const certificate = isComplete
    ? await prisma.certificate.findFirst({ where: { recipientId: userId, pathwayId: pathway.id } })
    : null;

  // Upcoming events
  const events = await prisma.pathwayEvent.findMany({
    where: { pathwayId: pathway.id, eventDate: { gte: new Date() } },
    orderBy: { eventDate: "asc" },
    take: 3,
  }).catch(() => [] as any[]);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/pathways" style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
            ← All Pathways
          </Link>
          <p className="badge" style={{ marginTop: 6 }}>{pathway.interestArea}</p>
          <h1 className="page-title">{pathway.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/pathways/${pathway.id}/leaderboard`} className="button outline small">
            Leaderboard
          </Link>
          <Link href={`/pathways/${pathway.id}/mentors`} className="button outline small">
            Find Mentors
          </Link>
          {isComplete && (
            <Link href={`/pathways/${pathway.id}/share`} className="button outline small">
              Share Progress
            </Link>
          )}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <p style={{ color: "var(--gray-600)", marginBottom: 16 }}>{pathway.description}</p>
          <div className="grid two">
            <div>
              <div className="kpi">{totalCount}</div>
              <div className="kpi-label">Steps</div>
            </div>
            <div>
              <div className="kpi">{enrolledStudentsCount}</div>
              <div className="kpi-label">Enrolled Students</div>
            </div>
          </div>
        </div>

        {/* Progress / CTA */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {isEnrolled ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--gray-600)" }}>
                <span>{completedCount} / {totalCount} steps complete</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ height: 10, background: "var(--gray-200, #e2e8f0)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressPercent}%`, background: "var(--ypp-purple)", borderRadius: 5 }} />
              </div>
              {isComplete ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="onboarding-callout" style={{ background: "var(--green-50, #f0fff4)", color: "var(--green-700, #276749)" }}>
                    You&apos;ve completed this pathway!
                  </div>
                  {certificate ? (
                    <Link href={`/pathways/${pathway.id}/certificate`} className="button">
                      View Certificate
                    </Link>
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--gray-500)" }}>Your certificate is being prepared.</p>
                  )}
                </div>
              ) : (
                <StepEnrollButton pathwayId={pathway.id} label="Enroll in Next Step" />
              )}
              <PathwayActionButtons
                pathwayId={pathway.id}
                isEnrolled={true}
                progressPercent={progressPercent}
              />
            </>
          ) : (
            <>
              <p style={{ color: "var(--gray-600)", fontSize: 14 }}>
                Join this pathway to start your structured journey through {totalCount} courses.
              </p>
              <PathwayActionButtons pathwayId={pathway.id} isEnrolled={false} progressPercent={0} />
            </>
          )}
        </div>
      </div>

      {/* Step list */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-title">Pathway Steps</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pathway.steps.map((step, idx) => {
            const status = enrollmentMap.get(step.courseId);
            const isStepCompleted = status === "COMPLETED";
            const isStepEnrolled = !!status && !isStepCompleted;
            const prevStep = idx > 0 ? pathway.steps[idx - 1] : null;
            const prevCompleted = prevStep ? enrollmentMap.get(prevStep.courseId) === "COMPLETED" : true;
            const isLocked = !isStepCompleted && !isStepEnrolled && !prevCompleted;

            return (
              <div
                key={step.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: isLocked ? 0.55 : 1,
                  borderLeft: `4px solid ${isStepCompleted ? "var(--green-500, #48bb78)" : isStepEnrolled ? "var(--ypp-purple)" : "var(--gray-300, #e2e8f0)"}`,
                  padding: "12px 16px",
                }}
              >
                {/* Step number / status icon */}
                <div style={{ minWidth: 32, textAlign: "center" }}>
                  {isStepCompleted ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green-500, #48bb78)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isLocked ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : (
                    <span style={{ fontWeight: 700, color: isStepEnrolled ? "var(--ypp-purple)" : "var(--gray-400)", fontSize: 16 }}>
                      {step.stepOrder}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{step.course.title}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span className="pill" style={{ fontSize: 12 }}>
                      {formatCourseLabel(step.course.format, step.course.level)}
                    </span>
                    {isStepCompleted && (
                      <span className="pill" style={{ fontSize: 12, background: "var(--green-100, #f0fff4)", color: "var(--green-700, #276749)" }}>
                        Completed
                      </span>
                    )}
                    {isStepEnrolled && (
                      <span className="pill" style={{ fontSize: 12, background: "var(--purple-100, #faf5ff)", color: "var(--ypp-purple)" }}>
                        In Progress
                      </span>
                    )}
                    {isLocked && (
                      <span className="pill" style={{ fontSize: 12, color: "var(--gray-500)" }}>
                        Complete step {step.stepOrder - 1} to unlock
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events */}
      {events.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="section-title">Upcoming Events</div>
            <Link href={`/pathways/${pathway.id}/events`} style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
              View all →
            </Link>
          </div>
          <div className="grid two">
            {events.map((event) => (
              <div key={event.id} className="card">
                <strong>{event.title}</strong>
                {event.eventDate && (
                  <p style={{ fontSize: 13, color: "var(--gray-500)", margin: "4px 0 0" }}>
                    {new Date(event.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                )}
                {event.requiredStepOrder && (
                  <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>
                    Requires completing Step {event.requiredStepOrder}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation links */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href={`/pathways/${pathway.id}/leaderboard`} className="button outline small">
          Leaderboard
        </Link>
        <Link href={`/pathways/${pathway.id}/mentors`} className="button outline small">
          Find Mentors
        </Link>
        <Link href={`/pathways/${pathway.id}/journal`} className="button outline small">
          My Reflections
        </Link>
        <Link href={`/pathways/${pathway.id}/events`} className="button outline small">
          Events
        </Link>
        {isComplete && (
          <Link href={`/pathways/${pathway.id}/share`} className="button outline small">
            Share Progress Card
          </Link>
        )}
      </div>
    </div>
  );
}
