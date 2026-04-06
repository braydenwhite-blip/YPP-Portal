import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { RoleType } from "@prisma/client";
import KanbanBoard from "./kanban-board";
import InstructorApplicantsClient from "./client";

export default async function AdminInstructorApplicantsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterPresident = roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterPresident) redirect("/");

  // For chapter presidents, scope to their chapter
  let chapterFilter: Record<string, unknown> | undefined;
  if (isChapterPresident && !isAdmin) {
    const currentUser = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { chapterId: true },
    });
    if (currentUser?.chapterId) {
      chapterFilter = { applicant: { chapterId: currentUser.chapterId } };
    }
  }

  // Fetch all applications and reviewers in parallel
  const [applications, reviewerUsers] = await Promise.all([
    prisma.instructorApplication.findMany({
      where: chapterFilter ?? {},
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            chapter: { select: { name: true } },
          },
        },
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: { in: [RoleType.ADMIN, RoleType.CHAPTER_PRESIDENT] },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize dates for client component
  const serialized = applications.map((app) => ({
    ...app,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    interviewScheduledAt: app.interviewScheduledAt?.toISOString() ?? null,
    approvedAt: app.approvedAt?.toISOString() ?? null,
    rejectedAt: app.rejectedAt?.toISOString() ?? null,
    actionDueDate: app.actionDueDate?.toISOString() ?? null,
  }));

  // KPI counts
  const pending = applications.filter((a) =>
    ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(a.status)
  ).length;
  const interviewing = applications.filter((a) =>
    ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(a.status)
  ).length;
  const onHold = applications.filter((a) => a.status === "ON_HOLD").length;
  const accepted = applications.filter((a) => a.status === "APPROVED").length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">{isAdmin ? "Admin" : "Chapter President"}</span>
          <h1 className="page-title">Instructor Applicants</h1>
          <p className="page-subtitle">
            Review, evaluate, and manage instructor applications.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <InstructorApplicantsClient applications={serialized as any} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card kpi">
          <div className="kpi-value">{pending}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{interviewing}</div>
          <div className="kpi-label">In Interview</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{onHold}</div>
          <div className="kpi-label">On Hold</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{accepted}</div>
          <div className="kpi-label">Accepted</div>
        </div>
      </div>

      {/* Kanban board */}
      <KanbanBoard
        applications={serialized as any}
        reviewers={reviewerUsers}
      />
    </div>
  );
}
