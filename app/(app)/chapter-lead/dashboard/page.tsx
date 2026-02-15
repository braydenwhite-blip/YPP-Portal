import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ChapterLeadDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("CHAPTER_LEAD") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  // Get chapter associated with the current user (via User.chapterId)
  const chapter = await prisma.chapter.findFirst({
    where: {
      users: { some: { id: session.user.id } }
    },
    include: {
      users: {
        include: {
          roles: { select: { role: true } },
        },
      },
      courses: {
        include: {
          _count: { select: { enrollments: true } },
          leadInstructor: true
        }
      },
      events: {
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: 'asc' },
        take: 5
      }
    }
  });

  if (!chapter) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Chapter Lead</p>
            <h1 className="page-title">My Chapter Dashboard</h1>
          </div>
        </div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>
            No chapter assigned. Contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  const students = chapter.users.filter((user) =>
    user.roles.some((role) => role.role === "STUDENT")
  );
  const instructors = chapter.users.filter((user) =>
    user.roles.some((role) => role.role === "INSTRUCTOR")
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chapter Lead</p>
          <h1 className="page-title">{chapter.name} Dashboard</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Welcome, Chapter Lead!</h3>
        <p>Manage your chapter's activities, track metrics, and support your community.</p>
      </div>

      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{students.length}</div>
          <div className="kpi-label">Students</div>
        </div>
        <div className="card">
          <div className="kpi">{instructors.length}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{chapter.courses.length}</div>
          <div className="kpi-label">Active Courses</div>
        </div>
        <div className="card">
          <div className="kpi">{chapter.events.length}</div>
          <div className="kpi-label">Upcoming Events</div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Active Courses</div>
        <div style={{ marginBottom: 10 }}>
          <a href="/chapter-lead/instructor-readiness" className="button small outline">
            Open Instructor Readiness
          </a>
        </div>
        {chapter.courses.map(course => (
            <div key={course.id} className="card" style={{ marginBottom: 12 }}>
            <h4>{course.title}</h4>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Instructor: {course.leadInstructor?.name || "Unassigned"} • {course._count.enrollments} students
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
