import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addInterviewNote,
  confirmInterviewSlot,
  makeDecision,
  scheduleInterview,
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

  const isAdmin = currentUser.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = currentUser.roles.some((r) => r.role === "CHAPTER_LEAD");
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

  const defaultInterviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const backHref = canReview
    ? isAdmin
      ? "/admin/applications"
      : "/chapter/applicants"
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
                <strong>Applied:</strong>{" "}
                {new Date(application.submittedAt).toLocaleString()}
              </div>
              <div>
                <strong>Position:</strong> {application.position.title} (
                {formatStatus(application.position.type)})
              </div>
              <div>
                <strong>Chapter:</strong> {application.position.chapter?.name || "Global"}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">Application Materials</div>
            {application.resumeUrl ? (
              <p style={{ marginTop: 0 }}>
                <a
                  href={application.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
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
            <div className="section-title">Interview Schedule</div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong>{new Date(slot.scheduledAt).toLocaleString()}</strong>
                      <span className={`pill ${slot.isConfirmed ? "pill-success" : ""}`}>
                        {slot.isConfirmed ? "Confirmed" : "Awaiting Confirmation"}
                      </span>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                      Duration: {slot.duration} minutes
                    </div>
                    {slot.meetingLink && (
                      <div style={{ marginTop: 8 }}>
                        <a
                          href={slot.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="link"
                        >
                          Join Meeting
                        </a>
                      </div>
                    )}

                    {isApplicant && !slot.isConfirmed && !isClosedApplication && (
                      <form action={confirmInterviewSlot} style={{ marginTop: 10 }}>
                        <input type="hidden" name="slotId" value={slot.id} />
                        <button type="submit" className="button small">
                          Confirm This Slot
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {application.decision && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title">Final Decision</div>
              <p style={{ marginTop: 0 }}>
                <span className={`pill ${application.decision.accepted ? "pill-success" : "pill-declined"}`}>
                  {application.decision.accepted ? "Accepted" : "Rejected"}
                </span>
              </p>
              {application.decision.notes && (
                <p style={{ whiteSpace: "pre-wrap" }}>{application.decision.notes}</p>
              )}
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 0 }}>
                Decided by {application.decision.decidedBy.name} on{" "}
                {new Date(application.decision.decidedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div>
          {canReview ? (
            <>
              <div className="card">
                <div className="section-title">Reviewer Actions</div>

                <form action={updateApplicationStatus} className="form-grid" style={{ marginBottom: 18 }}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <div className="form-row">
                    <label>Status</label>
                    <select
                      name="status"
                      className="input"
                      defaultValue={
                        reviewStatuses.includes(application.status)
                          ? application.status
                          : "UNDER_REVIEW"
                      }
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

                <form action={scheduleInterview} className="form-grid" style={{ marginBottom: 18 }}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <div className="form-row">
                    <label>Schedule Interview</label>
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
                    Add Interview Slot
                  </button>
                </form>

                <form action={addInterviewNote} className="form-grid">
                  <input type="hidden" name="applicationId" value={application.id} />
                  <div className="form-row">
                    <label>Interview Note</label>
                    <textarea
                      name="content"
                      className="input"
                      rows={5}
                      placeholder="Capture strengths, concerns, and next steps..."
                      required
                      disabled={isClosedApplication}
                    />
                  </div>
                  <div className="form-row">
                    <label>Rating (optional)</label>
                    <select name="rating" className="input" defaultValue="" disabled={isClosedApplication}>
                      <option value="">No rating</option>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r}>
                          {r}/5
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="button small" disabled={isClosedApplication}>
                    Save Interview Note
                  </button>
                </form>
              </div>

              {isAdmin && !application.decision && application.status !== "WITHDRAWN" && (
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
              )}

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
                        {note.rating !== null && (
                          <div style={{ marginTop: 6 }}>
                            <span className="pill">{note.rating}/5</span>
                          </div>
                        )}
                        <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
                          {note.content}
                        </p>
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
                Interview reviewer notes are internal. You will continue receiving interview
                scheduling updates and final decisions here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
