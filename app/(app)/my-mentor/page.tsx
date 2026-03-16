import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { SUPPORT_ROLE_META, getStudentSupportCircleData } from "@/lib/mentorship-hub";
import { updateMentorshipActionItemStatus } from "@/lib/mentorship-hub-actions";

export default async function MyMentorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspace = await getStudentSupportCircleData(session.user.id);

  if (!workspace || !workspace.mentorship) {
    return (
      <main className="main-content my-mentor-page">
        <div className="topbar">
          <div>
            <Link href="/mentorship" style={{ fontSize: 13, color: "var(--muted)", display: "inline-block", marginBottom: 4 }}>
              &larr; Mentorship Hub
            </Link>
            <h1 className="page-title">My Support Circle</h1>
            <p className="page-subtitle">Your layered support team will appear here once a circle is assigned.</p>
          </div>
        </div>

        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem", maxWidth: 640, margin: "2rem auto" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🧭</div>
          <h2 style={{ marginTop: 0 }}>No support circle assigned yet</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            The redesigned mentorship experience works best when you have a primary mentor plus supporting roles.
            Ask your chapter lead or admin to create your circle.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/mentor/ask" className="button secondary small">
              Ask the Mentor Commons
            </Link>
            <Link href="/mentor/resources" className="button secondary small">
              Browse Resources
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const mentorship = workspace.mentorship;
  const openActionItems = workspace.actionItems.filter((item) => item.status !== "COMPLETE");
  const upcomingSessions = workspace.sessions.filter(
    (item) => !item.completedAt && item.scheduledAt.getTime() >= Date.now()
  );
  const primaryMentor = workspace.circleMembers.find((member) => member.role === "PRIMARY_MENTOR");

  return (
    <main className="main-content my-mentor-page">
      <div className="topbar">
        <div>
          <Link href="/mentorship" style={{ fontSize: 13, color: "var(--muted)", display: "inline-block", marginBottom: 4 }}>
            &larr; Mentorship Hub
          </Link>
          <h1 className="page-title">My Support Circle</h1>
          <p className="page-subtitle">
            Your mentor, support roles, upcoming sessions, and action plan all live here.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/mentor/feedback" className="button primary small">
            Request Feedback
          </Link>
          <Link href="/mentor/ask" className="button secondary small">
            Ask a Mentor
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="section-title">Circle Overview</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <strong>Primary mentor:</strong> {primaryMentor?.user.name ?? mentorship.mentor.name}
            </div>
            <div>
              <strong>Track:</strong> {mentorship.track?.name ?? "General mentorship"}
            </div>
            <div>
              <strong>Started:</strong> {new Date(mentorship.startDate).toLocaleDateString()}
            </div>
            <div>
              <strong>Upcoming sessions:</strong> {upcomingSessions.length}
            </div>
            <div>
              <strong>Open requests:</strong> {workspace.requests.filter((request) => request.status === "OPEN").length}
            </div>
          </div>
          {mentorship.notes && (
            <p style={{ marginTop: 14, color: "var(--muted)" }}>{mentorship.notes}</p>
          )}
        </section>

        <section className="card">
          <div className="section-title">Next Steps</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/reflection" className="button primary small" style={{ width: "fit-content" }}>
              Monthly Self-Reflection
            </Link>
            <Link href="/mentor/resources" className="button secondary small" style={{ width: "fit-content" }}>
              Open Resource Commons
            </Link>
            <Link href={`/mentorship/reviews/${workspace.mentee.id}`} className="button secondary small" style={{ width: "fit-content" }}>
              View Current Review
            </Link>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Support Roles</div>
        <div className="grid two">
          {workspace.circleMembers.map((member) => (
            <div
              key={member.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--surface-alt)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{member.user.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {SUPPORT_ROLE_META[member.role].label} · {member.user.primaryRole.replace(/_/g, " ")}
                  </div>
                </div>
                <span
                  className="pill"
                  style={{
                    background: `${SUPPORT_ROLE_META[member.role].tone}15`,
                    color: SUPPORT_ROLE_META[member.role].tone,
                  }}
                >
                  {member.role.replace(/_/g, " ")}
                </span>
              </div>
              <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
                {SUPPORT_ROLE_META[member.role].description}
              </p>
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <a href={`mailto:${member.user.email}`} className="link">
                  {member.user.email}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="section-title">Upcoming Sessions</div>
          {upcomingSessions.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No session is scheduled yet. Your primary mentor can create one from the workspace.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingSessions.map((sessionItem) => (
                <div key={sessionItem.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{sessionItem.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {new Date(sessionItem.scheduledAt).toLocaleString()} · {sessionItem.type.replace(/_/g, " ")}
                  </div>
                  {sessionItem.agenda && (
                    <p style={{ margin: "8px 0 0", fontSize: 13 }}>{sessionItem.agenda}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-title">Action Plan</div>
          {openActionItems.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No active action items right now. New next steps will appear here after each session.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {openActionItems.map((item) => (
                <div key={item.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {item.owner?.name ? `Owner: ${item.owner.name}` : "Shared responsibility"}
                        {item.dueAt ? ` · Due ${new Date(item.dueAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <span className="pill">{item.status.replace(/_/g, " ")}</span>
                  </div>
                  {item.details && <p style={{ margin: "8px 0 0", fontSize: 13 }}>{item.details}</p>}
                  <form action={updateMentorshipActionItemStatus} style={{ marginTop: 8 }}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="status" value="COMPLETE" />
                    <button type="submit" className="button secondary small">
                      Mark Complete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid two">
        <section className="card">
          <div className="section-title">Recent Requests</div>
          {workspace.requests.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No support requests yet. Use the feedback and mentor commons links above to start one.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {workspace.requests.slice(0, 4).map((request) => (
                <div key={request.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{request.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {request.kind.replace(/_/g, " ")} · {request.visibility.toLowerCase()}
                      </div>
                    </div>
                    <span className="pill">{request.status.replace(/_/g, " ")}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13 }}>{request.details}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-title">Resources For Me</div>
          {workspace.resources.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Resources attached to your sessions, requests, or support circle will appear here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {workspace.resources.slice(0, 4).map((resource) => (
                <div key={resource.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{resource.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Shared by {resource.createdBy.name}
                  </div>
                  {resource.description && <p style={{ margin: "8px 0 0", fontSize: 13 }}>{resource.description}</p>}
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noreferrer" className="link">
                      Open resource
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
