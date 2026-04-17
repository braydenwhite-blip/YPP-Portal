import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstructorApplicationStatus } from "@prisma/client";
import InstructorApplicantsClient from "./client";

function statusColor(status: InstructorApplicationStatus): string {
  if (status === "APPROVED") return "#16a34a";
  if (status === "REJECTED") return "#dc2626";
  if (status === "INFO_REQUESTED") return "#d97706";
  if (status === "INTERVIEW_SCHEDULED" || status === "INTERVIEW_COMPLETED") return "#2563eb";
  return "#1d4ed8";
}

function statusLabel(status: InstructorApplicationStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "UNDER_REVIEW":
      return "Under Review";
    case "INFO_REQUESTED":
      return "Info Requested";
    case "ON_HOLD":
      return "On Hold";
    case "INTERVIEW_SCHEDULED":
      return "Interview Scheduled";
    case "INTERVIEW_COMPLETED":
      return "Interview Completed";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const BOARD_COLUMNS: Array<{
  id: string;
  title: string;
  subtitle: string;
  statuses: InstructorApplicationStatus[];
}> = [
  {
    id: "submitted",
    title: "Submitted",
    subtitle: "Fresh applications waiting for the first review pass.",
    statuses: ["SUBMITTED"],
  },
  {
    id: "review",
    title: "Review",
    subtitle: "Applications being scored or waiting on more information.",
    statuses: ["UNDER_REVIEW", "INFO_REQUESTED", "ON_HOLD"],
  },
  {
    id: "interview",
    title: "Interview",
    subtitle: "Applications in the interview stage and ready for a decision.",
    statuses: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"],
  },
  {
    id: "closed",
    title: "Closed",
    subtitle: "Applications with a final decision already recorded.",
    statuses: ["APPROVED", "REJECTED"],
  },
];

function actionDeadline(app: {
  status: InstructorApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
  interviewScheduledAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
}) {
  if (app.status === "SUBMITTED") {
    return new Date(app.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
  }
  if (app.status === "UNDER_REVIEW" || app.status === "INFO_REQUESTED") {
    return new Date(app.updatedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
  }
  if (app.status === "INTERVIEW_SCHEDULED" && app.interviewScheduledAt) {
    return app.interviewScheduledAt;
  }
  if (app.status === "INTERVIEW_COMPLETED") {
    return new Date(app.updatedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
  }
  return app.approvedAt ?? app.rejectedAt ?? app.updatedAt;
}

export default async function AdminInstructorApplicantsPage({
  searchParams,
}: {
  searchParams: { status?: string; grad?: string; state?: string; search?: string };
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const filterStatus = searchParams.status as InstructorApplicationStatus | undefined;
  const filterGrad = searchParams.grad ? parseInt(searchParams.grad, 10) : undefined;
  const filterState = searchParams.state;
  const filterSearch = searchParams.search;

  const where: Record<string, unknown> = {};
  if (filterStatus && Object.values(InstructorApplicationStatus).includes(filterStatus)) {
    where.status = filterStatus;
  }
  if (filterGrad && !isNaN(filterGrad)) where.graduationYear = filterGrad;
  if (filterState) where.stateProvince = { contains: filterState, mode: "insensitive" };
  if (filterSearch) {
    where.OR = [
      { legalName: { contains: filterSearch, mode: "insensitive" } },
      { applicant: { name: { contains: filterSearch, mode: "insensitive" } } },
      { applicant: { email: { contains: filterSearch, mode: "insensitive" } } },
      { schoolName: { contains: filterSearch, mode: "insensitive" } },
      { city: { contains: filterSearch, mode: "insensitive" } },
    ];
  }

  const applications = await prisma.instructorApplication.findMany({
    where,
    include: {
      applicant: {
        select: { id: true, name: true, email: true, chapter: { select: { name: true } } },
      },
      reviewer: { select: { name: true } },
      applicationReviews: {
        where: { isLeadReview: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
        select: {
          overallRating: true,
          nextStep: true,
          updatedAt: true,
        },
      },
      interviewReviews: {
        where: { isLeadReview: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
        select: {
          overallRating: true,
          recommendation: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const draftOwners = new Set(
    (
      await prisma.curriculumDraft.findMany({
        where: { authorId: { in: applications.map((application) => application.applicantId) } },
        select: { authorId: true },
        distinct: ["authorId"],
      })
    ).map((draft) => draft.authorId)
  );

  const allApplications = await prisma.instructorApplication.findMany({
    select: { status: true, approvedAt: true },
  });

  const pending = allApplications.filter((application) =>
    ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "ON_HOLD"].includes(application.status)
  );
  const interviewing = allApplications.filter((application) =>
    ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(application.status)
  );
  const thisMonth = allApplications.filter((application) => {
    if (application.status !== "APPROVED" || !application.approvedAt) return false;
    const now = new Date();
    const approvedAt = new Date(application.approvedAt);
    return approvedAt.getMonth() === now.getMonth() && approvedAt.getFullYear() === now.getFullYear();
  });

  const gradYears = await prisma.instructorApplication.findMany({
    where: { graduationYear: { not: null } },
    select: { graduationYear: true },
    distinct: ["graduationYear"],
    orderBy: { graduationYear: "asc" },
  });
  const boardColumns = BOARD_COLUMNS.map((column) => ({
    ...column,
    applications: applications.filter((application) => column.statuses.includes(application.status)),
  }));

  type Application = (typeof applications)[number];

  function renderApplicationCard(app: Application) {
    const deadline = actionDeadline(app);
    const reviewerName = app.reviewer?.name ?? "Unassigned";
    const leadApplicationReview = app.applicationReviews[0] ?? null;
    const leadInterviewReview = app.interviewReviews[0] ?? null;
    const hasDraft = draftOwners.has(app.applicantId);
    const workspaceHref =
      app.status === "INTERVIEW_SCHEDULED" ||
      app.status === "INTERVIEW_COMPLETED" ||
      app.status === "ON_HOLD" ||
      app.status === "APPROVED" ||
      app.status === "REJECTED"
        ? `/applications/instructor/${app.id}/interview`
        : `/applications/instructor/${app.id}`;
    const history = [
      app.infoRequest
        ? { label: "Info request", body: app.infoRequest, date: app.updatedAt }
        : null,
      app.applicantResponse
        ? { label: "Applicant response", body: app.applicantResponse, date: app.updatedAt }
        : null,
      app.reviewerNotes
        ? { label: "Reviewer notes", body: app.reviewerNotes, date: app.updatedAt }
        : null,
    ].filter((entry): entry is { label: string; body: string; date: Date } => entry !== null);

    return (
      <details
        key={app.id}
        className="card"
        style={{ padding: 0, overflow: "hidden" }}
      >
        <summary
          style={{
            cursor: "pointer",
            listStyle: "none",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>
                {app.legalName || app.applicant.name}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{app.applicant.email}</p>
            </div>
            <span className="badge" style={{ background: statusColor(app.status), color: "white" }}>
              {statusLabel(app.status)}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {app.applicant.chapter ? <span className="pill pill-small">{app.applicant.chapter.name}</span> : null}
            {app.graduationYear ? (
              <span className="pill pill-small pill-info">Class of {app.graduationYear}</span>
            ) : null}
            <span className="pill pill-small pill-purple">Reviewer: {reviewerName}</span>
            {hasDraft ? (
              <span className="pill pill-small pill-success">Draft ready</span>
            ) : (
              <span className="pill pill-small pill-pending">Draft missing</span>
            )}
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            <div>Deadline to action: {formatDate(deadline)}</div>
            <div>Applied: {formatDate(app.createdAt)}</div>
            {leadApplicationReview?.overallRating ? (
              <div>Application review: {leadApplicationReview.overallRating.replace(/_/g, " ")}</div>
            ) : null}
            {leadInterviewReview?.recommendation ? (
              <div>Interview recommendation: {leadInterviewReview.recommendation.replace(/_/g, " ")}</div>
            ) : null}
          </div>
        </summary>

        <div style={{ borderTop: "1px solid var(--border)", padding: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <Link href={workspaceHref} className="button secondary" style={{ textDecoration: "none" }}>
              {app.status === "INTERVIEW_SCHEDULED" ||
              app.status === "INTERVIEW_COMPLETED" ||
              app.status === "ON_HOLD" ||
              app.status === "APPROVED" ||
              app.status === "REJECTED"
                ? "Open Interview Workspace"
                : "Open Application Review"}
            </Link>
            <Link
              href={`/applications/instructor/${app.id}`}
              className="button small outline"
              style={{ textDecoration: "none" }}
            >
              Full Review Page
            </Link>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, fontSize: 13 }}>
            {(app.city || app.stateProvince) ? (
              <span>Location: {[app.city, app.stateProvince, app.country].filter(Boolean).join(", ")}</span>
            ) : null}
            {app.schoolName ? <span>School: {app.schoolName}</span> : null}
            {app.gpa ? <span>GPA: {app.gpa}</span> : null}
            {app.classRank ? <span>Class rank: {app.classRank}</span> : null}
            {app.hoursPerWeek ? <span>Availability: {app.hoursPerWeek}h/week</span> : null}
            {app.phoneNumber ? <span>Phone: {app.phoneNumber}</span> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Motivation to teach</p>
              <p style={{ whiteSpace: "pre-wrap", color: "var(--text)" }}>{app.motivation}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Teaching experience</p>
              <p style={{ whiteSpace: "pre-wrap", color: "var(--text)" }}>{app.teachingExperience}</p>
            </div>
            {app.whyYPP ? (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Why YPP</p>
                <p style={{ whiteSpace: "pre-wrap", color: "var(--text)" }}>{app.whyYPP}</p>
              </div>
            ) : null}
            {app.subjectsOfInterest ? (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Subjects of interest</p>
                <p style={{ color: "var(--text)" }}>{app.subjectsOfInterest}</p>
              </div>
            ) : null}
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Comment History</h3>
            {history.length === 0 ? (
              <p>No comments yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {history.map((entry) => (
                  <div
                    key={`${app.id}-${entry.label}`}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                      background: "var(--surface-alt)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                      {entry.label} · {formatDate(entry.date)}
                    </p>
                    <p style={{ margin: 0, color: "var(--text)" }}>{entry.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!["APPROVED", "REJECTED"].includes(app.status) ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface-alt)",
                padding: 14,
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--muted)" }}>
                This queue is now for triage and fast scanning. Open the structured workspace to review categories, inspect the Lesson Design Studio draft, and submit the official next step.
              </p>
              <Link href={workspaceHref} className="button secondary" style={{ textDecoration: "none" }}>
                Continue in Workspace
              </Link>
            </div>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Admin</span>
          <h1 className="page-title">Instructor Applicants</h1>
          <p className="page-subtitle">
            Review candidates in a stage-based board with action dates, reviewer ownership, and full notes.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <InstructorApplicantsClient applications={applications} />
        </div>
      </div>

      <div className="grid three" style={{ marginTop: 20, marginBottom: 24 }}>
        <div className="card kpi">
          <div className="kpi-value">{pending.length}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{interviewing.length}</div>
          <div className="kpi-label">In Interview Stage</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{thisMonth.length}</div>
          <div className="kpi-label">Approved This Month</div>
        </div>
      </div>

      <form method="GET" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>SEARCH</label>
          <input
            className="input"
            name="search"
            defaultValue={filterSearch}
            placeholder="Name, email, school, city..."
            style={{ width: 200, marginBottom: 0 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>STATUS</label>
          <select className="input" name="status" defaultValue={filterStatus ?? ""} style={{ marginBottom: 0 }}>
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="INFO_REQUESTED">Info Requested</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
            <option value="INTERVIEW_COMPLETED">Interview Completed</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>GRAD YEAR</label>
          <select className="input" name="grad" defaultValue={filterGrad ?? ""} style={{ marginBottom: 0 }}>
            <option value="">All years</option>
            {gradYears.map((g) => (
              <option key={g.graduationYear} value={g.graduationYear!}>
                {g.graduationYear}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>STATE/PROVINCE</label>
          <input
            className="input"
            name="state"
            defaultValue={filterState}
            placeholder="e.g. Texas"
            style={{ width: 130, marginBottom: 0 }}
          />
        </div>
        <button className="button secondary" type="submit" style={{ fontSize: 13 }}>
          Filter
        </button>
        <Link href="/admin/instructor-applicants" className="button secondary" style={{ fontSize: 13 }}>
          Clear
        </Link>
      </form>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        Showing <strong>{applications.length}</strong> application{applications.length !== 1 ? "s" : ""}
      </p>

      {applications.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>
            No instructor applications match your filters.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(280px, 1fr))",
            gap: 16,
            alignItems: "start",
            overflowX: "auto",
            paddingBottom: 8,
          }}
        >
          {boardColumns.map((column) => (
            <div
              key={column.id}
              style={{
                minWidth: 280,
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{column.title}</h2>
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{column.subtitle}</p>
                <div style={{ marginTop: 8 }}>
                  <span className="badge">{column.applications.length}</span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {column.applications.length === 0 ? (
                  <div className="card" style={{ padding: 16 }}>
                    <p>No applications in this stage.</p>
                  </div>
                ) : (
                  column.applications.map((application) => renderApplicationCard(application))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
