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
import ApplicationProgressStepper from "@/components/application-progress-stepper";

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

type ChapterProposalMetadata = {
  kind: "CHAPTER_PROPOSAL_V1";
  chapterName: string;
  city?: string;
  region?: string;
  partnerSchool?: string;
  chapterVision?: string;
  launchPlan?: string;
  recruitmentPlan?: string;
  additionalContext?: string;
};

function parseChapterProposalMetadata(raw: string | null | undefined): ChapterProposalMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChapterProposalMetadata>;
    if (parsed.kind !== "CHAPTER_PROPOSAL_V1" || !parsed.chapterName) {
      return null;
    }
    return {
      kind: "CHAPTER_PROPOSAL_V1",
      chapterName: parsed.chapterName,
      city: parsed.city,
      region: parsed.region,
      partnerSchool: parsed.partnerSchool,
      chapterVision: parsed.chapterVision,
      launchPlan: parsed.launchPlan,
      recruitmentPlan: parsed.recruitmentPlan,
      additionalContext: parsed.additionalContext,
    };
  } catch {
    return null;
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

  const interviewRequired = application.position.interviewRequired;

  const firstPostedSlot = application.interviewSlots.find(
    (slot) => slot.status === "POSTED" || slot.status === "CONFIRMED" || slot.status === "COMPLETED"
  );
  const confirmedSlot = application.interviewSlots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = application.interviewSlots.find((slot) => slot.status === "COMPLETED");
  const hasCompletedInterview =
    application.interviewSlots.some((slot) => slot.status === "COMPLETED") || Boolean(completedSlot);
  const hasRecommendation = application.interviewNotes.some((note) => note.recommendation !== null);

  const decisionBlockers: string[] = [];
  if (interviewRequired && !hasCompletedInterview) {
    decisionBlockers.push("Interview must be marked completed.");
  }
  if (interviewRequired && !hasRecommendation) {
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

  const chapterProposal = parseChapterProposalMetadata(application.additionalMaterials);

  const defaultInterviewDate = toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

  // Build timeline steps - adapt based on whether interview is required
  const timelineSteps = interviewRequired
    ? [
        {
          label: "Application Submitted",
          complete: true,
          active: false,
          detail: new Date(application.submittedAt).toLocaleString(),
        },
        {
          label: "Under Review",
          complete: application.status !== "SUBMITTED",
          active: application.status === "SUBMITTED",
          detail: application.status === "SUBMITTED" ? "Waiting for reviewer" : "Reviewed",
        },
        {
          label: "Interview Scheduled",
          complete: Boolean(firstPostedSlot),
          active: !firstPostedSlot && application.status !== "SUBMITTED",
          detail: firstPostedSlot ? new Date(firstPostedSlot.scheduledAt).toLocaleString() : "Not yet scheduled",
        },
        {
          label: "Interview Confirmed",
          complete: Boolean(confirmedSlot) || Boolean(completedSlot),
          active: Boolean(firstPostedSlot) && !confirmedSlot && !completedSlot,
          detail: confirmedSlot?.confirmedAt
            ? new Date(confirmedSlot.confirmedAt).toLocaleString()
            : completedSlot
              ? "Completed"
              : "Awaiting confirmation",
        },
        {
          label: "Interview Completed",
          complete: hasCompletedInterview,
          active: Boolean(confirmedSlot) && !hasCompletedInterview,
          detail: completedSlot?.completedAt
            ? new Date(completedSlot.completedAt).toLocaleString()
            : "Pending",
        },
        {
          label: "Decision Ready",
          complete: decisionBlockers.length === 0,
          active: hasCompletedInterview && decisionBlockers.length > 0,
          detail: decisionBlockers.length === 0 ? "Ready for final decision" : decisionBlockers[0],
        },
        {
          label: "Final Decision",
          complete: Boolean(application.decision),
          active: !application.decision && decisionBlockers.length === 0,
          detail: application.decision
            ? `${application.decision.accepted ? "Accepted" : "Rejected"} on ${new Date(
                application.decision.decidedAt
              ).toLocaleString()}`
            : "Pending",
        },
      ]
    : [
        {
          label: "Application Submitted",
          complete: true,
          active: false,
          detail: new Date(application.submittedAt).toLocaleString(),
        },
        {
          label: "Under Review",
          complete: application.status !== "SUBMITTED",
          active: application.status === "SUBMITTED",
          detail: application.status === "SUBMITTED" ? "Waiting for reviewer" : "Materials reviewed",
        },
        {
          label: "Decision Ready",
          complete: true,
          active: false,
          detail: "No interview required for this position",
        },
        {
          label: "Final Decision",
          complete: Boolean(application.decision),
          active: !application.decision,
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {interviewRequired ? (
            <span className="pill pill-pathway">Interview Required</span>
          ) : (
            <span className="pill pill-success">No Interview</span>
          )}
          <span className={`pill ${statusPillClass(application.status)}`}>
            {formatStatus(application.status)}
          </span>
        </div>
      </div>

      <div className="grid two">
        <div>
          {/* Progress Stepper */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">
              {interviewRequired ? "Application Progress" : "Application Progress (Simplified)"}
            </div>
            {!interviewRequired && (
              <div style={{
                background: "#ecfdf5",
                border: "1px solid #10b981",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 14,
                fontSize: 13,
              }}>
                This position does not require an interview. Decisions can be made based on application materials.
              </div>
            )}
            <ApplicationProgressStepper steps={timelineSteps} />
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
                <span className={`pill pill-small ${interviewRequired ? "pill-pathway" : "pill-success"}`}>
                  {interviewRequired ? "Required" : "Not Required"}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">Application Materials</div>
            {chapterProposal ? (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 12,
                  background: "var(--surface-alt)",
                  marginBottom: 14,
                }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>Chapter Proposal Details</p>
                <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13 }}>
                  <div>
                    <strong>Proposed Chapter:</strong> {chapterProposal.chapterName}
                  </div>
                  <div>
                    <strong>City / Region:</strong>{" "}
                    {[chapterProposal.city, chapterProposal.region].filter(Boolean).join(", ") || "-"}
                  </div>
                  <div>
                    <strong>Partner School:</strong> {chapterProposal.partnerSchool || "-"}
                  </div>
                  {chapterProposal.chapterVision ? (
                    <div>
                      <strong>Vision:</strong> {chapterProposal.chapterVision}
                    </div>
                  ) : null}
                  {chapterProposal.launchPlan ? (
                    <div>
                      <strong>Launch Plan:</strong> {chapterProposal.launchPlan}
                    </div>
                  ) : null}
                  {chapterProposal.recruitmentPlan ? (
                    <div>
                      <strong>Recruitment Plan:</strong> {chapterProposal.recruitmentPlan}
                    </div>
                  ) : null}
                  {chapterProposal.additionalContext ? (
                    <div>
                      <strong>Additional Context:</strong> {chapterProposal.additionalContext}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
                {chapterProposal
                  ? chapterProposal.additionalContext || "Structured chapter proposal details captured above."
                  : application.additionalMaterials || "No additional materials provided."}
              </p>
            </div>
          </div>

          {/* Interview Slots - only show if interview required or if there are slots */}
          {(interviewRequired || application.interviewSlots.length > 0) && (
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
                            {slot.interviewer?.name ? ` \u00B7 Interviewer: ${slot.interviewer.name}` : ""}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                            Confirmed: {slot.confirmedAt ? new Date(slot.confirmedAt).toLocaleString() : "-"} \u00B7 Completed:{" "}
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
          )}

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
                {!interviewRequired && !application.decision ? (
                  <div style={{
                    background: "#ecfdf5",
                    border: "1px solid #10b981",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 12,
                    fontSize: 13,
                  }}>
                    No interview required. You can make a decision based on the application materials.
                  </div>
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
                {interviewRequired && (
                  <form action={setApplicationInterviewReadiness} style={{ marginTop: 12 }}>
                    <input type="hidden" name="applicationId" value={application.id} />
                    <button type="submit" className="button small outline" disabled={isClosedApplication}>
                      Sync Interview Readiness
                    </button>
                  </form>
                )}
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

                {/* Interview scheduling - show for all positions but label clearly */}
                <div style={{ marginBottom: 18 }}>
                  {!interviewRequired && (
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>
                      Interview is optional for this position, but you can still schedule one if needed.
                    </p>
                  )}
                  <form action={postApplicationInterviewSlot} className="form-grid">
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
                </div>

                <form action={saveStructuredInterviewNote} className="form-grid">
                  <input type="hidden" name="applicationId" value={application.id} />

                  <div className="form-row">
                    <label>Interview Note Summary</label>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
                      Summarize the candidate&#39;s responses, communication signals, and overall takeaways.
                    </p>
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
                  {!interviewRequired && (
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                      No interview required. Make your decision based on the application materials and any notes.
                    </p>
                  )}
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
                  {!interviewRequired && (
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
                      No interview required. Make your decision based on the application materials and any notes.
                    </p>
                  )}
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
              {!interviewRequired ? (
                <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                  This position does not require an interview. Your application is being reviewed based on your materials. You will be notified when a decision is made.
                </p>
              ) : (
                <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                  Reviewer notes are internal. You will receive interview scheduling updates and final decisions here.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
