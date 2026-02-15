import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AnnouncementBanner from "@/components/announcement-banner";
import XpDisplay from "@/components/xp-display";
import PathwayProgressMap from "@/components/pathway-progress-map";
import Link from "next/link";
import { getNextRequiredAction } from "@/lib/instructor-readiness";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        // Explicit select keeps this page working even if the database
        // hasn't been migrated yet (e.g. xp/level columns missing).
        select: {
          id: true,
          name: true,
          primaryRole: true,
          chapterId: true,
          roles: { select: { role: true } },
          chapter: { select: { id: true, name: true } },
        }
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
    ? await prisma.course.findMany({
        where: { leadInstructorId: userId },
        // Keep this select focused so the dashboard stays fast and
        // resilient to schema drift.
        select: {
          id: true,
          title: true,
          format: true,
          level: true,
          updatedAt: true,
          _count: {
            select: {
              enrollments: true,
              attendanceSessions: true,
            },
          },
        }
      })
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
        include: {
          course: {
            select: {
              id: true,
              title: true,
              format: true,
              level: true,
            }
          }
        }
      })
    : [];

  const pathways = isStudent
    ? await prisma.pathway.findMany({
        include: {
          steps: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  format: true,
                  level: true,
                }
              }
            },
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
        select: {
          id: true,
          name: true,
          _count: { select: { users: true, courses: true, events: true } }
        }
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
    // Explicit select keeps this page working even if the database
    // hasn't been migrated yet (e.g. scheduledPublishAt missing).
    select: {
      id: true,
      title: true,
      content: true,
      publishedAt: true,
      author: { select: { name: true } },
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

  const instructorLearnerCount = instructorCourses.reduce(
    (sum, course) => sum + course._count.enrollments,
    0
  );
  const instructorAttendanceCount = instructorCourses.reduce(
    (sum, course) => sum + course._count.attendanceSessions,
    0
  );
  const completeTrainingCount = trainingAssignments.filter(
    (assignment) => assignment.status === "COMPLETE"
  ).length;
  const inProgressTrainingCount = trainingAssignments.filter(
    (assignment) => assignment.status === "IN_PROGRESS"
  ).length;
  const notStartedTrainingCount = trainingAssignments.filter(
    (assignment) => assignment.status === "NOT_STARTED"
  ).length;
  const trainingCompletionRate = trainingAssignments.length
    ? Math.round((completeTrainingCount / trainingAssignments.length) * 100)
    : 0;
  const approvedLevels = Array.from(
    new Set(
      approvals.flatMap((approval) =>
        approval.levels.map((level) => level.level.replace("LEVEL_", ""))
      )
    )
  );
  const mostRecentlyUpdatedClass = [...instructorCourses].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  )[0];
  const instructorNextAction = isInstructor && userId
    ? await getNextRequiredAction(userId)
    : null;

  const instructorPriorityItems: {
    title: string;
    detail: string;
    href: string;
    action: string;
    tone?: "warning" | "success";
  }[] = [];

  if (instructorNextAction) {
    instructorPriorityItems.push({
      title: instructorNextAction.title,
      detail: instructorNextAction.detail,
      href: instructorNextAction.href,
      action: "Open next action",
      tone: instructorNextAction.href === "/instructor-training" ? "warning" : undefined,
    });
  } else if (instructorCourses.length === 0) {
    instructorPriorityItems.push({
      title: "Create your first class offering",
      detail: "Set schedule, capacity, and reminders so students can enroll.",
      href: "/instructor/class-settings",
      action: "Set up class",
      tone: "warning",
    });
  } else {
    instructorPriorityItems.push({
      title: "Instructor dashboard is in good shape",
      detail: "Classes, training, and approvals are all up to date.",
      href: "/instructor/class-settings",
      action: "Review classes",
      tone: "success",
    });
  }

  // Build role-specific quick actions
  const quickActions: { href: string; label: string; description: string; accent: string }[] = [];
  if (isAdmin) {
    quickActions.push(
      { href: "/admin", label: "Admin Panel", description: "Manage users & content", accent: "var(--ypp-purple-600)" },
      { href: "/admin/students", label: "Students", description: "View all students", accent: "var(--ypp-purple-500)" },
      { href: "/admin/instructors", label: "Instructors", description: "View all instructors", accent: "var(--ypp-pink-500)" },
      { href: "/admin/analytics", label: "Analytics", description: "Platform insights", accent: "#3b82f6" },
    );
  } else if (isInstructor) {
    quickActions.push(
      { href: "/instructor/class-settings", label: "My Classes", description: "Manage your classes", accent: "var(--ypp-purple-600)" },
      { href: "/instructor-training", label: "Training", description: "Continue training", accent: "#3b82f6" },
      { href: "/lesson-plans", label: "Lesson Plans", description: "Plan your sessions", accent: "#22c55e" },
      { href: "/goals", label: "Goals", description: "Track your progress", accent: "#f59e0b" },
    );
  } else if (isStudent) {
    quickActions.push(
      { href: "/world", label: "Passion World", description: "Explore your islands", accent: "#0ea5e9" },
      { href: "/my-courses", label: "My Courses", description: "Continue learning", accent: "var(--ypp-purple-600)" },
      { href: "/pathways", label: "Pathways", description: "Explore pathways", accent: "#3b82f6" },
      { href: "/challenges", label: "Challenges", description: "Earn rewards", accent: "#f59e0b" },
    );
  } else {
    quickActions.push(
      { href: "/pathways", label: "Pathways", description: "Browse pathways", accent: "var(--ypp-purple-600)" },
      { href: "/my-courses", label: "Courses", description: "View courses", accent: "#3b82f6" },
      { href: "/goals", label: "Goals", description: "Set your goals", accent: "#22c55e" },
    );
  }

  // Noise control: keep the dashboard focused on the first few high-value items.
  const quickActionsToShow = quickActions.slice(0, 3);
  const eventsToShow = latestEvents.slice(0, 2);
  const studentEnrollmentsToShow = enrollments.slice(0, 4);
  const studentNextStepsToShow = nextSteps.slice(0, 3);
  const instructorCoursesToShow = instructorCourses.slice(0, 4);
  const trainingAssignmentsToShow = trainingAssignments.slice(0, 3);
  const instructorPriorityItemsToShow = instructorPriorityItems.slice(0, 2);
  const mentorshipsToShow = mentorships.slice(0, 4);

  const portalGoals = [
    "One clear next step for every user every week.",
    "One trusted source of truth for training, progress, and readiness.",
    "One connected flow from onboarding to outcomes with less admin overhead.",
  ];

  const passionWorldGoals = [
    "Turn curiosity into action with clear island-based paths.",
    "Make progress visible through challenges, badges, and milestones.",
    "Connect exploration to real classes, projects, and mentorship opportunities.",
  ];

  const roleFocus = isAdmin
    ? [
        "Keep chapter hiring and instructor readiness visible in one operating view.",
        "Ship onboarding workflows with owners, due dates, and blocker tracking.",
      ]
    : isInstructor
      ? [
          "Keep class progress, attendance, and learner momentum visible each week.",
          "Complete training and approvals so you can teach at higher levels.",
        ]
      : isStudent
        ? [
            "Stay on your pathway by completing one concrete step each week.",
            "Use Passion World exploration to pick classes and challenges with purpose.",
          ]
        : isMentor
          ? [
              "Support mentees with regular check-ins and clear next actions.",
              "Use one place to track mentorship momentum and blockers.",
            ]
          : [
              "Use the portal as your home base for goals, classes, and communication.",
              "Keep weekly actions small, consistent, and easy to complete.",
            ];

  return (
    <div>
      {/* Page header */}
      <div className="topbar">
        <div>
          <h1 className="page-title">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
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

      <AnnouncementBanner announcements={announcements} />

      {/* Quick Actions */}
      <div className="dashboard-actions">
        {quickActionsToShow.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="dashboard-action-card"
            style={{ borderTopColor: action.accent }}
          >
            <span className="dashboard-action-label">{action.label}</span>
            <span className="dashboard-action-desc">{action.description}</span>
          </Link>
        ))}
      </div>
      {quickActions.length > quickActionsToShow.length ? (
        <div className="dashboard-actions-footer">
          <Link href={quickActions[0].href} className="link">
            Open full toolset
          </Link>
        </div>
      ) : null}

      {/* XP Display */}
      {userId && !isAdmin && (
        <div style={{ marginTop: 20 }}>
          <XpDisplay xp={userXp} level={userLevel} />
        </div>
      )}

      {/* Admin KPI stats */}
      {isAdmin && globalStats ? (
        <div className="stats-grid" style={{ marginTop: 24 }}>
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
        <div style={{ marginTop: 24 }}>
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
      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Portal Compass</h3>
          <p>Clear goals to keep YPP focused and avoid feature clutter.</p>
          <div className="portal-goal-grid">
            <div className="portal-goal-block">
              <h4>YPP Portal Goals</h4>
              <ul className="portal-goal-list">
                {portalGoals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
            <div className="portal-goal-block">
              <h4>Passion World Goals</h4>
              <ul className="portal-goal-list">
                {passionWorldGoals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="portal-role-focus">
            <span className="portal-role-focus-label">This role should focus on:</span>
            <ul className="portal-goal-list compact">
              {roleFocus.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <h3>Upcoming Events</h3>
          {eventsToShow.length === 0 ? (
            <p className="empty">No events scheduled yet.</p>
          ) : (
            <div className="compact-list">
              {eventsToShow.map((event) => (
                <div key={event.id} className="compact-list-item">
                  <div>
                    <p className="compact-list-title">{event.title}</p>
                    <p className="compact-list-meta">{new Date(event.startDate).toLocaleDateString()}</p>
                  </div>
                  <span className="pill pill-small">{event.eventType}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/calendar" className="link">Open calendar</Link>
          </div>
        </div>
      </div>

      {/* Student section */}
      {isStudent ? (
        <div className="grid two" style={{ marginTop: 20 }}>
          <div className="card">
            <h3>My Enrollments</h3>
            {enrollments.length === 0 ? (
              <p className="empty">No enrollments yet. <Link href="/classes/catalog" className="link">Browse the catalog</Link> to get started.</p>
            ) : (
              <div className="compact-list">
                {studentEnrollmentsToShow.map((enrollment) => (
                  <div key={enrollment.id} className="compact-list-item">
                    <div>
                      <p className="compact-list-title">{enrollment.course.title}</p>
                      <p className="compact-list-meta">{enrollment.status.replace("_", " ")}</p>
                    </div>
                    <span className="pill pill-small pill-purple">
                      {enrollment.course.format === "LEVELED" && enrollment.course.level
                        ? enrollment.course.level.replace("LEVEL_", "")
                        : enrollment.course.format.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <Link href="/my-courses" className="link">View all courses</Link>
            </div>
          </div>
          <div className="card">
            <h3>Recommended Next Steps</h3>
            {nextSteps.length === 0 ? (
              <p className="empty">Enroll in a 101 or one-off class to start your pathway.</p>
            ) : (
              <div className="compact-list">
                {studentNextStepsToShow.map((step, index) => (
                  <div key={`${step.pathwayName}-${index}`} className="compact-list-item align-start">
                    <div>
                      <p className="compact-list-title">{step.pathwayName}</p>
                      <p className="compact-list-meta">{step.course.title}</p>
                    </div>
                    <span className="pill pill-small pill-purple">
                      {step.course.format === "LEVELED" && step.course.level
                        ? step.course.level.replace("LEVEL_", "")
                        : step.course.format.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <Link href="/pathways" className="link">Open pathways</Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Instructor section */}
      {isInstructor ? (
        <div className="instructor-dashboard">
          <div className="instructor-dashboard-header">
            <div>
              <h2 className="instructor-dashboard-title">Instructor Workspace</h2>
              <p className="instructor-dashboard-subtitle">
                A cleaner view of your classes, training, and what to do next.
              </p>
            </div>
            <div className="instructor-dashboard-links">
              <Link href="/instructor/class-settings" className="button small outline">
                Class Settings
              </Link>
              <Link href="/instructor-training" className="button small outline">
                Training
              </Link>
            </div>
          </div>

          <div className="instructor-metric-grid">
            <div className="instructor-metric-card">
              <span className="instructor-metric-label">Classes</span>
              <span className="instructor-metric-value">{instructorCourses.length}</span>
              <span className="instructor-metric-note">active this term</span>
            </div>
            <div className="instructor-metric-card">
              <span className="instructor-metric-label">Learners</span>
              <span className="instructor-metric-value">{instructorLearnerCount}</span>
              <span className="instructor-metric-note">across all classes</span>
            </div>
            <div className="instructor-metric-card">
              <span className="instructor-metric-label">Sessions Logged</span>
              <span className="instructor-metric-value">{instructorAttendanceCount}</span>
              <span className="instructor-metric-note">attendance records</span>
            </div>
            <div className="instructor-metric-card">
              <span className="instructor-metric-label">Training Complete</span>
              <span className="instructor-metric-value">{trainingCompletionRate}%</span>
              <span className="instructor-metric-note">
                {completeTrainingCount}/{trainingAssignments.length || 0} modules
              </span>
            </div>
          </div>

          <div className="grid two" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="instructor-card-head">
                <h3>Class Snapshot</h3>
                <Link href="/instructor/class-settings" className="link">
                  Manage
                </Link>
              </div>
              {instructorCourses.length === 0 ? (
                <p className="empty">No assigned classes yet.</p>
              ) : (
                <div className="instructor-list">
                  {instructorCoursesToShow.map((course) => (
                    <div key={course.id} className="instructor-list-item">
                      <div>
                        <p className="instructor-item-title">{course.title}</p>
                        <p className="instructor-item-meta">
                          {course._count.enrollments} learners • {course._count.attendanceSessions} sessions logged
                        </p>
                      </div>
                      <div className="instructor-item-actions">
                        <span className="pill pill-small pill-purple">
                          {course.format === "LEVELED" && course.level
                            ? course.level.replace("LEVEL_", "")
                            : course.format.replace(/_/g, " ")}
                        </span>
                        <Link href={`/instructor/engagement/${course.id}`} className="link">
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {instructorCourses.length > instructorCoursesToShow.length ? (
                <p className="instructor-footnote">
                  Showing {instructorCoursesToShow.length} of {instructorCourses.length} classes.
                </p>
              ) : null}
              {mostRecentlyUpdatedClass ? (
                <p className="instructor-footnote">
                  Last updated class: <strong>{mostRecentlyUpdatedClass.title}</strong>
                </p>
              ) : null}
            </div>

            <div className="card">
              <div className="instructor-card-head">
                <h3>Training Snapshot</h3>
                <Link href="/instructor-training" className="link">
                  Open
                </Link>
              </div>
              {trainingAssignments.length === 0 ? (
                <p className="empty">No training modules assigned yet.</p>
              ) : (
                <>
                  <div className="instructor-progress-head">
                    <span>
                      {completeTrainingCount} complete • {inProgressTrainingCount} in progress • {notStartedTrainingCount} not started
                    </span>
                    <strong>{trainingCompletionRate}%</strong>
                  </div>
                  <div className="instructor-progress-track" aria-hidden="true">
                    <div
                      className="instructor-progress-fill"
                      style={{ width: `${trainingCompletionRate}%` }}
                    />
                  </div>
                  <div className="instructor-list" style={{ marginTop: 12 }}>
                    {trainingAssignmentsToShow.map((assignment) => (
                      <div key={assignment.id} className="instructor-list-item">
                        <div>
                          <p className="instructor-item-title">{assignment.module.title}</p>
                          <p className="instructor-item-meta">
                            {assignment.module.type.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span
                          className={`pill pill-small ${
                            assignment.status === "COMPLETE"
                              ? "pill-success"
                              : assignment.status === "IN_PROGRESS"
                                ? "pill-pathway"
                                : "pill-info"
                          }`}
                        >
                          {assignment.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {trainingAssignments.length > trainingAssignmentsToShow.length ? (
                <p className="instructor-footnote">
                  Showing {trainingAssignmentsToShow.length} of {trainingAssignments.length} modules.
                </p>
              ) : null}
              <div className="instructor-approved">
                <span className="instructor-approved-label">Approved levels</span>
                {approvedLevels.length ? (
                  <div className="instructor-approved-levels">
                    {approvedLevels.map((level) => (
                      <span key={level} className="pill pill-small pill-success">
                        {level}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="instructor-footnote">No levels approved yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="instructor-card-head">
              <h3>Next Best Steps</h3>
            </div>
            <div className="instructor-priority-list">
              {instructorPriorityItemsToShow.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className={`instructor-priority-item ${
                    item.tone === "warning"
                      ? "is-warning"
                      : item.tone === "success"
                        ? "is-success"
                        : ""
                  }`}
                >
                  <div>
                    <p className="instructor-item-title">{item.title}</p>
                    <p className="instructor-item-meta">{item.detail}</p>
                  </div>
                  <Link href={item.href} className="link">
                    {item.action}
                  </Link>
                </div>
              ))}
            </div>
            {instructorPriorityItems.length > instructorPriorityItemsToShow.length ? (
              <p className="instructor-footnote">
                Additional actions are available in Instructor tools.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Mentor section */}
      {isMentor ? (
        <div style={{ marginTop: 20 }}>
          <div className="card">
            <h3>My Mentees</h3>
            {mentorships.length === 0 ? (
              <p className="empty">No mentees assigned yet.</p>
            ) : (
              <div className="compact-list">
                {mentorshipsToShow.map((pairing) => (
                  <div key={pairing.id} className="compact-list-item">
                    <p className="compact-list-title">{pairing.mentee.name}</p>
                    <span className="pill pill-small pill-pathway">{pairing.type}</span>
                  </div>
                ))}
              </div>
            )}
            {mentorships.length > mentorshipsToShow.length ? (
              <p className="instructor-footnote">
                Showing {mentorshipsToShow.length} of {mentorships.length} mentees.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Chapter Lead section */}
      {isChapterLead && chapter ? (
        <div style={{ marginTop: 20 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{chapter.name}</h3>
              <Link href="/chapter-lead/dashboard" className="button small outline" style={{ marginTop: 0 }}>
                Full Dashboard
              </Link>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{chapter._count.users}</span>
                <span className="stat-label">Members</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{chapter._count.courses}</span>
                <span className="stat-label">Classes</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{chapter._count.events}</span>
                <span className="stat-label">Events</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
