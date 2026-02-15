import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { withdrawApplication } from "@/lib/application-actions";

export default async function MyApplicationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const applications = await prisma.application.findMany({
    where: { applicantId: session.user.id },
    include: {
      position: {
        include: { chapter: { select: { name: true } } }
      },
      interviewSlots: {
        orderBy: { scheduledAt: "asc" }
      },
      decision: true
    },
    orderBy: { submittedAt: "desc" }
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
        </div>
        <Link href="/positions" className="button small" style={{ textDecoration: "none" }}>
          Browse Positions
        </Link>
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
        <div className="grid two">
          {applications.map((application) => {
            const upcomingInterview = application.interviewSlots.find(
              s => new Date(s.scheduledAt) > new Date() && !s.isConfirmed
            );
            const confirmedInterview = application.interviewSlots.find(s => s.isConfirmed);

            return (
              <div key={application.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{application.position.title}</h3>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <span className="pill">{application.position.type.replace("_", " ")}</span>
                      {application.position.chapter && (
                        <span className="pill" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
                          {application.position.chapter.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`pill ${getStatusColor(application.status)}`}>
                    {application.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
                  Applied: {new Date(application.submittedAt).toLocaleDateString()}
                </div>

                {upcomingInterview && (
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
                      {new Date(upcomingInterview.scheduledAt).toLocaleString()}
                    </p>
                    {upcomingInterview.meetingLink && (
                      <a
                        href={upcomingInterview.meetingLink}
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

                {!["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(application.status) && (
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
    </div>
  );
}
