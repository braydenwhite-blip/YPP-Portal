import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AnnouncementBanner from "@/components/announcement-banner";

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
    enrollments
      .filter((enrollment) => enrollment.status === "ENROLLED")
      .map((enrollment) => enrollment.courseId)
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
      <div className="topbar">
        <div>
          <p className="badge">Role-Based Dashboard</p>
          <h1 className="page-title">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
        </div>
        <div className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
          {roles.length ? roles.join(" · ") : "Portal User"}
        </div>
      </div>

      <AnnouncementBanner announcements={announcements} />

      {isAdmin && globalStats ? (
        <div className="grid three">
          <div className="card">
            <div className="kpi">{globalStats[3]}</div>
            <div className="kpi-label">Active Pathways</div>
          </div>
          <div className="card">
            <div className="kpi">{globalStats[4]}</div>
            <div className="kpi-label">Classes & Labs</div>
          </div>
          <div className="card">
            <div className="kpi">{globalStats[1]}</div>
            <div className="kpi-label">Instructors</div>
          </div>
        </div>
      ) : null}

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="section-title">Pathways Pulse</div>
          {isAdmin && globalStats ? (
            <>
              <p>
                Students: <strong>{globalStats[2]}</strong> | Total Users: <strong>{globalStats[0]}</strong>
              </p>
              <p style={{ marginTop: 8 }}>
                Active enrollments: <strong>{globalStats[5]}</strong> | Mentorship pairings:{" "}
                <strong>{globalStats[6]}</strong>
              </p>
            </>
          ) : (
            <p>
              Your dashboard shows exactly where you are in Pathways and what comes next. Use the side
              navigation to explore curriculum, mentorship, and training.
            </p>
          )}
          <div className="timeline" style={{ marginTop: 16 }}>
            <div className="timeline-item">
              Launch Instructor Training v1 with workshop, scenario practice, and curriculum review.
            </div>
            <div className="timeline-item">
              Finalize mentorship check-ins and awards for instructors and students.
            </div>
            <div className="timeline-item">
              Build sequenced Pathway Maps (101 → 201 → 301 → Labs → Commons).
            </div>
          </div>
        </div>
        <div className="card">
          <div className="section-title">Upcoming Events</div>
          {latestEvents.length === 0 ? (
            <p>No events scheduled yet.</p>
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
                    <td>{event.title}</td>
                    <td>{event.eventType}</td>
                    <td>{new Date(event.startDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isStudent ? (
        <div style={{ marginTop: 28 }}>
          <div className="section-title">Student View</div>
          <div className="grid two">
            <div className="card">
              <h3>My Enrollments</h3>
              {enrollments.length === 0 ? (
                <p>No enrollments yet.</p>
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
                        <td>{enrollment.course.title}</td>
                        <td>
                          {enrollment.course.format === "LEVELED" && enrollment.course.level
                            ? enrollment.course.level.replace("LEVEL_", "")
                            : enrollment.course.format.replace("_", " ")}
                        </td>
                        <td>{enrollment.status.replace("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <h3>Recommended Next Steps</h3>
              {nextSteps.length === 0 ? (
                <p>Enroll in a 101 or one-off class to start your pathway.</p>
              ) : (
                <div className="timeline">
                  {nextSteps.map((step, index) => (
                    <div key={`${step.pathwayName}-${index}`} className="timeline-item">
                      <strong>{step.pathwayName}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        {step.course.title} ·{" "}
                        {step.course.format === "LEVELED" && step.course.level
                          ? step.course.level.replace("LEVEL_", "")
                          : step.course.format.replace("_", " ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isInstructor ? (
        <div style={{ marginTop: 28 }}>
          <div className="section-title">Instructor View</div>
          <div className="grid two">
            <div className="card">
              <h3>My Classes</h3>
              {instructorCourses.length === 0 ? (
                <p>No assigned classes yet.</p>
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
                        <td>{course.title}</td>
                        <td>
                          {course.format === "LEVELED" && course.level
                            ? course.level.replace("LEVEL_", "")
                            : course.format.replace("_", " ")}
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
                <p>No training modules assigned yet.</p>
              ) : (
                <div className="timeline">
                  {trainingAssignments.map((assignment) => (
                    <div key={assignment.id} className="timeline-item">
                      <strong>{assignment.module.title}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        Status: {assignment.status.replace("_", " ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {approvals.length ? (
                <p style={{ marginTop: 16 }}>
                  Approved levels: {approvals[0].levels.map((level) => level.level.replace("LEVEL_", "")).join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isMentor ? (
        <div style={{ marginTop: 28 }}>
          <div className="section-title">Mentor View</div>
          <div className="card">
            <h3>My Mentees</h3>
            {mentorships.length === 0 ? (
              <p>No mentees assigned yet.</p>
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
                      <td>{pairing.mentee.name}</td>
                      <td>{pairing.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {isChapterLead && chapter ? (
        <div style={{ marginTop: 28 }}>
          <div className="section-title">Chapter Lead View</div>
          <div className="card">
            <h3>{chapter.name}</h3>
            <p style={{ color: "var(--muted)" }}>
              Members: {chapter.users.length} · Classes: {chapter.courses.length} · Events: {chapter.events.length}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
