import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelApplicationInterviewSlot,
  chapterMakeDecision,
  confirmInterviewSlot,
  makeDecision,
  markApplicationInterviewCompleted,
  postApplicationInterviewSlot,
  saveStructuredInterviewNote,
  setApplicationInterviewReadiness,
  updateApplicationStatus,
} from "@/lib/application-actions";
import { ApplicationStatus } from "@prisma/client";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusPillClass(status: string) {
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
}

function interviewSlotPill(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "pill-success";
    case "COMPLETED":
      return "pill-success";
    case "CANCELLED":
      return "pill-declined";
    default:
      return "";
  }
}

function toDateTimeLocal(value: Date) {
  const local = new Date(value);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

type TimelineStep = {
  label: string;
  complete: boolean;
  detail: string;
};

export default async function ApplicationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      chapterId: true,
      roles: { select: { role: true } },
    },
  });

  if (!currentUser) {
    redirect("/login");
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          primaryRole: true,
        },
      },
      position: {
        include: {
          chapter: {
            select: { id: true, name: true, city: true, region: true },
          },
        },
      },
      interviewSlots: {
        include: {
          interviewer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      },
      interviewNotes: {
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      decision: {
        include: {
          decidedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!application) {
    notFound();
  }

  const roles = currentUser.roles.map((role) => role.role);
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const isApplicant = application.applicantId === currentUser.id;
  const isChapterReviewer =
    isChapterLead &&
    !!application.position.chapterId &&
    currentUser.chapterId === application.position.chapterId;
  const canReview = isAdmin || isChapterReviewer;

  if (!isApplicant && !canReview) {
    redirect("/applications");
  }

  const isClosedApplication = ["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(application.status);
  const reviewStatuses: ApplicationStatus[] = [
    "UNDER_REVIEW",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
  ];

  const firstPostedSlot = application.interviewSlots.find(
    (slot) => slot.status === "POSTED" || slot.status === "CONFIRMED" || slot.status === "COMPLETED"
  );
  const confirmedSlot = application.interviewSlots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = application.interviewSlots.find((slot) => slot.status === "COMPLETED");
  const hasCompletedInterview =
    application.interviewSlots.some((slot) => slot.status === "COMPLETED") || Boolean(completedSlot);
  const hasRecommendation = application.interviewNotes.some((note) => note.recommendation !== null);

  const decisionBlockers: string[] = [];
  if (application.position.interviewRequired && !hasCompletedInterview) {
    decisionBlockers.push("Interview must be marked completed.");
  }
  if (application.position.interviewRequired && !hasRecommendation) {
    decisionBlockers.push("At least one interview note must include a recommendation.");
  }

  const canChapterDecideRole = ["INSTRUCTOR", "MENTOR", "STAFF", "CHAPTER_PRESIDENT"].includes(
    application.position.type
  );
  const canShowChapterDecision = isChapterReviewer && canChapterDecideRole;
  const canShowAdminDecision = isAdmin;

  const canSubmitDecision =
    !application.decision &&
    application.status !== "WITHDRAWN" &&
    decisionBlockers.length === 0;

  const defaultInterviewDate = toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const timeline: TimelineStep[] = [
    {
      label: "Application Submitted",
      complete: true,
      detail: new Date(application.submittedAt).toLocaleString(),
    },
    {
      label: "Interview Scheduled",
      complete: Boolean(firstPostedSlot),
      detail: firstPostedSlot ? new Date(firstPostedSlot.scheduledAt).toLocaleString() : "Not scheduled",
    },
    {
      label: "Interview Confirmed",
      complete: Boolean(confirmedSlot) || Boolean(completedSlot),
      detail: confirmedSlot?.confirmedAt
        ? new Date(confirmedSlot.confirmedAt).toLocaleString()
        : completedSlot
          ? "Completed"
          : "Awaiting confirmation",
    },
    {
      label: "Interview Completed",
      complete: hasCompletedInterview,
      detail: completedSlot?.completedAt
        ? new Date(completedSlot.completedAt).toLocaleString()
        : hasCompletedInterview
          ? "Completed"
          : "Pending",
    },
    {
      label: "Decision Ready",
      complete: decisionBlockers.length === 0,
      detail: decisionBlockers.length === 0 ? "Ready for final decision" : decisionBlockers[0],
    },
    {
      label: "Final Decision",
      complete: Boolean(application.decision),
      detail: application.decision
        ? `${application.decision.accepted ? "Accepted" : "Rejected"} on ${new Date(
            application.decision.decidedAt
          ).toLocaleString()}`
        : "Pending",
    },
  ];

  const backHref = canReview
    ? isAdmin
      ? "/admin/applications"
      : "/chapter/recruiting"
    : "/applications";

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={backHref} style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back
          </Link>
          <h1 className="page-title">Application Workspace</h1>
          <p className="page-subtitle">
            {application.position.title} {"\u00B7"} {application.applicant.name}
          </p>
        </div>
        <span className={`pill ${statusPillClass(application.status)}`}>
          {formatStatus(application.status)}
        </span>
      </div>

      <div className="grid two">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Interview Status Timeline</div>
            <div style={{ display: "grid", gap: 10 }}>
              {timeline.map((step) => (
                <div
                  key={step.label}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 10,
                    background: step.complete ? "#f0fdf4" : "var(--surface-alt)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                    {step.complete ? "✓" : "○"} {step.label}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>{step.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Candidate Profile</div>
            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <div>
                <strong>Name:</strong> {application.applicant.name}
              </div>
              <div>
                <strong>Email:</strong> {application.applicant.email}
              </div>
              <div>
                <strong>Phone:</strong> {application.applicant.phone || "Not provided"}
              </div>
              <div>
                <strong>Applied:</strong> {new Date(application.submittedAt).toLocaleString()}
              </div>
              <div>
                <strong>Position:</strong> {application.position.title} ({formatStatus(application.position.type)})
              </div>
              <div>
                <strong>Chapter:</strong> {application.position.chapter?.name || "Global"}
              </div>
              <div>
                <strong>Interview Policy:</strong>{" "}
                {application.position.interviewRequired ? "Interview required" : "Interview optional"}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">Application Materials</div>
            {application.resumeUrl ? (
              <p style={{ marginTop: 0 }}>
                <a href={application.resumeUrl} target="_blank" rel="noreferrer" className="link">
                  Open Resume
                </a>
              </p>
            ) : (
              <p style={{ color: "var(--muted)", marginTop: 0 }}>No resume link provided.</p>
            )}

            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14 }}>Cover Letter</strong>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                {application.coverLetter || "No cover letter provided."}
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14 }}>Additional Materials</strong>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                {application.additionalMaterials || "No additional materials provided."}
              </p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">Interview Slots</div>
            {application.interviewSlots.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No interview slots scheduled yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {application.interviewSlots.map((slot) => (
                  <div
                    key={slot.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                      background: "var(--surface-alt)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div>
                        <strong>{new Date(slot.scheduledAt).toLocaleString()}</strong>
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                          Duration: {slot.duration} minutes
                          {slot.interviewer?.name ? ` · Interviewer: ${slot.interviewer.name}` : ""}
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                          Confirmed: {slot.confirmedAt ? new Date(slot.confirmedAt).toLocaleString() : "-"} · Completed:{" "}
                          {slot.completedAt ? new Date(slot.completedAt).toLocaleString() : "-"}
                        </div>
                      </div>
                      <span className={`pill ${interviewSlotPill(slot.status)}`}>{formatStatus(slot.status)}</span>
                    </div>

                    {slot.meetingLink ? (
                      <div style={{ marginTop: 8 }}>
                        <a href={slot.meetingLink} target="_blank" rel="noreferrer" className="link">
                          Join Meeting
                        </a>
                      </div>
                    ) : null}

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isApplicant && slot.status === "POSTED" && !isClosedApplication ? (
                        <form action={confirmInterviewSlot}>
                          <input type="hidden" name="slotId" value={slot.id} />
                          <button type="submit" className="button small">
                            Confirm This Slot
                          </button>
                        </form>
                      ) : null}

                      {canReview && slot.status === "CONFIRMED" && !isClosedApplication ? (
                        <form action={markApplicationInterviewCompleted}>
                          <input type="hidden" name="slotId" value={slot.id} />
                          <button type="submit" className="button small">
                            Mark Completed
                          </button>
                        </form>
                      ) : null}

                      {canReview && slot.status !== "COMPLETED" && slot.status !== "CANCELLED" && !isClosedApplication ? (
                        <form action={cancelApplicationInterviewSlot}>
                          <input type="hidden" name="slotId" value={slot.id} />
                          <button type="submit" className="button small ghost">
                            Cancel Slot
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {application.decision ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title">Final Decision</div>
              <p style={{ marginTop: 0 }}>
                <span className={`pill ${application.decision.accepted ? "pill-success" : "pill-declined"}`}>
                  {application.decision.accepted ? "Accepted" : "Rejected"}
                </span>
              </p>
              {application.decision.notes ? (
                <p style={{ whiteSpace: "pre-wrap" }}>{application.decision.notes}</p>
              ) : null}
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 0 }}>
                Decided by {application.decision.decidedBy.name} on {new Date(application.decision.decidedAt).toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>

        <div>
          {canReview ? (
            <>
              <div className="card">
                <div className="section-title">Decision Eligibility</div>
                {application.position.type === "GLOBAL_ADMIN" && !isAdmin ? (
                  <p style={{ marginTop: 0, color: "#b45309" }}>
                    This role type is admin-only for final decisions.
                  </p>
                ) : null}
                {decisionBlockers.length === 0 ? (
                  <p style={{ marginTop: 0, color: "#166534" }}>
                    This candidate is ready for a final decision.
                  </p>
                ) : (
                  <div style={{ marginTop: 0 }}>
                    <p style={{ marginTop: 0, marginBottom: 8, color: "#b45309" }}>Decision is blocked:</p>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {decisionBlockers.map((blocker) => (
                        <li key={blocker} style={{ fontSize: 14, marginBottom: 4 }}>
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <form action={setApplicationInterviewReadiness} style={{ marginTop: 12 }}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <button type="submit" className="button small outline" disabled={isClosedApplication}>
                    Sync Interview Readiness
                  </button>
                </form>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <div className="section-title">Reviewer Actions</div>

                <form action={updateApplicationStatus} className="form-grid" style={{ marginBottom: 18 }}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <div className="form-row">
                    <label>Status</label>
                    <select
                      name="status"
                      className="input"
                      defaultValue={reviewStatuses.includes(application.status) ? application.status : "UNDER_REVIEW"}
                      disabled={isClosedApplication}
                    >
                      {reviewStatuses.map((status) => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="button small" disabled={isClosedApplication}>
                    Update Status
                  </button>
                </form>

                <form action={postApplicationInterviewSlot} className="form-grid" style={{ marginBottom: 18 }}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <div className="form-row">
                    <label>Post Interview Slot</label>
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      className="input"
                      defaultValue={defaultInterviewDate}
                      required
                      disabled={isClosedApplication}
                    />
                  </div>
                  <div className="form-row">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      name="duration"
                      className="input"
                      defaultValue={30}
                      min={15}
                      max={180}
                      disabled={isClosedApplication}
                    />
                  </div>
                  <div className="form-row">
                    <label>Meeting Link (optional)</label>
                    <input
                      type="url"
                      name="meetingLink"
                      className="input"
                      placeholder="https://zoom.us/..."
                      disabled={isClosedApplication}
                    />
                  </div>
                  <button type="submit" className="button small" disabled={isClosedApplication}>
                    Post Interview Slot
                  </button>
                </form>

                <form action={saveStructuredInterviewNote} className="form-grid">
                  <input type="hidden" name="applicationId" value={application.id} />

                  <div className="form-row">
                    <label>Interview Note Summary</label>
                    <textarea
                      name="content"
                      className="input"
                      rows={4}
                      placeholder="Candidate summary, communication signals, and overall interview takeaways..."
                      required
                      disabled={isClosedApplication}
                    />
                  </div>

                  <div className="grid two">
                    <label className="form-row">
                      Recommendation
                      <select name="recommendation" className="input" defaultValue="" disabled={isClosedApplication}>
                        <option value="">No recommendation yet</option>
                        <option value="STRONG_YES">Strong Yes</option>
                        <option value="YES">Yes</option>
                        <option value="MAYBE">Maybe</option>
                        <option value="NO">No</option>
                      </select>
                    </label>
                    <label className="form-row">
                      Rating (optional)
                      <select name="rating" className="input" defaultValue="" disabled={isClosedApplication}>
                        <option value="">No rating</option>
                        {[1, 2, 3, 4, 5].map((r) => (
                          <option key={r} value={r}>
                            {r}/5
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="form-row">
                    Strengths
                    <textarea
                      name="strengths"
                      className="input"
                      rows={3}
                      placeholder="Observable strengths from interview responses..."
                      disabled={isClosedApplication}
                    />
                  </label>

                  <label className="form-row">
                    Concerns
                    <textarea
                      name="concerns"
                      className="input"
                      rows={3}
                      placeholder="Risks, skill gaps, or follow-up concerns..."
                      disabled={isClosedApplication}
                    />
                  </label>

                  <label className="form-row">
                    Next Step Suggestion
                    <textarea
                      name="nextStepSuggestion"
                      className="input"
                      rows={2}
                      placeholder="Recommend next action for candidate and hiring team..."
                      disabled={isClosedApplication}
                    />
                  </label>

                  <button type="submit" className="button small" disabled={isClosedApplication}>
                    Save Structured Interview Note
                  </button>
                </form>
              </div>

              {canShowAdminDecision && !application.decision && application.status !== "WITHDRAWN" ? (
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="section-title">Final Decision (Admin)</div>
                  <form action={makeDecision} className="form-grid">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <div className="form-row">
                      <label>Decision</label>
                      <select name="accepted" className="input" defaultValue="true">
                        <option value="true">Accept Candidate</option>
                        <option value="false">Reject Candidate</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Decision Notes</label>
                      <textarea
                        name="notes"
                        className="input"
                        rows={4}
                        placeholder="Add rationale and follow-up instructions..."
                      />
                    </div>
                    <button type="submit" className="button">
                      Submit Final Decision
                    </button>
                  </form>
                </div>
              ) : null}

              {canShowChapterDecision && !application.decision && application.status !== "WITHDRAWN" ? (
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="section-title">Final Decision (Chapter)</div>
                  <form action={chapterMakeDecision} className="form-grid">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <div className="form-row">
                      <label>Decision</label>
                      <select name="accepted" className="input" defaultValue="true">
                        <option value="true">Accept Candidate</option>
                        <option value="false">Reject Candidate</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Decision Notes</label>
                      <textarea
                        name="notes"
                        className="input"
                        rows={3}
                        placeholder="Context for acceptance/rejection..."
                      />
                    </div>
                    <button type="submit" className="button" disabled={!canSubmitDecision}>
                      Submit Chapter Decision
                    </button>
                  </form>
                </div>
              ) : null}

              <div className="card" style={{ marginTop: 16 }}>
                <div className="section-title">Interview Notes</div>
                {application.interviewNotes.length === 0 ? (
                  <p style={{ color: "var(--muted)" }}>No notes recorded yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {application.interviewNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong>{note.author.name}</strong>
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {note.rating !== null ? <span className="pill">{note.rating}/5</span> : null}
                          {note.recommendation ? (
                            <span className="pill pill-pathway">Recommendation: {formatStatus(note.recommendation)}</span>
                          ) : null}
                        </div>
                        <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{note.content}</p>
                        {note.strengths ? (
                          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                            <strong>Strengths:</strong> {note.strengths}
                          </p>
                        ) : null}
                        {note.concerns ? (
                          <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                            <strong>Concerns:</strong> {note.concerns}
                          </p>
                        ) : null}
                        {note.nextStepSuggestion ? (
                          <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                            <strong>Next Step:</strong> {note.nextStepSuggestion}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card">
              <div className="section-title">Application Updates</div>
              <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                Reviewer notes are internal. You will receive interview scheduling updates and final decisions here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
