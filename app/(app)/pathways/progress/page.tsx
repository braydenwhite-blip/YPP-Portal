import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getStudentProgressSnapshot } from "@/lib/student-progress-actions";
import XpDisplay from "@/components/xp-display";

export default async function PathwayProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const snapshot = await getStudentProgressSnapshot(session.user.id);

  // User XP for display
  const userXpData = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { xp: true, level: true },
  }).catch(() => null);

  // Get user's enrollments with course and pathway information
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          pathwaySteps: {
            include: {
              pathway: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // Group enrollments by pathway
  const pathwayProgress = new Map<string, {
    pathway: any;
    completed: any[];
    inProgress: any[];
    upcoming: any[];
    allSteps: any[];
  }>();

  for (const enrollment of enrollments) {
    const course = enrollment.course;

    // Find all pathways this course belongs to
    for (const step of course.pathwaySteps) {
      const pathwayId = step.pathway.id;

      if (!pathwayProgress.has(pathwayId)) {
        // Get all steps in this pathway
        const allSteps = await prisma.pathwayStep.findMany({
          where: { pathwayId },
          include: { course: true },
          orderBy: { stepOrder: "asc" }
        });

        // Get user's enrollments for this pathway
        const pathwayEnrollments = await prisma.enrollment.findMany({
          where: {
            userId: session.user.id,
            courseId: { in: allSteps.map(s => s.courseId).filter((id): id is string => id !== null) }
          },
          include: { course: true }
        });

        const enrolledCourseIds = new Set(pathwayEnrollments.map(e => e.courseId));
        const completedCourseIds = new Set(
          pathwayEnrollments.filter(e => e.status === "COMPLETED").map(e => e.courseId)
        );

        const completed: any[] = [];
        const inProgress: any[] = [];
        const upcoming: any[] = [];

        for (const pathwayStep of allSteps) {
          const courseId = pathwayStep.courseId;

          if (courseId && completedCourseIds.has(courseId)) {
            completed.push({ ...pathwayStep, enrollment: pathwayEnrollments.find(e => e.courseId === courseId) });
          } else if (courseId && enrolledCourseIds.has(courseId)) {
            inProgress.push({ ...pathwayStep, enrollment: pathwayEnrollments.find(e => e.courseId === courseId) });
          } else {
            upcoming.push(pathwayStep);
          }
        }

        pathwayProgress.set(pathwayId, {
          pathway: step.pathway,
          completed,
          inProgress,
          upcoming,
          allSteps
        });
      }
    }
  }

  const progressArray = Array.from(pathwayProgress.values());

  // Calculate estimated completion dates (simple estimation: 8 weeks per course)
  const weeksPerCourse = 8;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Learning</p>
          <h1 className="page-title">Pathway Progress Dashboard</h1>
        </div>
        <Link href="/pathways" className="button secondary">
          Browse All Pathways
        </Link>
      </div>

      {/* XP Level Widget */}
      {userXpData && (
        <div style={{ marginBottom: 18 }}>
          <XpDisplay xp={userXpData.xp} level={userXpData.level} />
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Unified Progress Snapshot</h3>
        <div className="grid four" style={{ marginTop: 10 }}>
          <div>
            <div className="kpi">{snapshot.activeEnrollments}</div>
            <div className="kpi-label">Active Enrollments</div>
          </div>
          <div>
            <div className="kpi">{snapshot.nextPathwaySteps}</div>
            <div className="kpi-label">Pathway Next Steps</div>
          </div>
          <div>
            <div className="kpi">{snapshot.dueAssignmentsNext7Days}</div>
            <div className="kpi-label">Assignments Due (7d)</div>
          </div>
          <div>
            <div className="kpi">{snapshot.trainingDue}</div>
            <div className="kpi-label">Training Due</div>
          </div>
        </div>
      </div>

      {progressArray.length === 0 ? (
        <div className="card">
          <h3>No Pathway Progress Yet</h3>
          <p>Enroll in courses to start tracking your pathway progress.</p>
          <Link href="/curriculum" className="button primary" style={{ marginTop: 12 }}>
            Browse Courses
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {progressArray.map(({ pathway, completed, inProgress, upcoming, allSteps }) => {
            const totalSteps = allSteps.length;
            const completedCount = completed.length;
            const progressPercent = Math.round((completedCount / totalSteps) * 100);
            const estimatedWeeksRemaining = (totalSteps - completedCount - inProgress.length) * weeksPerCourse;
            const estimatedCompletionDate = new Date();
            estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + (estimatedWeeksRemaining * 7));

            return (
              <div key={pathway.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div>
                    <h2>{pathway.name}</h2>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                      {pathway.description}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="kpi">{progressPercent}%</div>
                    <div className="kpi-label">Complete</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "var(--border)",
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 20
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    backgroundColor: "var(--ypp-purple)",
                    transition: "width 0.3s ease"
                  }} />
                </div>

                {/* Stats */}
                <div className="grid three" style={{ marginBottom: 24 }}>
                  <div>
                    <div className="kpi">{completedCount}</div>
                    <div className="kpi-label">Completed</div>
                  </div>
                  <div>
                    <div className="kpi">{inProgress.length}</div>
                    <div className="kpi-label">In Progress</div>
                  </div>
                  <div>
                    <div className="kpi">{upcoming.length}</div>
                    <div className="kpi-label">Upcoming</div>
                  </div>
                </div>

                {estimatedWeeksRemaining > 0 ? (
                  <div style={{
                    padding: 14,
                    backgroundColor: "var(--ypp-purple-50)",
                    borderRadius: 8,
                    marginBottom: 20,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}>
                    <div>
                      <strong>Certificate in ~{estimatedWeeksRemaining} weeks</strong>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                        Keep your pace — estimated {estimatedCompletionDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 99,
                      background: "var(--green-100, #f0fff4)",
                      color: "var(--green-700, #276749)",
                    }}>
                      On Track ✓
                    </span>
                  </div>
                ) : completedCount === totalSteps ? (
                  <div style={{
                    padding: 14,
                    backgroundColor: "var(--green-50, #f0fff4)",
                    borderRadius: 8,
                    marginBottom: 20,
                    color: "var(--green-700, #276749)",
                    fontWeight: 600,
                  }}>
                    🎓 Pathway Complete! Check your certificate.
                  </div>
                ) : null}

                {/* Timeline */}
                <div className="section-title" style={{ marginTop: 20 }}>Pathway Timeline</div>

                {/* Completed Courses */}
                {completed.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ color: "var(--progress-on-track)", marginBottom: 12 }}>✓ Completed</h4>
                    <div className="timeline">
                      {completed.map((step) => (
                        <div key={step.id} className="timeline-item" style={{ opacity: 0.7 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span className="pill pill-success">
                                {step.course.format === "LEVELED" && step.course.level
                                  ? step.course.level.replace("LEVEL_", "")
                                  : step.course.format.replace("_", " ")}
                              </span>{" "}
                              <strong>{step.course.title}</strong>
                            </div>
                            <span style={{ fontSize: 12, color: "var(--progress-on-track)" }}>
                              ✓ Completed
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* In Progress Courses */}
                {inProgress.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ color: "var(--ypp-purple)", marginBottom: 12 }}>→ In Progress</h4>
                    <div className="timeline">
                      {inProgress.map((step) => (
                        <div key={step.id} className="timeline-item" style={{
                          borderLeft: "3px solid var(--ypp-purple)",
                          backgroundColor: "var(--ypp-purple-50)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span className="pill pill-purple">
                                {step.course.format === "LEVELED" && step.course.level
                                  ? step.course.level.replace("LEVEL_", "")
                                  : step.course.format.replace("_", " ")}
                              </span>{" "}
                              <strong>{step.course.title}</strong>
                            </div>
                            <Link
                              href={`/courses/${step.course.id}`}
                              className="button secondary small"
                            >
                              Continue
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Courses */}
                {upcoming.length > 0 && (
                  <div>
                    <h4 style={{ color: "var(--text-secondary)", marginBottom: 12 }}>↓ Next Steps</h4>
                    <div className="timeline">
                      {upcoming.slice(0, 3).map((step, index) => (
                        <div key={step.id} className="timeline-item" style={{ opacity: 0.6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span className="pill">
                                {step.course.format === "LEVELED" && step.course.level
                                  ? step.course.level.replace("LEVEL_", "")
                                  : step.course.format.replace("_", " ")}
                              </span>{" "}
                              <strong>{step.course.title}</strong>
                              {index === 0 && (
                                <span style={{
                                  marginLeft: 8,
                                  fontSize: 12,
                                  color: "var(--ypp-purple)",
                                  fontWeight: 600
                                }}>
                                  RECOMMENDED NEXT
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/courses/${step.course.id}`}
                              className="button secondary small"
                            >
                              Enroll
                            </Link>
                          </div>
                        </div>
                      ))}
                      {upcoming.length > 3 && (
                        <div style={{
                          padding: 8,
                          textAlign: "center",
                          color: "var(--text-secondary)",
                          fontSize: 14
                        }}>
                          + {upcoming.length - 3} more courses
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
