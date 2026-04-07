import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewInstructorApplicationAction } from "@/lib/instructor-application-actions";
import { saveApplicationScores } from "@/lib/export-actions";
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
    statuses: ["UNDER_REVIEW", "INFO_REQUESTED"],
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

function compositeScore(app: {
  scoreAcademic: number | null;
  scoreCommunication: number | null;
  scoreLeadership: number | null;
  scoreMotivation: number | null;
  scoreFit: number | null;
}): number | null {
  const scores = [
    app.scoreAcademic,
    app.scoreCommunication,
    app.scoreLeadership,
    app.scoreMotivation,
    app.scoreFit,
  ];
  const valid = scores.filter((score): score is number => score != null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, score) => sum + score, 0) / valid.length;
}

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

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: "var(--muted)", width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: score != null && n <= score ? "#2563eb" : "var(--surface-hover)",
              border: "1px solid var(--border)",
            }}
          />
        ))}
        <div
          title="Not Enough Info"
          style={{
            width: 18,
            height: 10,
            borderRadius: 2,
            background: score == null ? "#cbd5e1" : "#e2e8f0",
            border: "1px solid #cbd5e1",
          }}
        />
      </div>
      {score != null ? (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{score}/5</span>
      ) : (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Not Enough Info</span>
      )}
    </div>
  );
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
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const allApplications = await prisma.instructorApplication.findMany({
    select: { status: true, approvedAt: true },
  });

  const pending = allApplications.filter((application) =>
    ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(application.status)
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

  const saveScoresAction = saveApplicationScores.bind(null, { status: "idle", message: "" });
  const boardColumns = BOARD_COLUMNS.map((column) => ({
    ...column,
    applications: applications.filter((application) => column.statuses.includes(application.status)),
  }));

  type Application = (typeof applications)[number];

  function renderApplicationCard(app: Application) {
    const score = compositeScore(app);
    const deadline = actionDeadline(app);
    const reviewerName = app.reviewer?.name ?? "Unassigned";
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
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            <div>Deadline to action: {formatDate(deadline)}</div>
            <div>Applied: {formatDate(app.createdAt)}</div>
            {score != null ? <div>Current score: {score.toFixed(1)}/5</div> : null}
          </div>
        </summary>

        <div style={{ borderTop: "1px solid var(--border)", padding: 16 }}>
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
            <h3 style={{ marginTop: 0 }}>Reviewer Ratings</h3>
            <div style={{ marginBottom: 10 }}>
              <ScoreBar score={app.scoreAcademic} label="Academic Standing" />
              <ScoreBar score={app.scoreCommunication} label="Communication" />
              <ScoreBar score={app.scoreLeadership} label="Leadership" />
              <ScoreBar score={app.scoreMotivation} label="Motivation" />
              <ScoreBar score={app.scoreFit} label="Cultural Fit" />
            </div>
            <form action={saveScoresAction}>
              <input type="hidden" name="applicationId" value={app.id} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                {(["scoreAcademic", "scoreCommunication", "scoreLeadership", "scoreMotivation", "scoreFit"] as const).map((key) => {
                  const labels: Record<typeof key, string> = {
                    scoreAcademic: "Academic Standing (1-5)",
                    scoreCommunication: "Communication Clarity (1-5)",
                    scoreLeadership: "Leadership Potential (1-5)",
                    scoreMotivation: "Teaching Motivation (1-5)",
                    scoreFit: "Cultural Fit / Commitment (1-5)",
                  };

                  return (
                    <label key={key} className="form-label" style={{ marginTop: 0, fontSize: 12 }}>
                      {labels[key]}
                      <select
                        className="input"
                        name={key}
                        defaultValue={app[key] ?? ""}
                        style={{ marginBottom: 0, fontSize: 13 }}
                      >
                        <option value="">Not enough info</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
              <label className="form-label" style={{ fontSize: 12, marginTop: 0 }}>
                Reviewer Notes
                <textarea
                  className="input"
                  name="reviewerNotes"
                  defaultValue={app.reviewerNotes ?? ""}
                  rows={2}
                  placeholder="Internal notes about this applicant..."
                  style={{ marginBottom: 4 }}
                />
              </label>
              <button className="button secondary" type="submit" style={{ fontSize: 12 }}>
                Save Scores and Notes
              </button>
            </form>
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
            <div style={{ display: "grid", gap: 12 }}>
              {app.status === "SUBMITTED" ? (
                <form action={reviewInstructorApplicationAction}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="action" value="mark_under_review" />
                  <button className="button secondary" type="submit" style={{ fontSize: 13 }}>
                    Mark as Under Review
                  </button>
                </form>
              ) : null}

              <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Request More Info</summary>
                <form action={reviewInstructorApplicationAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="action" value="request_info" />
                  <textarea className="input" name="message" required rows={3} placeholder="What additional information do you need?" style={{ marginBottom: 8 }} />
                  <button className="button secondary" type="submit" style={{ fontSize: 13 }}>
                    Send Request
                  </button>
                </form>
              </details>

              <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Schedule Interview</summary>
                <form action={reviewInstructorApplicationAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="action" value="schedule_interview" />
                  <label className="form-label" style={{ marginTop: 0 }}>
                    Interview Date and Time
                    <input className="input" type="datetime-local" name="scheduledAt" required />
                  </label>
                  <label className="form-label">
                    Notes
                    <input className="input" name="notes" placeholder="Zoom link, agenda, or reminder..." />
                  </label>
                  <button className="button secondary" type="submit" style={{ fontSize: 13 }}>
                    Schedule
                  </button>
                </form>
              </details>

              {app.status === "INTERVIEW_SCHEDULED" ? (
                <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Mark Interview Complete</summary>
                  <form action={reviewInstructorApplicationAction} style={{ marginTop: 10 }}>
                    <input type="hidden" name="applicationId" value={app.id} />
                    <input type="hidden" name="action" value="mark_interview_complete" />
                    <label className="form-label" style={{ marginTop: 0 }}>
                      Notes
                      <input className="input" name="notes" placeholder="Interview summary..." />
                    </label>
                    <button className="button secondary" type="submit" style={{ fontSize: 13 }}>
                      Mark Complete
                    </button>
                  </form>
                </details>
              ) : null}

              <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#16a34a" }}>Approve Application</summary>
                <form action={reviewInstructorApplicationAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="action" value="approve" />
                  <label className="form-label" style={{ marginTop: 0 }}>
                    Notes
                    <textarea className="input" name="notes" rows={2} placeholder="Any notes for the new instructor..." />
                  </label>
                  <button className="button" type="submit" style={{ fontSize: 13, background: "#16a34a" }}>
                    Approve and Convert to Instructor
                  </button>
                </form>
              </details>

              <details style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#dc2626" }}>Reject Application</summary>
                <form action={reviewInstructorApplicationAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="action" value="reject" />
                  <label className="form-label" style={{ marginTop: 0 }}>
                    Reason
                    <textarea className="input" name="reason" required rows={3} placeholder="Explain why the application is being rejected..." />
                  </label>
                  <button className="button" type="submit" style={{ fontSize: 13, background: "#dc2626" }}>
                    Reject Application
                  </button>
                </form>
              </details>
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
