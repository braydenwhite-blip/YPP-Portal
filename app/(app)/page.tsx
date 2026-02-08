import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AnnouncementBanner from "@/components/announcement-banner";
import XpDisplay from "@/components/xp-display";
import PathwayProgressMap from "@/components/pathway-progress-map";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true, chapter: true }
      })
    : null;

  const roles = user?.roles.map((role) => role.role) ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("STAFF");
  const isInstructor = roles.includes("INSTRUCTOR");
  const isStudent = roles.includes("STUDENT");
  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");

  // Fetch XP data (may not have columns yet)
  let userXp = 0;
  let userLevel = 1;
  try {
    if (userId) {
      const xpData = await prisma.user.findUnique({
        where: { id: userId },
        select: { xp: true, level: true },
      });
      if (xpData) {
        userXp = xpData.xp;
        userLevel = xpData.level;
      }
    }
  } catch {
    // XP columns may not exist yet
  }

  const globalStats = isAdmin
    ? await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { primaryRole: "INSTRUCTOR" } }),
        prisma.user.count({ where: { primaryRole: "STUDENT" } }),
        prisma.pathway.count(),
        prisma.course.count(),
        prisma.enrollment.count(),
        prisma.mentorship.count()
      ])
    : null;

  const latestEvents = await prisma.event.findMany({
    orderBy: { startDate: "asc" },
    take: 3
  });

  const instructorCourses = isInstructor && userId
    ? await prisma.course.findMany({ where: { leadInstructorId: userId } })
    : [];

  const trainingAssignments = isInstructor && userId
    ? await prisma.trainingAssignment.findMany({
        where: { userId },
        include: { module: true },
        orderBy: { createdAt: "asc" }
      })
    : [];

  const approvals = isInstructor && userId
    ? await prisma.instructorApproval.findMany({
        where: { instructorId: userId },
        include: { levels: true }
      })
    : [];

  const enrollments = isStudent && userId
    ? await prisma.enrollment.findMany({
        where: { userId },
        include: { course: true }
      })
    : [];

  const pathways = isStudent
    ? await prisma.pathway.findMany({
        include: {
          steps: {
            include: { course: true },
            orderBy: { stepOrder: "asc" }
          }
        }
      })
    : [];

  const mentorships = isMentor && userId
    ? await prisma.mentorship.findMany({
        where: { mentorId: userId },
        include: { mentee: true }
      })
    : [];

  const chapter = isChapterLead && user?.chapterId
    ? await prisma.chapter.findUnique({
        where: { id: user.chapterId },
        include: { users: true, courses: true, events: true }
      })
    : null;

  // Fetch announcements for the user's roles and chapter
  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ],
      AND: [
        {
          OR: [
            { chapterId: null },
            { chapterId: user?.chapterId ?? undefined }
          ]
        },
        {
          OR: roles.length > 0
            ? roles.map((role) => ({
                targetRoles: { has: role as any }
              }))
            : [{ targetRoles: { isEmpty: false } }]
        }
      ]
    },
    include: {
      author: { select: { name: true } }
    },
    orderBy: { publishedAt: "desc" },
    take: 5
  });

  const enrolledCourseIds = new Set(
    enrollments.map((enrollment) => enrollment.courseId)
  );
  const nextSteps = pathways
    .map((pathway) => {
      const nextStep = pathway.steps.find((step) => !enrolledCourseIds.has(step.courseId));
      if (!nextStep) return null;
      return { pathwayName: pathway.name, course: nextStep.course };
    })
    .filter(Boolean) as { pathwayName: string; course: { title: string; format: string; level: string | null } }[];

  return (
    <div>
      {/* Page header */}
      <div className="topbar">
        <div>
          <p className="badge">Dashboard</p>
          <h1 className="page-title mt-4">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? "Here\u2019s an overview of your organization."
              : "Your personalized dashboard with everything you need."}
          </p>
        </div>
        <div className="badge" style={{ background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
          {roles.length ? roles.join(" \u00B7 ") : "Portal User"}
        </div>
      </div>

      {/* XP Display */}
      {userId && !isAdmin && (
        <div className="mt-16">
          <XpDisplay xp={userXp} level={userLevel} />
        </div>
      )}

      <AnnouncementBanner announcements={announcements} />

      {/* Admin KPI stats */}
      {isAdmin && globalStats ? (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{globalStats[3]}</span>
            <span className="stat-label">Active Pathways</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{globalStats[4]}</span>
            <span className="stat-label">Classes & Labs</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{globalStats[1]}</span>
            <span className="stat-label">Instructors</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{globalStats[2]}</span>
            <span className="stat-label">Students</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{globalStats[5]}</span>
            <span className="stat-label">Enrollments</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{globalStats[6]}</span>
            <span className="stat-label">Mentorships</span>
          </div>
        </div>
      ) : null}

      {/* Pathway Progress Map for students */}
      {isStudent && (
        <div className="mt-24">
          <PathwayProgressMap
            pathways={pathways.filter((p) =>
              p.steps.some((s) => enrolledCourseIds.has(s.courseId))
            ).map((p) => ({
              id: p.id,
              name: p.name,
              interestArea: p.interestArea,
              steps: p.steps.map((s) => ({
                id: s.id,
                courseId: s.courseId,
                courseTitle: s.course.title,
                courseLevel: s.course.level,
                courseFormat: s.course.format,
                stepOrder: s.stepOrder,
              })),
              completedCourseIds: new Set(
                enrollments.filter((e) => e.status === "COMPLETED").map((e) => e.courseId)
              ),
              enrolledCourseIds: enrolledCourseIds,
            }))}
          />
        </div>
      )}

      {/* Main content grid */}
      <div className="grid two mt-24">
        {isAdmin && globalStats ? (
          <div className="card">
            <div className="section-title">Pathways Pulse</div>
            <div>
              <p>
                <strong>{globalStats[0]}</strong> total users across <strong>{globalStats[3]}</strong> pathways
                with <strong>{globalStats[5]}</strong> active enrollments.
              </p>
            </div>
            <div className="timeline mt-16">
              <div className="timeline-item">
                Launch Instructor Training v1 with workshop, scenario practice, and curriculum review.
              </div>
              <div className="timeline-item">
                Finalize mentorship check-ins and awards for instructors and students.
              </div>
              <div className="timeline-item">
                Build sequenced Pathway Maps (101 &rarr; 201 &rarr; 301 &rarr; Labs &rarr; Commons).
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="section-title">Quick Start</div>
            <p>
              Your dashboard shows exactly where you are in Pathways and what comes next. Use the
              navigation to explore curriculum, mentorship, and training.
            </p>
            <div className="onboarding-quicklinks mt-16" style={{ gap: 8 }}>
              <a href="/pathways" className="onboarding-quicklink" style={{ padding: "10px 14px" }}>
                <div><strong>Browse Pathways</strong></div>
              </a>
              <a href="/my-courses" className="onboarding-quicklink" style={{ padding: "10px 14px" }}>
                <div><strong>My Courses</strong></div>
              </a>
              <a href="/goals" className="onboarding-quicklink" style={{ padding: "10px 14px" }}>
                <div><strong>Set Goals</strong></div>
              </a>
            </div>
          </div>
        )}
        <div className="card">
          <div className="section-title">Upcoming Events</div>
          {latestEvents.length === 0 ? (
            <p className="empty">No events scheduled yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {latestEvents.map((event) => (
                  <tr key={event.id}>
                    <td style={{ fontWeight: 500, color: "var(--text)" }}>{event.title}</td>
                    <td><span className="pill pill-small">{event.eventType}</span></td>
                    <td>{new Date(event.startDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Student section */}
      {isStudent ? (
        <div className="mt-32">
          <div className="section-title">Student View</div>
          <div className="grid two">
            <div className="card">
              <h3>My Enrollments</h3>
              {enrollments.length === 0 ? (
                <p className="empty">No enrollments yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Format</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enrollment) => (
                      <tr key={enrollment.id}>
                        <td style={{ fontWeight: 500, color: "var(--text)" }}>{enrollment.course.title}</td>
                        <td>
                          <span className="pill pill-small pill-purple">
                            {enrollment.course.format === "LEVELED" && enrollment.course.level
                              ? enrollment.course.level.replace("LEVEL_", "")
                              : enrollment.course.format.replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          <span className={`pill pill-small ${enrollment.status === "ENROLLED" ? "pill-success" : ""}`}>
                            {enrollment.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <h3>Recommended Next Steps</h3>
              {nextSteps.length === 0 ? (
                <p className="empty">Enroll in a 101 or one-off class to start your pathway.</p>
              ) : (
                <div className="timeline">
                  {nextSteps.map((step, index) => (
                    <div key={`${step.pathwayName}-${index}`} className="timeline-item">
                      <strong>{step.pathwayName}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
                        {step.course.title} &middot;{" "}
                        <span className="pill pill-small pill-purple">
                          {step.course.format === "LEVELED" && step.course.level
                            ? step.course.level.replace("LEVEL_", "")
                            : step.course.format.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Instructor section */}
      {isInstructor ? (
        <div className="mt-32">
          <div className="section-title">Instructor View</div>
          <div className="grid two">
            <div className="card">
              <h3>My Classes</h3>
              {instructorCourses.length === 0 ? (
                <p className="empty">No assigned classes yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Format</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructorCourses.map((course) => (
                      <tr key={course.id}>
                        <td style={{ fontWeight: 500, color: "var(--text)" }}>{course.title}</td>
                        <td>
                          <span className="pill pill-small pill-purple">
                            {course.format === "LEVELED" && course.level
                              ? course.level.replace("LEVEL_", "")
                              : course.format.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <h3>Training Progress</h3>
              {trainingAssignments.length === 0 ? (
                <p className="empty">No training modules assigned yet.</p>
              ) : (
                <div className="timeline">
                  {trainingAssignments.map((assignment) => (
                    <div key={assignment.id} className="timeline-item">
                      <strong>{assignment.module.title}</strong>
                      <div style={{ marginTop: 4 }}>
                        <span className={`pill pill-small ${assignment.status === "COMPLETE" ? "pill-success" : assignment.status === "IN_PROGRESS" ? "pill-pathway" : ""}`}>
                          {assignment.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {approvals.length ? (
                <p style={{ marginTop: 16, fontSize: 14 }}>
                  Approved levels:{" "}
                  {approvals[0].levels.map((level) => (
                    <span key={level.level} className="pill pill-small pill-success" style={{ marginRight: 4 }}>
                      {level.level.replace("LEVEL_", "")}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Mentor section */}
      {isMentor ? (
        <div className="mt-32">
          <div className="section-title">Mentor View</div>
          <div className="card">
            <h3>My Mentees</h3>
            {mentorships.length === 0 ? (
              <p className="empty">No mentees assigned yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Mentee</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {mentorships.map((pairing) => (
                    <tr key={pairing.id}>
                      <td style={{ fontWeight: 500, color: "var(--text)" }}>{pairing.mentee.name}</td>
                      <td><span className="pill pill-small pill-pathway">{pairing.type}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {/* Chapter Lead section */}
      {isChapterLead && chapter ? (
        <div className="mt-32">
          <div className="section-title">Chapter Lead View</div>
          <div className="card">
            <h3>{chapter.name}</h3>
            <div className="stats-grid mt-16">
              <div className="stat-card">
                <span className="stat-value">{chapter.users.length}</span>
                <span className="stat-label">Members</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{chapter.courses.length}</span>
                <span className="stat-label">Classes</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{chapter.events.length}</span>
                <span className="stat-label">Events</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
