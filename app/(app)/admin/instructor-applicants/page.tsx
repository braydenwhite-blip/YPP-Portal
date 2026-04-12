import { redirect } from "next/navigation";
import { RoleType } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
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

  const newApplications = applications.filter((application) => application.status === "SUBMITTED").length;
  const toReview = applications.filter((application) =>
    ["UNDER_REVIEW", "INFO_REQUESTED", "ON_HOLD"].includes(application.status)
  ).length;
  const toInterview = applications.filter((application) => application.status === "INTERVIEW_SCHEDULED").length;
  const interviewedAwaitingDecision = applications.filter((application) =>
    ["INTERVIEW_COMPLETED", "APPROVED", "REJECTED"].includes(application.status)
  ).length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">{isAdmin ? "Admin" : "Chapter President"}</span>
          <h1 className="page-title">Instructor Applicants</h1>
          <p className="page-subtitle">
            Review candidates on a four-step board: New Applications, To Review, Curriculum Overview (scheduled session), then Overview Done / Awaiting Decision. Treat the overview as a collaborative walkthrough of their teaching approach — not a scored interview.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <InstructorApplicantsClient applications={serialized as any} />
        </div>
      </div>

      <div className="grid four" style={{ marginTop: 20, marginBottom: 20 }}>
        <div className="card kpi">
          <div className="kpi-value">{newApplications}</div>
          <div className="kpi-label">New Applications</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{toReview}</div>
          <div className="kpi-label">To Review</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{toInterview}</div>
          <div className="kpi-label">Curriculum overview</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{interviewedAwaitingDecision}</div>
          <div className="kpi-label">Overview done / decision</div>
        </div>
      </div>

      <InstructorKanbanBoard applications={serialized as any} reviewers={reviewerUsers} />
    </div>
  );
}
