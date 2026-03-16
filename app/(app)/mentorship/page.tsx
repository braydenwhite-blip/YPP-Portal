import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import ContextTrail from "@/components/context-trail";
import { authOptions } from "@/lib/auth";
import { buildContextTrail } from "@/lib/context-trail";
import { formatEnum } from "@/lib/format-utils";
import { getMentorshipHubData } from "@/lib/mentorship-hub";

export default async function MentorshipPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  let trailItems: Awaited<ReturnType<typeof buildContextTrail>> = [];
  try {
    trailItems = await buildContextTrail({ route: "/mentorship", userId });
  } catch {
    trailItems = [];
  }

  const hub = await getMentorshipHubData({ userId, roles });
  const studentCircle = hub.flags.isStudent ? hub.circles[0] ?? null : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship OS</p>
          <h1 className="page-title">
            {hub.flags.isStudent ? "My Support Hub" : "Mentorship Hub"}
          </h1>
          <p className="page-subtitle">
            One place for sessions, action items, support requests, reviews, and shared knowledge.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hub.flags.canSupport && (
            <Link href="/mentorship/mentees" className="button primary small">
              Support Circles
            </Link>
          )}
          {hub.flags.canSupport && (
            <Link href="/mentor/feedback" className="button small secondary">
              Private Requests
            </Link>
          )}
          <Link href="/mentor/ask" className="button small secondary">
            Ask a Mentor
          </Link>
          <Link href="/mentor/resources" className="button small secondary">
            Resource Commons
          </Link>
          {hub.flags.isStudent && (
            <Link href="/my-mentor" className="button small secondary">
              My Support Circle
            </Link>
          )}
          {hub.flags.isAdmin && (
            <Link href="/admin/mentorship-program" className="button small secondary">
              Governance
            </Link>
          )}
        </div>
      </div>

      <ContextTrail items={trailItems} />

      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Relationship Health</div>
          <p style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>
            {hub.relationshipHealth.staleCircles}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            stale circle{hub.relationshipHealth.staleCircles === 1 ? "" : "s"} with no recent contact
          </p>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
            {hub.relationshipHealth.circlesWithNoUpcomingSession} without an upcoming session and{" "}
            {hub.relationshipHealth.lowSupportCoverage} with thin support coverage.
          </p>
        </div>
        <div className="card">
          <div className="section-title">Mentee Momentum</div>
          <p style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>
            {hub.menteeMomentum.overdueActions}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            overdue action item{hub.menteeMomentum.overdueActions === 1 ? "" : "s"}
          </p>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
            {hub.menteeMomentum.dueReflections} due reflection
            {hub.menteeMomentum.dueReflections === 1 ? "" : "s"} and {hub.menteeMomentum.openRequests} open
            support request{hub.menteeMomentum.openRequests === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="card">
          <div className="section-title">Program Outcomes</div>
          <p style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>
            {hub.programOutcomes.activePairings}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            active mentoring pairing{hub.programOutcomes.activePairings === 1 ? "" : "s"}
          </p>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
            {hub.programOutcomes.pendingApprovals} pending chair approval and{" "}
            {hub.programOutcomes.publicKnowledgeCount} public answer resource
            {hub.programOutcomes.publicKnowledgeCount === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      {studentCircle && (
        <div className="grid two" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="section-title">My Circle This Month</div>
            <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>
              {studentCircle.mentorName}
            </p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              {studentCircle.trackName ?? "General mentorship track"} · {studentCircle.supportCount} supporter
              {studentCircle.supportCount === 1 ? "" : "s"} in your circle
            </p>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <strong>Next session:</strong>{" "}
                {studentCircle.nextSession
                  ? new Date(studentCircle.nextSession.scheduledAt).toLocaleString()
                  : "Not scheduled yet"}
              </div>
              <div>
                <strong>Requests waiting:</strong> {studentCircle.pendingRequests}
              </div>
              <div>
                <strong>Open action items:</strong> {studentCircle.openActionItems}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="section-title">What To Do Next</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/reflection" className="button primary small" style={{ width: "fit-content" }}>
                Submit Reflection
              </Link>
              <Link href="/mentor/feedback" className="button secondary small" style={{ width: "fit-content" }}>
                Request Project Feedback
              </Link>
              <Link href="/mentor/ask" className="button secondary small" style={{ width: "fit-content" }}>
                Ask the Mentor Commons
              </Link>
              <Link href="/mentor/resources" className="button secondary small" style={{ width: "fit-content" }}>
                Browse Resources
              </Link>
            </div>
          </div>
        </div>
      )}

      {hub.circles.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>No active support circles yet</h3>
          <p style={{ color: "var(--muted)", maxWidth: 560, margin: "0 auto" }}>
            The redesigned mentorship system is ready for sessions, action plans, requests, and shared resources.
            The next step is creating or assigning a circle.
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {hub.flags.isAdmin && (
              <Link href="/admin/mentor-match" className="button primary small">
                Open Mentor Match
              </Link>
            )}
            <Link href="/mentor/ask" className="button secondary small">
              Open Mentor Commons
            </Link>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ marginBottom: 14 }}>
            {hub.flags.isStudent ? "Support Circle Snapshot" : "Active Support Circles"}
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {hub.circles.map((circle) => (
              <div
                key={circle.mentorshipId}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 16,
                  background: "var(--surface-alt)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ fontSize: 16 }}>{circle.menteeName}</strong>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {formatEnum(circle.menteeRole)}{circle.chapterName ? ` · ${circle.chapterName}` : ""} · Mentor:{" "}
                      {circle.mentorName}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {circle.supportCount} supporter{circle.supportCount === 1 ? "" : "s"} ·{" "}
                      {circle.trackName ?? "No track assigned"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {hub.flags.canSupport && (
                      <Link href={`/mentorship/mentees/${circle.menteeId}`} className="button secondary small">
                        Open Workspace
                      </Link>
                    )}
                    {circle.reviewStatus && (
                      <span className="pill">{circle.reviewStatus.replace(/_/g, " ")}</span>
                    )}
                  </div>
                </div>

                <div className="grid three" style={{ marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Next session</div>
                    <div style={{ fontWeight: 600 }}>
                      {circle.nextSession
                        ? new Date(circle.nextSession.scheduledAt).toLocaleString()
                        : "Not scheduled"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Pending requests</div>
                    <div style={{ fontWeight: 600 }}>{circle.pendingRequests}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Open action items</div>
                    <div style={{ fontWeight: 600 }}>
                      {circle.openActionItems}
                      {circle.overdueActions > 0 ? ` (${circle.overdueActions} overdue)` : ""}
                    </div>
                  </div>
                </div>

                {circle.highlightedResources.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                      Recent resources
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {circle.highlightedResources.map((resource) => (
                        <span key={resource.id} className="pill pill-small">
                          {resource.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid two">
        <div className="card">
          <div className="section-title">Shared Knowledge</div>
          {hub.featuredResources.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No published resources yet. Promote strong answers or add mentor playbooks to start the commons.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hub.featuredResources.map((resource) => (
                <div key={resource.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{resource.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {resource.type.replace(/_/g, " ")} · Shared by {resource.createdBy.name}
                  </div>
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noreferrer" className="link">
                      Open resource
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="section-title">Quick Routes</div>
          <div style={{ display: "grid", gap: 10 }}>
            <Link href="/mentor/feedback" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <strong>Private request queue</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  Handle project feedback, escalations, and targeted support requests.
                </p>
              </div>
            </Link>
            <Link href="/mentor/ask" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <strong>Ask a Mentor</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  Search public questions and contribute reusable answers.
                </p>
              </div>
            </Link>
            <Link href="/mentor/resources" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <strong>Resource commons</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  Curated links, playbooks, templates, and promoted answers.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
