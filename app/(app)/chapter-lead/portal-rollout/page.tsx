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

function buildChapterFallbackTasks({
  readyInstructors,
  activeEnrollments,
}: {
  readyInstructors: number;
  activeEnrollments: number;
}): RolloutTask[] {
  return [
    {
      phase: "Chapter Leadership Alignment",
      owner: "Chapter Lead",
      dueDate: "2026-02-20",
      status: "IN_PROGRESS",
    },
    {
      phase: "Instructor Pilot Readiness",
      owner: "Chapter Lead + Instructors",
      dueDate: "2026-03-13",
      status: readyInstructors >= 3 ? "IN_PROGRESS" : "BLOCKED",
      blocker:
        readyInstructors >= 3
          ? undefined
          : "Need at least 3 publish-ready instructors in chapter.",
    },
    {
      phase: "Student Activation",
      owner: "Chapter Team",
      dueDate: "2026-03-25",
      status: activeEnrollments > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      blocker:
        activeEnrollments > 0
          ? undefined
          : "No active student enrollments in chapter offerings.",
    },
    {
      phase: "Session Launch",
      owner: "Chapter Team",
      dueDate: "2026-03-30",
      status: "NOT_STARTED",
    },
  ];
}

export default async function ChapterLeadPortalRolloutPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!session?.user?.id || (!roles.includes("CHAPTER_LEAD") && !roles.includes("ADMIN"))) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      chapterId: true,
      chapter: { select: { name: true } },
    },
  });

  if (!user?.chapterId) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Chapter Lead</p>
            <h1 className="page-title">Chapter Rollout Command Center</h1>
          </div>
        </div>
        <div className="card">
          <p className="empty">No chapter assigned to this account.</p>
        </div>
      </div>
    );
  }

  const [instructors, activeEnrollments, submissionsLast7Days] = await Promise.all([
    prisma.user.findMany({
      where: {
        chapterId: user.chapterId,
        roles: { some: { role: "INSTRUCTOR" } },
      },
      select: { id: true },
    }),
    prisma.classEnrollment.count({
      where: {
        status: "ENROLLED",
        offering: { chapterId: user.chapterId },
      },
    }),
    prisma.classAssignmentSubmission.count({
      where: {
        submittedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        assignment: {
          offering: {
            chapterId: user.chapterId,
          },
        },
      },
    }),
  ]);

  const readinessResults = await Promise.all(
    instructors.map(async (instructor) => getInstructorReadiness(instructor.id))
  );

  const readyInstructors = readinessResults.filter((r) => r.canPublishFirstOffering).length;

  const fallbackTasks = buildChapterFallbackTasks({
    readyInstructors,
    activeEnrollments,
  });

  let tasks: RolloutTask[] = fallbackTasks;
  try {
    let storedTasks = await prisma.launchTask.findMany({
      where: {
        scope: "CHAPTER",
        chapterId: user.chapterId,
        isActive: true,
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
          scope: "CHAPTER",
          chapterId: user.chapterId,
          sortOrder: index,
          createdById: session.user.id,
          updatedById: session.user.id,
          isActive: true,
        })),
      });

      storedTasks = await prisma.launchTask.findMany({
        where: {
          scope: "CHAPTER",
          chapterId: user.chapterId,
          isActive: true,
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
          <p className="badge">Chapter Lead</p>
          <h1 className="page-title">Chapter Rollout Command Center</h1>
          <p className="page-subtitle">{user.chapter?.name}</p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{instructors.length}</div>
          <div className="kpi-label">Chapter Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{readyInstructors}</div>
          <div className="kpi-label">Publish-Ready Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{activeEnrollments}</div>
          <div className="kpi-label">Active Student Enrollments</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Timeline Board</h3>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {tasks.map((task) => (
            <div key={task.phase} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{task.phase}</strong>
                <span className="pill">{task.status.replace(/_/g, " ")}</span>
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
        <h3 style={{ marginTop: 0 }}>Chapter Rollout Signals</h3>
        <div style={{ marginTop: 10, fontSize: 14, color: "var(--text-secondary)" }}>
          Student submissions in last 7 days: <strong>{submissionsLast7Days}</strong>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/chapter-lead/instructor-readiness" className="button secondary">Instructor Readiness</Link>
          <Link href="/chapter/recruiting" className="button secondary">Chapter Recruiting</Link>
          <Link href="/curriculum" className="button secondary">Curriculum Catalog</Link>
        </div>
      </div>
    </div>
  );
}
