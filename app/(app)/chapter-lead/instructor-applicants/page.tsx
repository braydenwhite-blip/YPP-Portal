import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstructorApplicationStatus } from "@prisma/client";

function statusColor(status: InstructorApplicationStatus): string {
  if (status === "APPROVED") return "#16a34a";
  if (status === "REJECTED") return "#dc2626";
  if (status === "INFO_REQUESTED") return "#d97706";
  if (status === "INTERVIEW_SCHEDULED" || status === "INTERVIEW_COMPLETED") return "#2563eb";
  return "#7c3aed";
}

function statusLabel(status: InstructorApplicationStatus): string {
  switch (status) {
    case "SUBMITTED": return "Submitted";
    case "UNDER_REVIEW": return "Under Review";
    case "INFO_REQUESTED": return "Info Requested";
    case "ON_HOLD": return "On Hold";
    case "INTERVIEW_SCHEDULED": return "Interview Scheduled";
    case "INTERVIEW_COMPLETED": return "Interview Completed";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Rejected";
    default: return status;
  }
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ChapterLeadInstructorApplicantsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("CHAPTER_PRESIDENT") && !roles.includes("ADMIN")) redirect("/");

  const currentUser = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { chapterId: true },
  });

  const applications = await prisma.instructorApplication.findMany({
    where: currentUser?.chapterId
      ? { applicant: { chapterId: currentUser.chapterId } }
      : {},
    include: {
      applicant: {
        select: { id: true, name: true, email: true, chapter: { select: { name: true } } },
      },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = applications.filter((a) =>
    ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "ON_HOLD"].includes(a.status)
  );
  const interviewing = applications.filter((a) =>
    ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(a.status)
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Chapter President</span>
          <h1 className="page-title">Instructor Applicants</h1>
          <p className="page-subtitle">
            Review and manage legacy instructor applications for your chapter.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          This page is kept for compatibility. Chapter Presidents should do primary hiring work in{" "}
          <Link href="/chapter/recruiting" className="link">
            Chapter Recruiting
          </Link>{" "}
          and the shared candidate workspaces under{" "}
          <Link href="/applications" className="link">
            Applications
          </Link>
          .
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card kpi">
          <div className="kpi-value">{pending.length}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{interviewing.length}</div>
          <div className="kpi-label">In Interview Stage</div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>
            No instructor applications for your chapter yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {applications.map((app) => (
            <details key={app.id} className="card">
              <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{app.applicant.name}</span>
                    <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>{app.applicant.email}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Applied {formatDate(app.createdAt)}</span>
                  <span className="badge" style={{ background: statusColor(app.status), color: "white", fontSize: 11 }}>
                    {statusLabel(app.status)}
                  </span>
                </div>
              </summary>

              <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  <Link
                    href={
                      app.status === "INTERVIEW_SCHEDULED" ||
                      app.status === "INTERVIEW_COMPLETED" ||
                      app.status === "ON_HOLD" ||
                      app.status === "APPROVED" ||
                      app.status === "REJECTED"
                        ? `/applications/instructor/${app.id}/interview`
                        : `/applications/instructor/${app.id}`
                    }
                    className="button secondary"
                    style={{ textDecoration: "none" }}
                  >
                    {app.status === "INTERVIEW_SCHEDULED" ||
                    app.status === "INTERVIEW_COMPLETED" ||
                    app.status === "ON_HOLD" ||
                    app.status === "APPROVED" ||
                    app.status === "REJECTED"
                      ? "Open Interview Workspace"
                      : "Open Application Review"}
                  </Link>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>WHY THEY WANT TO TEACH</p>
                    <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.motivation}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>TEACHING EXPERIENCE</p>
                    <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{app.teachingExperience}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>INTERVIEW AVAILABILITY</p>
                    <p style={{ fontSize: 14, margin: 0 }}>{app.availability}</p>
                  </div>
                  {app.reviewer && (
                    <div>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>REVIEWER</p>
                      <p style={{ fontSize: 14, margin: 0 }}>{app.reviewer.name}</p>
                    </div>
                  )}
                </div>

                {app.infoRequest && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>INFO REQUEST SENT</p>
                    <p style={{ fontSize: 14, margin: 0 }}>{app.infoRequest}</p>
                  </div>
                )}
                {app.applicantResponse && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>APPLICANT RESPONSE</p>
                    <p style={{ fontSize: 14, margin: 0 }}>{app.applicantResponse}</p>
                  </div>
                )}
                {app.reviewerNotes && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>REVIEWER NOTES</p>
                    <p style={{ fontSize: 14, margin: 0 }}>{app.reviewerNotes}</p>
                  </div>
                )}

                {!["APPROVED", "REJECTED"].includes(app.status) && (
                  <div
                    style={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface-alt)",
                      padding: 14,
                      marginTop: 16,
                    }}
                  >
                    <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--muted)" }}>
                      Continue in the structured workspace to review categories, inspect the draft, and submit the official next step.
                    </p>
                    <Link
                      href={
                        app.status === "INTERVIEW_SCHEDULED" ||
                        app.status === "INTERVIEW_COMPLETED" ||
                        app.status === "ON_HOLD" ||
                        app.status === "APPROVED" ||
                        app.status === "REJECTED"
                          ? `/applications/instructor/${app.id}/interview`
                          : `/applications/instructor/${app.id}`
                      }
                      className="button secondary"
                      style={{ textDecoration: "none" }}
                    >
                      Continue in Workspace
                    </Link>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
