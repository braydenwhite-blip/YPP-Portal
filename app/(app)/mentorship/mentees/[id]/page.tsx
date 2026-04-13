import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { notFound, redirect } from "next/navigation";

import { FieldLabel } from "@/components/field-help";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { KickoffStatusRow } from "@/components/mentorship/kickoff-status-row";
import { CycleStatusBlock } from "@/components/mentorship/cycle-status-block";
import { formatEnum } from "@/lib/format-utils";
import { getCurrentCycleMonth, getReflectionSoftDeadline } from "@/lib/mentorship-cycle";
import {
  SUPPORT_ROLE_META,
  getSupportWorkspaceData,
} from "@/lib/mentorship-hub";
import {
  createMentorshipActionItem,
  createMentorshipSession,
  updateMentorshipActionItemStatus,
} from "@/lib/mentorship-hub-actions";
import { getCompactRecognitionSnapshot } from "@/lib/my-program-portal";

const WORKSPACE_GUIDE_ITEMS = [
  {
    label: "Profile, Review Spine, and Roster",
    meaning:
      "These sections tell you who the mentee is, where they are in the review cycle, and who is responsible for supporting them.",
    howToUse:
      "Read these first so you know the mentee's role, chapter, current track, and who should be involved before you make decisions.",
  },
  {
    label: "Schedule or Log a Session",
    meaning:
      "This form is where mentoring conversations become visible in the system, whether you are planning ahead or writing down a session that already happened.",
    howToUse:
      "Use 'schedule it' when the meeting is still coming up and 'log it now' when you already met and want the session recorded immediately.",
  },
  {
    label: "Create an Action Item",
    meaning:
      "Action items are the concrete next steps that come out of a session.",
    howToUse:
      "Write one action item per clear next step, assign an owner when possible, and add a due date if you want the system to help track follow-through.",
  },
  {
    label: "Requests, Resources, and Progress History",
    meaning:
      "The lower sections are the evidence trail for mentoring: what support was asked for, what resources were shared, and how goals, training, projects, and reflections are moving.",
    howToUse:
      "Use these sections to prepare for the next session and to write a review that is based on real activity instead of memory alone.",
  },
] as const;

export default async function MenteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: menteeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [workspace, recognition] = await Promise.all([
    getSupportWorkspaceData({
      viewerId: session.user.id,
      roles: session.user.roles ?? [],
      menteeId,
    }),
    getCompactRecognitionSnapshot(menteeId),
  ]);

  if (!workspace) {
    notFound();
  }

  const isSelfWorkspace = session.user.id === workspace.mentee.id;
  const canManageActionPlan = Boolean(workspace.mentorship || workspace.intakePlanLaunch) && !isSelfWorkspace;
  const canScheduleSessions = Boolean(workspace.mentorship) && !isSelfWorkspace;
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
          {canScheduleSessions && (
            <Link href={`/mentorship/reviews/${workspace.mentee.id}`} className="button primary small">
              Open Monthly Review
            </Link>
          )}
          <Link href="/mentor/feedback" className="button secondary small">
            Feedback Queue
          </Link>
        </div>
      </div>

      <MentorshipGuideCard
        title="How To Use This Support Workspace"
        intro="This workspace is the day-to-day operating area for one mentee. Work from top to bottom when you want the full picture."
        items={WORKSPACE_GUIDE_ITEMS}
      />

      {workspace.mentorship && (
        <>
          <CycleStatusBlock
            menteeId={workspace.mentee.id}
            mentorshipId={workspace.mentorship.id}
            cycleStage={workspace.mentorship.cycleStage ?? "REFLECTION_DUE"}
            trackName={workspace.mentorship.track?.name ?? null}
            cycleLabel={getCurrentCycleMonth().cycleLabel}
            softDeadline={getReflectionSoftDeadline(getCurrentCycleMonth().cycleMonth)}
          />
          <KickoffStatusRow
            mentorshipId={workspace.mentorship.id}
            kickoffScheduledAt={workspace.mentorship.kickoffScheduledAt ?? null}
            kickoffCompletedAt={workspace.mentorship.kickoffCompletedAt ?? null}
            canMarkComplete={
              workspace.mentorship.mentorId === session.user.id ||
              (session.user.roles ?? []).includes("ADMIN")
            }
          />
        </>
      )}

      {!workspace.mentorship && !workspace.intakePlanLaunch ? (
        <section className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--gray-300, #d1d5db)" }}>
          <strong>No active mentorship yet</strong>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            You can still review this student&apos;s history, requests, and progress signals below. Session logging, action items, and monthly reviews stay disabled until an active mentor or support circle is assigned.
          </p>
        </section>
      ) : null}

      {!workspace.mentorship && workspace.intakePlanLaunch ? (
        <section className="card" style={{ marginBottom: 24, borderLeft: "4px solid #0f766e" }}>
          <strong>Pre-assignment intake plan is live</strong>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            The chapter launched an early support plan before assigning a long-term mentor. Action items are active now, while session logging stays locked until the formal mentorship record exists.
          </p>
        </section>
      ) : null}

      {isSelfWorkspace ? (
        <section className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--ypp-purple)" }}>
          <strong>Your self-view workspace</strong>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            This view lets you see the full support picture for yourself, but mentor-only actions stay hidden so you cannot accidentally act on your own record.
          </p>
        </section>
      ) : null}

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

      <div className="grid three" style={{ marginBottom: 24 }}>
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
          <div className="section-title">Review Status</div>
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

        <section className="card">
          <div className="section-title">Recognition Snapshot</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <strong>Student wins:</strong> {recognition.badgeCount} badge
              {recognition.badgeCount === 1 ? "" : "s"}, {recognition.awardCount} award
              {recognition.awardCount === 1 ? "" : "s"}, {recognition.certificateCount} certificate
              {recognition.certificateCount === 1 ? "" : "s"}
            </div>
            <div>
              <strong>Rewards waiting:</strong> {recognition.pendingRewardsCount} reward
              {recognition.pendingRewardsCount === 1 ? "" : "s"} and {recognition.unopenedBoxesCount} unopened prize box
              {recognition.unopenedBoxesCount === 1 ? "" : "es"}
            </div>
            <div>
              <strong>Program tier:</strong>{" "}
              {recognition.currentTier ? formatEnum(recognition.currentTier) : "No tier yet"} ·{" "}
              {recognition.totalPoints} point{recognition.totalPoints === 1 ? "" : "s"}
            </div>
            <div>
              <strong>Pending nominations:</strong> {recognition.pendingProgramNominationsCount}
            </div>
            {(recognition.latestBadgeName || recognition.latestAwardName || recognition.latestCertificateTitle) ? (
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Latest: {recognition.latestBadgeName ?? recognition.latestAwardName ?? recognition.latestCertificateTitle}
              </p>
            ) : (
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Recognition context lives here so mentors can spot momentum without leaving the workspace.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Support Circle Roster</div>
        {workspace.circleMembers.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No mentor or support-circle members are assigned yet. The action plan can still move while the chapter decides who should step in first.
          </p>
        ) : (
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
        )}
      </section>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="section-title">Schedule or Log a Session</div>
          {canScheduleSessions ? (
            <form action={createMentorshipSession} className="form-grid">
              <input type="hidden" name="menteeId" value={workspace.mentee.id} />
              <div className="form-row">
                <FieldLabel
                  label="Session type"
                  help={{
                    title: "Session Type",
                    guidance:
                      "This tells the system what kind of support moment you are recording, like a kickoff, a routine check-in, or a review meeting.",
                    example: "Use 'Check-in' for normal progress conversations and 'Review prep' when you are preparing for a formal monthly review.",
                  }}
                />
                <select name="type" className="input" defaultValue="CHECK_IN">
                  <option value="KICKOFF">Kickoff</option>
                  <option value="CHECK_IN">Check-in</option>
                  <option value="REVIEW_PREP">Review prep</option>
                  <option value="QUARTERLY_REVIEW">Quarterly review</option>
                  <option value="OFFICE_HOURS">Office hours</option>
                </select>
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Title"
                  help={{
                    title: "Session Title",
                    guidance:
                      "Give the meeting a simple name so everyone can recognize it later in the timeline.",
                    example: "April momentum check-in",
                  }}
                />
                <input name="title" className="input" placeholder="April momentum check-in" />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Scheduled at"
                  help={{
                    title: "Scheduled At",
                    guidance:
                      "This is the date and time the conversation will happen or already happened.",
                    example: "Set the real meeting time so the timeline and upcoming-session counts stay accurate.",
                  }}
                />
                <input type="datetime-local" name="scheduledAt" className="input" required />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Meeting link (optional)"
                  help={{
                    title: "Meeting Link",
                    guidance:
                      "If this session used Zoom, Google Meet, or another online room, put the link here so the session record matches reality.",
                    example: "https://meet.google.com/abc-defg-hij",
                  }}
                />
                <input type="url" name="meetingLink" className="input" placeholder="https://meet.google.com/..." />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Length (minutes)"
                  help={{
                    title: "Session Length",
                    guidance:
                      "This records how long the session is expected to be or how long it lasted.",
                    example: "30 for a normal check-in, 60 for a deeper review conversation.",
                  }}
                />
                <input type="number" name="durationMinutes" className="input" min="15" step="15" defaultValue="30" />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Why manual override?"
                  help={{
                    title: "Manual Override Reason",
                    guidance:
                      "Write why you are creating this session here instead of using the normal scheduling page. This keeps the audit trail clear for everyone.",
                    example: "Family emergency required a special one-off time",
                  }}
                />
                <input
                  name="schedulingOverrideReason"
                  className="input"
                  placeholder="Explain why this was booked or logged manually"
                />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Agenda"
                  help={{
                    title: "Agenda",
                    guidance:
                      "This is the plan for the session. It helps mentors and mentees arrive ready for the same conversation.",
                    example: "Review reflection, check project blockers, choose one next action.",
                  }}
                />
                <textarea name="agenda" className="input" rows={3} placeholder="What will we cover?" />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Notes (optional)"
                  help={{
                    title: "Session Notes",
                    guidance:
                      "Use notes to capture what actually happened, especially if you are logging a session after the fact.",
                    example: "Student finished draft one, needs examples before next meeting.",
                  }}
                />
                <textarea name="notes" className="input" rows={3} placeholder="Add notes if this session is already complete." />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Mark complete immediately"
                  help={{
                    title: "Mark Complete Immediately",
                    guidance:
                      "This decides whether the form creates an upcoming session or instantly records it as already finished.",
                    example: "Choose 'No' to schedule a future meeting. Choose 'Yes' if the session already happened and you are logging it now.",
                  }}
                />
                <select name="completedNow" className="input" defaultValue="false">
                  <option value="false">No, schedule it</option>
                  <option value="true">Yes, log it now</option>
                </select>
              </div>
              <button type="submit" className="button primary small">
                Save Session
              </button>
            </form>
          ) : (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              {workspace.mentorship
                ? "Only mentors and support-circle members can log sessions from this workspace."
                : "Assign an active mentor before sessions can be scheduled or logged here."}
            </p>
          )}
        </section>

        <section className="card">
          <div className="section-title">Create an Action Item</div>
          {canManageActionPlan ? (
            <form action={createMentorshipActionItem} className="form-grid">
              <input type="hidden" name="menteeId" value={workspace.mentee.id} />
              <div className="form-row">
                <FieldLabel
                  label="Title"
                  help={{
                    title: "Action Item Title",
                    guidance:
                      "Write the next step as one small job that someone can clearly finish.",
                    example: "Draft the project pitch outline",
                  }}
                />
                <input name="title" className="input" placeholder="Draft the project pitch outline" required />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Owner"
                  help={{
                    title: "Action Item Owner",
                    guidance:
                      "This says who is mainly responsible for completing the next step.",
                    example: "Pick the mentee for independent work, a mentor for follow-up, or leave it shared when more than one person owns it.",
                  }}
                />
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
                <FieldLabel
                  label="Due date"
                  help={{
                    title: "Due Date",
                    guidance:
                      "This is the target day the next step should be done by.",
                    example: "Leave it blank if the item is ongoing, or set a date if you want the system to track overdue work.",
                  }}
                />
                <input type="date" name="dueAt" className="input" />
              </div>
              <div className="form-row">
                <FieldLabel
                  label="Details"
                  help={{
                    title: "Action Item Details",
                    guidance:
                      "Describe what good completion looks like so the owner knows exactly what success means.",
                    example: "Bring a 5-slide draft and one sentence for the main pitch message.",
                  }}
                />
                <textarea name="details" className="input" rows={4} placeholder="What does success look like for this next step?" />
              </div>
              <button type="submit" className="button primary small">
                Add Action Item
              </button>
            </form>
          ) : (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              {workspace.mentorship || workspace.intakePlanLaunch
                ? "Only mentors, chapter leaders, and support-circle members can create action items from this workspace."
                : "Launch an intake plan or assign an active mentor before action items can be created here."}
            </p>
          )}
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
