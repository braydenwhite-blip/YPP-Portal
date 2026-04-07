import { redirect } from "next/navigation";
import { RoleType } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import PageHelp from "@/components/page-help";
import InstructorApplicantsClient from "./client";
import InstructorKanbanBoard from "./kanban-board";

export default async function AdminInstructorApplicantsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterPresident = roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterPresident) {
    redirect("/");
  }

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

  const serialized = applications.map((app) => ({
    ...app,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    interviewScheduledAt: app.interviewScheduledAt?.toISOString() ?? null,
    approvedAt: app.approvedAt?.toISOString() ?? null,
    rejectedAt: app.rejectedAt?.toISOString() ?? null,
    actionDueDate: app.actionDueDate?.toISOString() ?? null,
  }));

  const pending = applications.filter((application) =>
    ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(application.status)
  ).length;
  const interviewing = applications.filter((application) =>
    ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(application.status)
  ).length;
  const onHold = applications.filter((application) => application.status === "ON_HOLD").length;
  const accepted = applications.filter((application) => application.status === "APPROVED").length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">{isAdmin ? "Admin" : "Chapter President"}</span>
          <h1 className="page-title">Instructor Applicants</h1>
          <p className="page-subtitle">
            Review candidates in a stage-based board with action dates, reviewer ownership, and clearer decision details.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <InstructorApplicantsClient applications={serialized as any} />
        </div>
      </div>

      <PageHelp
        purpose="This page is the shared hiring board for instructor applications from first review through final decision."
        firstStep="Open the oldest cards first, check the deadline to action, and confirm the assigned reviewer before changing status."
        nextStep="When a card moves stages, the shared workflow routing updates so the next owner sees it in their queue."
      />

      <div className="grid four" style={{ marginTop: 20, marginBottom: 20 }}>
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

      <InstructorKanbanBoard applications={serialized as any} reviewers={reviewerUsers} />
    </div>
  );
}
