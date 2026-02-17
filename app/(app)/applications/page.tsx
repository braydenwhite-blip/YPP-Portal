import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { withdrawApplication } from "@/lib/application-actions";

const FINAL_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"];
const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "INTERVIEW_COMPLETED", label: "Interview Completed" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

export default async function MyApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const applications = await prisma.application.findMany({
    where: { applicantId: session.user.id },
    include: {
      position: {
        include: { chapter: { select: { name: true } } },
      },
      interviewSlots: {
        orderBy: { scheduledAt: "asc" },
      },
      decision: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  const activeCount = applications.filter(
    (a) => !FINAL_STATUSES.includes(a.status)
  ).length;
  const acceptedCount = applications.filter((a) => a.status === "ACCEPTED").length;

  // Compute counts per status
  const statusCounts: Record<string, number> = { all: applications.length, active: activeCount };
  for (const a of applications) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  }

  // Apply filter
  const selectedFilter = params.status || "all";
  const filteredApplications = applications.filter((a) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "active") return !FINAL_STATUSES.includes(a.status);
    return a.status === selectedFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "pill-success";
      case "REJECTED":
      case "WITHDRAWN":
        return "pill-declined";
      case "INTERVIEW_SCHEDULED":
      case "INTERVIEW_COMPLETED":
        return "pill-pathway";
      default:
        return "";
    }
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Applications</p>
          <h1 className="page-title">Application Status</h1>
          <p className="page-subtitle">
            {applications.length === 0
              ? "You haven't applied yet. Browse open positions to get started."
              : `${activeCount} active \u00B7 ${acceptedCount} accepted \u00B7 ${applications.length} total`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/interviews?scope=hiring&view=mine&state=needs_action" className="button small outline" style={{ textDecoration: "none" }}>
            Interview Command Center
          </Link>
          <Link href="/chapters/propose" className="button small ghost" style={{ textDecoration: "none" }}>
            Propose Chapter
          </Link>
          <Link href="/positions" className="button small" style={{ textDecoration: "none" }}>
            Browse Positions
          </Link>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>
              You haven&apos;t applied to any positions yet.
            </p>
            <Link href="/positions" className="button" style={{ textDecoration: "none" }}>
              View Open Positions
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {FILTER_OPTIONS.map((opt) => {
              const count = statusCounts[opt.value] || 0;
              if (!["all", "active"].includes(opt.value) && count === 0) return null;
              const isActive = selectedFilter === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={opt.value === "all" ? "/applications" : `/applications?status=${opt.value}`}
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    border: `1px solid ${isActive ? "#7c3aed" : "var(--border)"}`,
                    borderRadius: 16,
                    background: isActive ? "#f5f3ff" : "transparent",
                    color: isActive ? "#7c3aed" : "var(--muted)",
                    textDecoration: "none",
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label} ({count})
                </Link>
              );
            })}
          </div>

          {filteredApplications.length === 0 ? (
            <div className="card">
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>
                No applications match this filter.
              </p>
            </div>
          ) : (
            <div className="grid two">
              {filteredApplications.map((application) => {
                const postedInterview = application.interviewSlots.find(
                  (slot) =>
                    slot.status === "POSTED" &&
                    new Date(slot.scheduledAt) > new Date()
                );
                const confirmedInterview = application.interviewSlots.find(
                  (slot) => slot.status === "CONFIRMED"
                );
                const completedInterview = application.interviewSlots.find(
                  (slot) => slot.status === "COMPLETED"
                );

                return (
                  <div key={application.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{application.position.title}</h3>
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="pill">{application.position.type.replace("_", " ")}</span>
                          {application.position.chapter && (
                            <span className="pill" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
                              {application.position.chapter.name}
                            </span>
                          )}
                          {application.position.interviewRequired ? (
                            <span className="pill pill-pathway" style={{ fontSize: 11 }}>Interview Required</span>
                          ) : (
                            <span className="pill pill-success" style={{ fontSize: 11 }}>No Interview</span>
                          )}
                        </div>
                      </div>
                      <span className={`pill ${getStatusColor(application.status)}`}>
                        {application.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                      <span>Applied: {new Date(application.submittedAt).toLocaleDateString()}</span>
                      {!application.decision && !["WITHDRAWN"].includes(application.status) && (
                        <span style={{
                          fontSize: 12,
                          color: "#7c3aed",
                          fontWeight: 500,
                        }}>
                          {application.status === "SUBMITTED" && "Awaiting review"}
                          {application.status === "UNDER_REVIEW" && (application.position.interviewRequired ? "Interview pending" : "Decision pending")}
                          {application.status === "INTERVIEW_SCHEDULED" && "Confirm your interview"}
                          {application.status === "INTERVIEW_COMPLETED" && "Decision pending"}
                        </span>
                      )}
                    </div>

                    {postedInterview && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          background: "#fef3c7",
                          borderRadius: "var(--radius-sm)"
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>Interview Scheduled</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                          {new Date(postedInterview.scheduledAt).toLocaleString()}
                        </p>
                        {postedInterview.meetingLink && (
                          <a
                            href={postedInterview.meetingLink}
                            target="_blank"
                            className="link"
                            style={{ fontSize: 13 }}
                          >
                            Join Meeting &rarr;
                          </a>
                        )}
                      </div>
                    )}

                    {confirmedInterview && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          background: "#dcfce7",
                          borderRadius: "var(--radius-sm)"
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>Interview Confirmed</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                          {new Date(confirmedInterview.scheduledAt).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {completedInterview && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          background: "#dcfce7",
                          borderRadius: "var(--radius-sm)"
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>Interview Completed</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                          Completed on {new Date(completedInterview.completedAt ?? completedInterview.scheduledAt).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {application.decision && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          background: application.decision.accepted ? "#dcfce7" : "#fee2e2",
                          borderRadius: "var(--radius-sm)"
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>
                          {application.decision.accepted ? "Congratulations!" : "Decision"}
                        </strong>
                        <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                          {application.decision.accepted
                            ? "Your application has been accepted!"
                            : "Unfortunately, we've decided to move forward with other candidates."}
                        </p>
                        {application.decision.notes && (
                          <p style={{ margin: "8px 0 0", fontSize: 13, fontStyle: "italic" }}>
                            {application.decision.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {!FINAL_STATUSES.includes(application.status) && (
                      <form action={withdrawApplication} style={{ marginTop: 16 }}>
                        <input type="hidden" name="applicationId" value={application.id} />
                        <button type="submit" className="button small ghost">
                          Withdraw Application
                        </button>
                      </form>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <Link href={`/applications/${application.id}`} className="link">
                        Open Application Workspace &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
