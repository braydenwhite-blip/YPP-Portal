import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstructorReadiness } from "@/lib/instructor-readiness";

type RolloutTask = {
  phase: string;
  owner: string;
  dueDate: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
  blocker?: string;
};

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

function buildGlobalFallbackTasks({
  chapterLeads,
  readyInstructors,
  activeEnrollments,
  submissionsLast7Days,
}: {
  chapterLeads: number;
  readyInstructors: number;
  activeEnrollments: number;
  submissionsLast7Days: number;
}): RolloutTask[] {
  return [
    {
      phase: "Leadership Timeline Lock",
      owner: "Leadership Team",
      dueDate: "2026-02-19",
      status: chapterLeads > 0 ? "IN_PROGRESS" : "BLOCKED",
      blocker: chapterLeads > 0 ? undefined : "No chapter leads assigned yet.",
    },
    {
      phase: "Instructor Pilot Ready",
      owner: "Ian + Chapter Leads",
      dueDate: "2026-03-13",
      status: readyInstructors >= 6 ? "IN_PROGRESS" : "BLOCKED",
      blocker:
        readyInstructors >= 6
          ? undefined
          : "Need at least 6 publish-ready instructors.",
    },
    {
      phase: "Student Rollout Ready",
      owner: "Program Ops",
      dueDate: "2026-03-25",
      status:
        activeEnrollments > 0 && submissionsLast7Days > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED",
      blocker:
        activeEnrollments > 0
          ? undefined
          : "No active enrollments in the merged curriculum flow.",
    },
    {
      phase: "Full Launch",
      owner: "Leadership Team",
      dueDate: "2026-03-30",
      status: "NOT_STARTED",
    },
  ];
}

export default async function AdminPortalRolloutPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!session?.user?.id || !roles.includes("ADMIN")) {
    redirect("/");
  }

  const [instructors, activeEnrollments, submissionsLast7Days, chapterLeads] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: "INSTRUCTOR" } } },
      select: { id: true },
    }),
    prisma.classEnrollment.count({ where: { status: "ENROLLED" } }),
    prisma.classAssignmentSubmission.count({
      where: {
        submittedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.user.count({ where: { roles: { some: { role: "CHAPTER_LEAD" } } } }),
  ]);

  const readinessResults = await Promise.all(
    instructors.map(async (instructor) => getInstructorReadiness(instructor.id))
  );

  const readyInstructors = readinessResults.filter((r) => r.canPublishFirstOffering).length;
  const fallbackTasks = buildGlobalFallbackTasks({
    chapterLeads,
    readyInstructors,
    activeEnrollments,
    submissionsLast7Days,
  });

  let tasks: RolloutTask[] = fallbackTasks;
  try {
    let storedTasks = await prisma.launchTask.findMany({
      where: {
        scope: "GLOBAL",
        isActive: true,
        chapterId: null,
      },
      orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    });

    if (storedTasks.length === 0) {
      await prisma.launchTask.createMany({
        data: fallbackTasks.map((task, index) => ({
          title: task.phase,
          ownerLabel: task.owner,
          dueDate: new Date(task.dueDate),
          status: task.status,
          blocker: task.blocker ?? null,
          scope: "GLOBAL",
          chapterId: null,
          sortOrder: index,
          createdById: session.user.id,
          updatedById: session.user.id,
          isActive: true,
        })),
      });

      storedTasks = await prisma.launchTask.findMany({
        where: {
          scope: "GLOBAL",
          isActive: true,
          chapterId: null,
        },
        orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      });
    }

    tasks = storedTasks.map((task) => ({
      phase: task.title,
      owner: task.ownerLabel,
      dueDate: task.dueDate ? task.dueDate.toISOString() : "",
      status: task.status,
      blocker: task.blocker ?? undefined,
    }));
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Portal Rollout Command Center</h1>
          <p className="page-subtitle">Timeline, ownership, blockers, and readiness in one place.</p>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{instructors.length}</div>
          <div className="kpi-label">Total Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{readyInstructors}</div>
          <div className="kpi-label">Publish-Ready Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{activeEnrollments}</div>
          <div className="kpi-label">Active Student Enrollments</div>
        </div>
        <div className="card">
          <div className="kpi">{submissionsLast7Days}</div>
          <div className="kpi-label">Student Submissions (7d)</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Rollout Timeline Board</h3>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {tasks.map((task) => (
            <div key={task.phase} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{task.phase}</strong>
                <span className="pill">
                  {task.status.replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                Owner: {task.owner} | Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "TBD"}
              </div>
              {task.blocker ? (
                <div style={{ marginTop: 8, fontSize: 13, color: "#b45309" }}>Blocker: {task.blocker}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Quick Links</h3>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/instructor-readiness" className="button secondary">Instructor Readiness</Link>
          <Link href="/admin/bulk-users" className="button secondary">Bulk Users (Ian)</Link>
          <Link href="/curriculum" className="button secondary">Curriculum Catalog</Link>
          <Link href="/admin/announcements" className="button secondary">Announcements</Link>
        </div>
      </div>
    </div>
  );
}
