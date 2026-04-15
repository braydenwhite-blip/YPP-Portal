import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RoleType } from "@prisma/client";
import CPKanbanBoard from "./kanban-board";
import CPApplicantsClient from "./client";

export default async function AdminCPApplicantsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  // Fetch all applications and reviewers in parallel
  const [applications, reviewerUsers] = await Promise.all([
    prisma.chapterPresidentApplication.findMany({
      include: {
        applicant: { select: { id: true, name: true, email: true, chapter: { select: { name: true } } } },
        chapter: { select: { name: true } },
        reviewer: { select: { name: true } },
        customResponses: { include: { field: { select: { label: true, fieldType: true } } } },
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
    actionDueDate: null,
  }));

  // KPI counts
  const pending = applications.filter((a) =>
    ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(a.status)
  ).length;
  const interviewing = applications.filter((a) =>
    ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "RECOMMENDATION_SUBMITTED"].includes(a.status)
  ).length;
  const thisMonth = applications.filter((a) => {
    if (a.status !== "APPROVED" || !a.approvedAt) return false;
    const now = new Date();
    const d = new Date(a.approvedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Admin</span>
          <h1 className="page-title">Chapter President Applicants</h1>
          <p className="page-subtitle">Review and manage chapter president applications.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <CPApplicantsClient applications={serialized as any} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          The canonical chapter-president hiring flow also runs through{" "}
          <Link href="/chapter/recruiting" className="link">Chapter Recruiting</Link> and{" "}
          <Link href="/applications" className="link">Applications</Link>.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card kpi">
          <div className="kpi-value">{pending}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{interviewing}</div>
          <div className="kpi-label">In Interview Stage</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{thisMonth}</div>
          <div className="kpi-label">Approved This Month</div>
        </div>
      </div>

      {/* Kanban board */}
      <CPKanbanBoard
        applications={serialized as any}
        reviewers={reviewerUsers}
      />
    </div>
  );
}
