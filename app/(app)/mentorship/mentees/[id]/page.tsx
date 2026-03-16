import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  SUPPORT_ROLE_META,
  getSupportWorkspaceData,
} from "@/lib/mentorship-hub";
import {
  createMentorshipActionItem,
  createMentorshipSession,
  updateMentorshipActionItemStatus,
} from "@/lib/mentorship-hub-actions";

export default async function MenteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: menteeId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspace = await getSupportWorkspaceData({
    viewerId: session.user.id,
    roles: session.user.roles ?? [],
    menteeId,
  });

  if (!workspace) {
    notFound();
  }

  const upcomingSessions = workspace.sessions.filter(
    (item) => !item.completedAt && item.scheduledAt.getTime() >= Date.now()
  );
  const recentSessions = workspace.sessions.filter((item) => item.completedAt).slice(0, 4);
  const openActionItems = workspace.actionItems.filter((item) => item.status !== "COMPLETE");
  const overdueActionItems = openActionItems.filter(
    (item) => item.dueAt && item.dueAt.getTime() < Date.now()
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/mentorship/mentees" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to Support Circles
          </Link>
          <h1 className="page-title">{workspace.mentee.name}</h1>
          <p className="page-subtitle">
            The full support-circle workspace: people, sessions, action plan, requests, resources, and progress signals.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/mentorship/reviews/${workspace.mentee.id}`} className="button primary small">
            Monthly Review
          </Link>
          <Link href="/mentor/feedback" className="button secondary small">
            Private Queue
          </Link>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Circle Health</div>
          <p style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>
            {workspace.circleMembers.length}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            active supporter{workspace.circleMembers.length === 1 ? "" : "s"} in the circle
          </p>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
            {upcomingSessions.length} upcoming session{upcomingSessions.length === 1 ? "" : "s"} and{" "}
            {recentSessions.length} recent session{recentSessions.length === 1 ? "" : "s"} logged.
          </p>
        </div>
        <div className="card">
          <div className="section-title">Action Plan</div>
          <p style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>
            {openActionItems.length}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            open action item{openActionItems.length === 1 ? "" : "s"}
          </p>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
            {overdueActionItems.length} overdue and {workspace.requests.filter((item) => item.status === "OPEN").length} open
            support request{workspace.requests.filter((item) => item.status === "OPEN").length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="card">
          <div className="section-title">Momentum Signals</div>
          <p style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>
            {workspace.mentee.incubatorProjects.length}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            incubator project{workspace.mentee.incubatorProjects.length === 1 ? "" : "s"} in flight
          </p>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
            {workspace.mentee.goals.length} goal{workspace.mentee.goals.length === 1 ? "" : "s"} and{" "}
            {workspace.mentee.enrollments.length} recent enrollment
            {workspace.mentee.enrollments.length === 1 ? "" : "s"} connected to mentoring.
          </p>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="section-title">Profile</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <strong>Email:</strong> {workspace.mentee.email}
            </div>
            {workspace.mentee.phone && (
              <div>
                <strong>Phone:</strong> {workspace.mentee.phone}
              </div>
            )}
            <div>
              <strong>Role:</strong> {workspace.mentee.primaryRole.replace(/_/g, " ")}
            </div>
            {workspace.mentee.chapter && (
              <div>
                <strong>Chapter:</strong> {workspace.mentee.chapter.name}
              </div>
            )}
            {workspace.mentee.profile?.bio && (
              <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{workspace.mentee.profile.bio}</p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="section-title">Current Review Spine</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <strong>Active mentorship:</strong>{" "}
              {workspace.mentorship ? new Date(workspace.mentorship.startDate).toLocaleDateString() : "Not assigned"}
            </div>
            <div>
              <strong>Current monthly review:</strong>{" "}
              {workspace.currentReview?.status?.replace(/_/g, " ") ?? "No review started yet"}
            </div>
            <div>
              <strong>Reflections on file:</strong> {workspace.mentee.reflectionSubmissions.length}
            </div>
            <div>
              <strong>Latest track:</strong> {workspace.mentorship?.track?.name ?? "No track assigned"}
            </div>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Support Circle Roster</div>
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{member.user.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {member.user.primaryRole.replace(/_/g, " ")}
                  </div>
                </div>
                <span
                  className="pill"
                  style={{
                    background: `${SUPPORT_ROLE_META[member.role].tone}15`,
                    color: SUPPORT_ROLE_META[member.role].tone,
                  }}
                >
                  {SUPPORT_ROLE_META[member.role].label}
                </span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
                {SUPPORT_ROLE_META[member.role].description}
              </p>
              <div style={{ marginTop: 10, fontSize: 13 }}>
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
          <div className="section-title">Schedule or Log a Session</div>
          <form action={createMentorshipSession} className="form-grid">
            <input type="hidden" name="menteeId" value={workspace.mentee.id} />
            <div className="form-row">
              <label>Session type</label>
              <select name="type" className="input" defaultValue="CHECK_IN">
                <option value="KICKOFF">Kickoff</option>
                <option value="CHECK_IN">Check-in</option>
                <option value="REVIEW_PREP">Review prep</option>
                <option value="QUARTERLY_REVIEW">Quarterly review</option>
                <option value="OFFICE_HOURS">Office hours</option>
              </select>
            </div>
            <div className="form-row">
              <label>Title</label>
              <input name="title" className="input" placeholder="April momentum check-in" />
            </div>
            <div className="form-row">
              <label>Scheduled at</label>
              <input type="datetime-local" name="scheduledAt" className="input" required />
            </div>
            <div className="form-row">
              <label>Length (minutes)</label>
              <input type="number" name="durationMinutes" className="input" min="15" step="15" defaultValue="30" />
            </div>
            <div className="form-row">
              <label>Agenda</label>
              <textarea name="agenda" className="input" rows={3} placeholder="What will we cover?" />
            </div>
            <div className="form-row">
              <label>Notes (optional)</label>
              <textarea name="notes" className="input" rows={3} placeholder="Add notes if this session is already complete." />
            </div>
            <div className="form-row">
              <label>Mark complete immediately</label>
              <select name="completedNow" className="input" defaultValue="false">
                <option value="false">No, schedule it</option>
                <option value="true">Yes, log it now</option>
              </select>
            </div>
            <button type="submit" className="button primary small">
              Save Session
            </button>
          </form>
        </section>

        <section className="card">
          <div className="section-title">Create an Action Item</div>
          <form action={createMentorshipActionItem} className="form-grid">
            <input type="hidden" name="menteeId" value={workspace.mentee.id} />
            <div className="form-row">
              <label>Title</label>
              <input name="title" className="input" placeholder="Draft the project pitch outline" required />
            </div>
            <div className="form-row">
              <label>Owner</label>
              <select name="ownerId" className="input" defaultValue={workspace.mentee.id}>
                <option value="">Shared responsibility</option>
                <option value={workspace.mentee.id}>{workspace.mentee.name}</option>
                {workspace.circleMembers.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Due date</label>
              <input type="date" name="dueAt" className="input" />
            </div>
            <div className="form-row">
              <label>Details</label>
              <textarea name="details" className="input" rows={4} placeholder="What does success look like for this next step?" />
            </div>
            <button type="submit" className="button primary small">
              Add Action Item
            </button>
          </form>
        </section>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="section-title">Session Timeline</div>
          {workspace.sessions.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No sessions have been logged yet. Start by creating a kickoff or check-in session above.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {workspace.sessions.map((sessionItem) => (
                <div key={sessionItem.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{sessionItem.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {sessionItem.type.replace(/_/g, " ")} · {new Date(sessionItem.scheduledAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="pill">
                      {sessionItem.completedAt ? "Completed" : "Scheduled"}
                    </span>
                  </div>
                  {sessionItem.agenda && <p style={{ margin: "8px 0 0", fontSize: 13 }}>{sessionItem.agenda}</p>}
                  {sessionItem.notes && <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>{sessionItem.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-title">Action Plan</div>
          {workspace.actionItems.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No action items yet. Action items turn sessions into next steps the mentee can actually follow.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {workspace.actionItems.map((item) => (
                <div key={item.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {item.owner?.name ? `Owner: ${item.owner.name}` : "Shared"} · {item.status.replace(/_/g, " ")}
                        {item.dueAt ? ` · Due ${new Date(item.dueAt).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    {item.status !== "COMPLETE" && (
                      <form action={updateMentorshipActionItemStatus}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="status" value="COMPLETE" />
                        <button type="submit" className="button secondary small">
                          Complete
                        </button>
                      </form>
                    )}
                  </div>
                  {item.details && <p style={{ margin: "8px 0 0", fontSize: 13 }}>{item.details}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="section-title">Requests and Escalations</div>
          {workspace.requests.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No requests yet. Private feedback, escalations, and public questions will all show up here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {workspace.requests.map((request) => (
                <div key={request.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{request.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {request.kind.replace(/_/g, " ")} · {request.visibility.toLowerCase()} ·{" "}
                        {request.assignedTo?.name ? `Assigned to ${request.assignedTo.name}` : "Open to supporters"}
                      </div>
                    </div>
                    <span className="pill">{request.status.replace(/_/g, " ")}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13 }}>{request.details}</p>
                  {request.responses.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {request.responses.slice(0, 2).map((response) => (
                        <div key={response.id} style={{ background: "var(--surface-alt)", borderRadius: 12, padding: 10 }}>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {response.responder.name} · {new Date(response.createdAt).toLocaleDateString()}
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 13 }}>{response.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-title">Resource Attachments</div>
          {workspace.resources.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Resources attached to requests, sessions, or promoted answers will appear here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {workspace.resources.map((resource) => (
                <div key={resource.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div style={{ fontWeight: 700 }}>{resource.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {resource.type.replace(/_/g, " ")} · Shared by {resource.createdBy.name}
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

      <div className="grid two">
        <section className="card">
          <div className="section-title">Goals, Courses, and Training</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <strong>Goals</strong>
              {workspace.mentee.goals.length === 0 ? (
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>No goals assigned yet.</p>
              ) : (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {workspace.mentee.goals.slice(0, 5).map((goal) => (
                    <div key={goal.id}>
                      <div style={{ fontWeight: 600 }}>{goal.template.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        Latest: {goal.progress[0]?.status?.replace(/_/g, " ") ?? "No update yet"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <strong>Recent Enrollments</strong>
              {workspace.mentee.enrollments.length === 0 ? (
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>No recent course enrollments.</p>
              ) : (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {workspace.mentee.enrollments.map((enrollment) => (
                    <div key={enrollment.id}>
                      <div style={{ fontWeight: 600 }}>{enrollment.course.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{enrollment.course.interestArea}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <strong>Training Assignments</strong>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                {workspace.mentee.trainings.length} training module
                {workspace.mentee.trainings.length === 1 ? "" : "s"} on record.
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-title">Incubator and Reflection Timeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <strong>Incubator Projects</strong>
              {workspace.mentee.incubatorProjects.length === 0 ? (
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>No incubator projects yet.</p>
              ) : (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {workspace.mentee.incubatorProjects.map((project) => (
                    <div key={project.id}>
                      <div style={{ fontWeight: 600 }}>{project.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {project.currentPhase.replace(/_/g, " ")} · {project.xpEarned} XP
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <strong>Reflections</strong>
              {workspace.mentee.reflectionSubmissions.length === 0 ? (
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>No reflections submitted yet.</p>
              ) : (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {workspace.mentee.reflectionSubmissions.slice(0, 4).map((reflection) => (
                    <div key={reflection.id}>
                      <div style={{ fontWeight: 600 }}>
                        {reflection.form.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(reflection.submittedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
