import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getHiringChairQueue } from "@/lib/application-actions";
import ChairDecisionActions from "./chair-decision-actions";

export const metadata = { title: "Hiring Chair Queue | YPP" };

function formatRecommendation(accepted: boolean) {
  return accepted ? "Hire" : "Reject";
}

export default async function HiringCommitteePage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const queue = await getHiringChairQueue();
  const pendingHires = queue.filter((item) => item.accepted).length;
  const pendingRejections = queue.length - pendingHires;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Hiring Chair Queue</h1>
          <p className="page-subtitle">
            Review submitted hiring recommendations before any candidate is finalized.
          </p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{queue.length}</div>
          <div className="kpi-label">Pending Chair Reviews</div>
        </div>
        <div className="card">
          <div className="kpi">{pendingHires}</div>
          <div className="kpi-label">Hire Recommendations</div>
        </div>
        <div className="card">
          <div className="kpi">{pendingRejections}</div>
          <div className="kpi-label">Reject Recommendations</div>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="card">
          <p className="empty">No hiring decisions are waiting on Chair review right now.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {queue.map((decision) => (
            <div key={decision.id} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <h3 style={{ margin: 0 }}>{decision.application.applicant.name}</h3>
                    <span className={`pill ${decision.accepted ? "pill-success" : "pill-declined"}`}>
                      {formatRecommendation(decision.accepted)}
                    </span>
                    <span className="pill">{decision.application.position.title}</span>
                    {decision.application.position.chapter?.name ? (
                      <span className="pill pill-pathway">{decision.application.position.chapter.name}</span>
                    ) : null}
                  </div>
                  <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    Submitted by {decision.decidedBy.name} on {new Date(decision.decidedAt).toLocaleString()}
                  </p>
                  <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    Applicant: {decision.application.applicant.email}
                  </p>
                </div>
              </div>

              {decision.notes ? (
                <div style={{ marginTop: 14 }}>
                  <strong style={{ fontSize: 13 }}>Submitted recommendation</strong>
                  <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{decision.notes}</p>
                </div>
              ) : null}

              <div style={{ marginTop: 14 }}>
                <strong style={{ fontSize: 13 }}>Recent interview notes</strong>
                {decision.application.interviewNotes.length === 0 ? (
                  <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                    No structured interview notes were attached.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {decision.application.interviewNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: 10,
                          background: "var(--surface-alt)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <strong style={{ fontSize: 13 }}>{note.author.name}</strong>
                          {note.recommendation ? (
                            <span className="pill pill-small">
                              {note.recommendation.replace(/_/g, " ")}
                            </span>
                          ) : null}
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: 13, whiteSpace: "pre-wrap" }}>{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <ChairDecisionActions decisionId={decision.id} applicantName={decision.application.applicant.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
