import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelApplicationInterviewSlot,
  chapterMakeDecision,
  closeChapterPosition,
  markApplicationInterviewCompleted,
  postApplicationInterviewSlot,
  reopenChapterPosition,
  setApplicationInterviewReadiness,
  updatePositionVisibility,
} from "@/lib/application-actions";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function toDateTimeLocal(value: Date) {
  const local = new Date(value);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export default async function ChapterRecruitingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      chapterId: true,
      chapter: { select: { id: true, name: true } },
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const roles = user.roles.map((role) => role.role);
  const canAccess = roles.includes("CHAPTER_LEAD") || roles.includes("ADMIN");

  if (!canAccess) {
    redirect("/");
  }

  if (!user.chapterId) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Chapter Recruiting</p>
            <h1 className="page-title">Chapter Recruiting Command Center</h1>
          </div>
        </div>
        <div className="card">
          <p className="empty">No chapter assignment found for your account.</p>
        </div>
      </div>
    );
  }

  const chapterId = user.chapterId;

  const [positions, applications, interviewQueue] = await Promise.all([
    prisma.position.findMany({
      where: { chapterId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.application.findMany({
      where: {
        position: { chapterId },
      },
      include: {
        applicant: {
          select: { id: true, name: true, email: true },
        },
        position: {
          select: {
            id: true,
            title: true,
            type: true,
            interviewRequired: true,
          },
        },
        interviewSlots: {
          orderBy: { scheduledAt: "asc" },
        },
        interviewNotes: {
          orderBy: { createdAt: "desc" },
        },
        decision: {
          select: { accepted: true, decidedAt: true },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.interviewSlot.findMany({
      where: {
        application: { position: { chapterId } },
        status: { in: ["POSTED", "CONFIRMED"] },
      },
      include: {
        application: {
          include: {
            applicant: {
              select: { name: true, email: true },
            },
            position: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const statusCount = {
    submitted: applications.filter((app) => app.status === "SUBMITTED").length,
    inReview: applications.filter((app) => app.status === "UNDER_REVIEW").length,
    interviewing: applications.filter((app) => app.status === "INTERVIEW_SCHEDULED").length,
    interviewComplete: applications.filter((app) => app.status === "INTERVIEW_COMPLETED").length,
    accepted: applications.filter((app) => app.status === "ACCEPTED").length,
    rejected: applications.filter((app) => app.status === "REJECTED").length,
  };

  const decisionQueue = applications.filter(
    (app) =>
      !app.decision &&
      app.status !== "WITHDRAWN" &&
      (app.status === "INTERVIEW_COMPLETED" || !app.position.interviewRequired)
  );

  const defaultInterviewDate = toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chapter Recruiting</p>
          <h1 className="page-title">Recruiting Command Center</h1>
          <p className="page-subtitle">{user.chapter?.name}</p>
        </div>
        <Link href="/chapter/recruiting/positions/new" className="button small" style={{ textDecoration: "none" }}>
          + New Opening
        </Link>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{positions.filter((position) => position.isOpen).length}</div>
          <div className="kpi-label">Open Positions</div>
        </div>
        <div className="card">
          <div className="kpi">{statusCount.submitted + statusCount.inReview}</div>
          <div className="kpi-label">New Candidates</div>
        </div>
        <div className="card">
          <div className="kpi">{interviewQueue.length}</div>
          <div className="kpi-label">Interview Queue</div>
        </div>
        <div className="card">
          <div className="kpi">{decisionQueue.length}</div>
          <div className="kpi-label">Decision Queue</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Open Positions</h3>
        {positions.length === 0 ? (
          <p className="empty">No chapter positions yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {positions.map((position) => (
              <div key={position.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{position.title}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      {position.type.replace(/_/g, " ")} · {position.visibility.replace(/_/g, " ")} · {position.interviewRequired ? "Interview Required" : "Interview Optional"}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Deadline: {formatDate(position.applicationDeadline)} · Start: {formatDate(position.targetStartDate)} · Applications: {position._count.applications}
                    </p>
                  </div>
                  <span className={`pill ${position.isOpen ? "pill-success" : "pill-declined"}`}>
                    {position.isOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/chapter/recruiting/positions/${position.id}/edit`} className="button small outline" style={{ textDecoration: "none" }}>
                    Edit Opening
                  </Link>
                  {position.isOpen ? (
                    <form action={closeChapterPosition}>
                      <input type="hidden" name="positionId" value={position.id} />
                      <button type="submit" className="button small ghost">Close</button>
                    </form>
                  ) : (
                    <form action={reopenChapterPosition}>
                      <input type="hidden" name="positionId" value={position.id} />
                      <button type="submit" className="button small">Reopen</button>
                    </form>
                  )}

                  <form action={updatePositionVisibility}>
                    <input type="hidden" name="positionId" value={position.id} />
                    <select className="input" name="visibility" defaultValue={position.visibility} style={{ minWidth: 180 }}>
                      <option value="CHAPTER_ONLY">Chapter Only</option>
                      <option value="NETWORK_WIDE">Network Wide</option>
                      <option value="PUBLIC">Public</option>
                    </select>
                    <button type="submit" className="button small outline" style={{ marginLeft: 8 }}>
                      Update Visibility
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Candidate Pipeline</h3>
        <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13 }}>
          Submitted: {statusCount.submitted} · In Review: {statusCount.inReview} · Interviewing: {statusCount.interviewing} · Interview Complete: {statusCount.interviewComplete} · Accepted: {statusCount.accepted} · Rejected: {statusCount.rejected}
        </p>

        {applications.length === 0 ? (
          <p className="empty">No applications yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Position</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Interview</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const nextSlot = app.interviewSlots.find((slot) => slot.status === "POSTED" || slot.status === "CONFIRMED");
                const hasRecommendation = app.interviewNotes.some((note) => note.recommendation !== null);
                return (
                  <tr key={app.id}>
                    <td>
                      <strong>{app.applicant.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{app.applicant.email}</div>
                    </td>
                    <td>{app.position.title}</td>
                    <td><span className="pill">{app.status.replace(/_/g, " ")}</span></td>
                    <td>{new Date(app.submittedAt).toLocaleDateString()}</td>
                    <td>
                      {nextSlot ? formatDate(nextSlot.scheduledAt) : "Not scheduled"}
                      {hasRecommendation ? <div style={{ fontSize: 11, color: "#166534" }}>Has recommendation</div> : null}
                    </td>
                    <td>
                      <Link href={`/applications/${app.id}`} className="button small" style={{ textDecoration: "none" }}>
                        Open Workspace
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Interview Queue</h3>
        {interviewQueue.length === 0 ? (
          <p className="empty">No interview slots waiting on action.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {interviewQueue.map((slot) => (
              <div key={slot.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{slot.application.applicant.name} · {slot.application.position.title}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                  {slot.status.replace(/_/g, " ")} · {formatDate(slot.scheduledAt)} · {slot.duration} min
                </p>
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/applications/${slot.applicationId}`} className="button small outline" style={{ textDecoration: "none" }}>
                    Open Application
                  </Link>
                  {slot.status === "CONFIRMED" ? (
                    <form action={markApplicationInterviewCompleted}>
                      <input type="hidden" name="slotId" value={slot.id} />
                      <button type="submit" className="button small">Mark Completed</button>
                    </form>
                  ) : null}
                  <form action={cancelApplicationInterviewSlot}>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <button type="submit" className="button small ghost">Cancel Slot</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Post Interview Slot</h4>
          <form action={postApplicationInterviewSlot} className="form-grid">
            <div className="grid three">
              <label className="form-row">
                Application
                <select className="input" name="applicationId" required>
                  <option value="">Select application</option>
                  {applications
                    .filter((app) => !FINAL_STATUSES.has(app.status))
                    .map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.applicant.name} - {app.position.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className="form-row">
                Scheduled At
                <input type="datetime-local" className="input" name="scheduledAt" defaultValue={defaultInterviewDate} required />
              </label>
              <label className="form-row">
                Duration (min)
                <input type="number" className="input" name="duration" min={15} max={180} defaultValue={30} />
              </label>
            </div>
            <label className="form-row">
              Meeting Link (optional)
              <input type="url" className="input" name="meetingLink" placeholder="https://..." />
            </label>
            <button type="submit" className="button small">Post Slot</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>Decision Queue</h3>
        {decisionQueue.length === 0 ? (
          <p className="empty">No candidates ready for final decision.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {decisionQueue.map((app) => {
              const hasRecommendation = app.interviewNotes.some((note) => note.recommendation !== null);
              const hasCompletedSlot = app.interviewSlots.some((slot) => slot.status === "COMPLETED");
              const decisionReady = !app.position.interviewRequired || (hasRecommendation && hasCompletedSlot);

              return (
                <div key={app.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{app.applicant.name} · {app.position.title}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                    Interview done: {hasCompletedSlot ? "Yes" : "No"} · Recommendation: {hasRecommendation ? "Yes" : "No"}
                  </p>
                  {!decisionReady ? (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b45309" }}>
                      Blocked: complete interview and add recommendation note before decision.
                    </p>
                  ) : null}

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <form action={setApplicationInterviewReadiness}>
                      <input type="hidden" name="applicationId" value={app.id} />
                      <button type="submit" className="button small outline">Sync Readiness</button>
                    </form>
                    <Link href={`/applications/${app.id}`} className="button small outline" style={{ textDecoration: "none" }}>
                      Open Workspace
                    </Link>
                  </div>

                  <form action={chapterMakeDecision} className="form-grid" style={{ marginTop: 10 }}>
                    <input type="hidden" name="applicationId" value={app.id} />
                    <div className="grid two">
                      <label className="form-row">
                        Decision
                        <select name="accepted" className="input" defaultValue="true">
                          <option value="true">Accept Candidate</option>
                          <option value="false">Reject Candidate</option>
                        </select>
                      </label>
                      <label className="form-row">
                        Decision Notes
                        <input name="notes" className="input" placeholder="Optional context" />
                      </label>
                    </div>
                    <button type="submit" className="button small" disabled={!decisionReady}>
                      Submit Decision
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const FINAL_STATUSES = new Set(["ACCEPTED", "REJECTED", "WITHDRAWN"]);
