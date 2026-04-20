import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  InstructorApplicationStatus,
  ChapterPresidentApplicationStatus,
} from "@prisma/client";
import InfoResponseForm from "./info-response-form";
import CPInfoResponseForm from "./cp-info-response-form";
import AvailabilityForm from "./availability-form";
import SlotPickerForm from "./slot-picker-form";
import Link from "next/link";
import InstructorApplicationMotivationResponse from "@/components/instructor-application-motivation-response";
import InstructorCurriculumPrepPanel from "./instructor-curriculum-prep-panel";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";

function instructorStatusLabel(status: InstructorApplicationStatus): string {
  switch (status) {
    case "SUBMITTED": return "Submitted";
    case "UNDER_REVIEW": return "Under Review";
    case "INFO_REQUESTED": return "More Info Requested";
    case "PRE_APPROVED": return "Pre-Approved";
    case "INTERVIEW_SCHEDULED": return "Curriculum Overview Scheduled";
    case "INTERVIEW_COMPLETED": return "Curriculum Overview Completed";
    case "ON_HOLD": return "On Hold";
    case "CHAIR_REVIEW": return "Under Final Review";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Not Accepted";
    case "WITHDRAWN": return "Withdrawn";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function cpStatusLabel(status: ChapterPresidentApplicationStatus): string {
  switch (status) {
    case "SUBMITTED": return "Submitted";
    case "UNDER_REVIEW": return "Under Review";
    case "INFO_REQUESTED": return "More Info Requested";
    case "INTERVIEW_SCHEDULED": return "Interview Scheduled";
    case "INTERVIEW_COMPLETED": return "Interview Completed";
    case "RECOMMENDATION_SUBMITTED": return "Under Final Review";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Not Accepted";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function statusColor(status: string): string {
  if (status === "APPROVED") return "#16a34a";
  if (status === "REJECTED") return "#dc2626";
  if (status === "INFO_REQUESTED") return "#d97706";
  if (status === "ON_HOLD") return "#71717a";
  if (status === "PRE_APPROVED") return "#7c3aed";
  return "#6b21c8";
}

function currentStageIndex(status: string): number {
  if (status === "SUBMITTED") return 0;
  if (status === "UNDER_REVIEW" || status === "INFO_REQUESTED" || status === "ON_HOLD") return 1;
  if (status === "PRE_APPROVED" || status === "INTERVIEW_SCHEDULED" || status === "INTERVIEW_COMPLETED") return 2;
  return 3;
}

function canShowCurriculumPrep(status: InstructorApplicationStatus): boolean {
  return status !== "APPROVED" && status !== "REJECTED" && status !== "WITHDRAWN";
}

function ProgressStepper({
  status,
  middleStageLabel = "Interview",
}: {
  status: string;
  /** Instructor applications use "Curriculum overview"; chapter president flow keeps "Interview". */
  middleStageLabel?: string;
}) {
  const stages = [
    { key: "submitted", label: "Submitted" },
    { key: "review", label: "Under Review" },
    { key: "interview", label: middleStageLabel },
    { key: "decision", label: "Decision" },
  ] as const;
  const stageIdx = currentStageIndex(status);
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {stages.map((stage, i) => (
          <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: i < stages.length - 1 ? 1 : "initial" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: i <= stageIdx ? "#6b21c8" : "var(--border)",
                color: i <= stageIdx ? "white" : "var(--muted)",
                fontWeight: 700, fontSize: 14,
              }}>
                {i < stageIdx ? "\u2713" : i + 1}
              </div>
              <span style={{ fontSize: 11, color: i <= stageIdx ? "#6b21c8" : "var(--muted)", marginTop: 4, textAlign: "center" }}>
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < stageIdx ? "#6b21c8" : "var(--border)", margin: "0 4px", marginBottom: 20 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ApplicationStatusPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole;
  const hiringDemoMode = isHiringDemoModeEnabled();

  const loadInstructorApplication = () =>
    prisma.instructorApplication.findUnique({
      where: { applicantId: session.user.id },
      include: {
        reviewer: { select: { name: true } },
        availabilityWindows: true,
        offeredSlots: {
          where: { confirmedAt: null },
          orderBy: { scheduledAt: "asc" },
        },
        documents: {
          where: { supersededAt: null },
          select: {
            id: true,
            kind: true,
            fileUrl: true,
            originalName: true,
            note: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

  const loadChapterPresidentApplication = () =>
    prisma.chapterPresidentApplication.findUnique({
      where: { applicantId: session.user.id },
      include: {
        reviewer: { select: { name: true } },
        chapter: { select: { name: true } },
        availabilityWindows: true,
      },
    });

  let instructorApp: Awaited<ReturnType<typeof loadInstructorApplication>>;
  let cpApp: Awaited<ReturnType<typeof loadChapterPresidentApplication>>;

  if (hiringDemoMode) {
    instructorApp = await loadInstructorApplication();
    cpApp = instructorApp ? null : await loadChapterPresidentApplication();
  } else {
    [instructorApp, cpApp] = await Promise.all([
      loadInstructorApplication(),
      loadChapterPresidentApplication(),
    ]);
  }

  if (!instructorApp && !cpApp) {
    // No applications — redirect unless applicant role
    if (!roles.includes("APPLICANT") && primaryRole !== "APPLICANT") {
      redirect("/");
    }
    redirect("/");
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Applications</h1>
          <p className="page-subtitle">Track the status of your applications.</p>
        </div>
      </div>

      {/* Instructor Application */}
      {instructorApp && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="badge" style={{ background: statusColor(instructorApp.status), color: "white" }}>
              {instructorStatusLabel(instructorApp.status)}
            </span>
            <h2 style={{ margin: 0, fontSize: 18 }}>Instructor Application</h2>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Applied {new Date(instructorApp.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <ProgressStepper status={instructorApp.status} middleStageLabel="Curriculum overview" />

          <div className="card" style={{ marginBottom: 16 }}>
            {canShowCurriculumPrep(instructorApp.status) ? (
              <InstructorCurriculumPrepPanel
                applicationId={instructorApp.id}
                documents={instructorApp.documents.map((doc) => ({
                  ...doc,
                  uploadedAt: doc.uploadedAt.toISOString(),
                }))}
              />
            ) : null}

            {instructorApp.status === "SUBMITTED" && (
              <>
                <h3 className="section-title">Application Received</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Your application is in the queue. We typically send a first update within <strong>3–5 business days</strong>. If you need anything sooner, contact your chapter.
                </p>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
                  Review is about understanding how you teach — not a scored exam. The curriculum overview later is the same: a conversation, not a test.
                </p>
              </>
            )}
            {instructorApp.status === "UNDER_REVIEW" && (
              <>
                <h3 className="section-title">Under Review</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  {instructorApp.reviewer ? `${instructorApp.reviewer.name} is` : "A reviewer is"} currently evaluating your application.
                </p>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
                  We are looking for fit and clarity, not perfection. The curriculum overview (when you reach that step) is a two-way discussion, not an audition.
                </p>
              </>
            )}
            {instructorApp.status === "INFO_REQUESTED" && (
              <>
                <h3 className="section-title">Additional Information Needed</h3>
                {instructorApp.infoRequest && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>
                      <strong>Message from {instructorApp.reviewer?.name ?? "reviewer"}:</strong>
                    </p>
                    <p style={{ fontSize: 14, margin: 0 }}>{instructorApp.infoRequest}</p>
                  </div>
                )}
                {instructorApp.applicantResponse && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Your previous response:</strong></p>
                    <p style={{ fontSize: 14, margin: 0 }}>{instructorApp.applicantResponse}</p>
                  </div>
                )}
                <InfoResponseForm />
              </>
            )}
            {instructorApp.status === "PRE_APPROVED" && (
              <>
                <h3 className="section-title" style={{ color: "#6b21c8" }}>You&apos;ve Been Pre-Approved!</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Great news — you&apos;ve been pre-approved to move forward in the instructor pathway. Instructor training will unlock after final approval.
                </p>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
                  For now, use the curriculum prep area above to build a draft curriculum or upload a one-class plan and structure notes for your <strong>curriculum overview/interview</strong>.
                </p>
              </>
            )}
            {instructorApp.status === "INTERVIEW_SCHEDULED" && (
              <>
                <h3 className="section-title">Curriculum Overview/Interview</h3>
                {instructorApp.interviewScheduledAt ? (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                      Your curriculum overview/interview has been confirmed. You will receive a calendar invite by email. If you need to reschedule, reach out to your reviewer.
                    </p>
                    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
                      <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                        {new Date(instructorApp.interviewScheduledAt).toLocaleString("en-US", {
                          weekday: "long", year: "numeric", month: "long", day: "numeric",
                          hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </>
                ) : instructorApp.offeredSlots && instructorApp.offeredSlots.length > 0 ? (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                      A reviewer has proposed the following times for your curriculum overview/interview. Click the one that works best for you — you&apos;ll receive a calendar invite once confirmed.
                    </p>
                    <SlotPickerForm slots={instructorApp.offeredSlots} />
                  </>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                    Your reviewer will propose a few available times shortly. Check back here to pick the time that works best for you.
                  </p>
                )}
              </>
            )}
            {instructorApp.status === "INTERVIEW_COMPLETED" && (
              <>
                <h3 className="section-title">Curriculum Overview Completed</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>A final decision is pending.</p>
              </>
            )}
            {instructorApp.status === "ON_HOLD" && (
              <>
                <h3 className="section-title">Application On Hold</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Your application is paused while the review team completes follow-up steps. We&apos;ll reach out if we need anything else from you.
                </p>
              </>
            )}
            {instructorApp.status === "APPROVED" && (
              <>
                <h3 className="section-title" style={{ color: "#16a34a" }}>Approved!</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
                  Your instructor application has been approved. Continue your studio journey in instructor training.
                </p>
                <Link href="/instructor-training" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
                  Start Instructor Training
                </Link>
              </>
            )}
            {instructorApp.status === "REJECTED" && (
              <>
                <h3 className="section-title">Application Not Accepted</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Thank you for your interest. We are not moving forward at this time.
                </p>
                {instructorApp.rejectionReason && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px" }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Reviewer notes:</strong></p>
                    <p style={{ fontSize: 14, margin: 0 }}>{instructorApp.rejectionReason}</p>
                  </div>
                )}
              </>
            )}
            {instructorApp.reviewerNotes && instructorApp.status !== "REJECTED" && (
              <div style={{ marginTop: 16, background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px" }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Feedback from reviewer:</strong></p>
                <p style={{ fontSize: 14, margin: 0 }}>{instructorApp.reviewerNotes}</p>
              </div>
            )}
          </div>

          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, padding: "4px 0" }}>
              Your Application Details
            </summary>
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <InstructorApplicationMotivationResponse
                  motivation={instructorApp.motivation}
                  motivationVideoUrl={instructorApp.motivationVideoUrl}
                  label="Teaching approach video"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Teaching experience:</strong></p>
                <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{instructorApp.teachingExperience}</p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Curriculum overview availability:</strong></p>
                <p style={{ fontSize: 14, margin: 0 }}>{instructorApp.availability}</p>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Chapter President Application */}
      {cpApp && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="badge" style={{ background: statusColor(cpApp.status), color: "white" }}>
              {cpStatusLabel(cpApp.status)}
            </span>
            <h2 style={{ margin: 0, fontSize: 18 }}>Chapter President Application</h2>
            {cpApp.chapter && (
              <span className="pill">{cpApp.chapter.name}</span>
            )}
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Applied {new Date(cpApp.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <ProgressStepper status={cpApp.status} />

          <div className="card" style={{ marginBottom: 16 }}>
            {cpApp.status === "SUBMITTED" && (
              <>
                <h3 className="section-title">Application Received</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Your chapter president application is in the queue. A reviewer will reach out soon.
                </p>
              </>
            )}
            {cpApp.status === "UNDER_REVIEW" && (
              <>
                <h3 className="section-title">Under Review</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  {cpApp.reviewer ? `${cpApp.reviewer.name} is` : "A reviewer is"} currently evaluating your application.
                </p>
              </>
            )}
            {cpApp.status === "INFO_REQUESTED" && (
              <>
                <h3 className="section-title">Additional Information Needed</h3>
                {cpApp.infoRequest && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>
                      <strong>Message from {cpApp.reviewer?.name ?? "reviewer"}:</strong>
                    </p>
                    <p style={{ fontSize: 14, margin: 0 }}>{cpApp.infoRequest}</p>
                  </div>
                )}
                {cpApp.applicantResponse && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Your previous response:</strong></p>
                    <p style={{ fontSize: 14, margin: 0 }}>{cpApp.applicantResponse}</p>
                  </div>
                )}
                <CPInfoResponseForm />
              </>
            )}
            {cpApp.status === "INTERVIEW_SCHEDULED" && (
              <>
                <h3 className="section-title">Interview</h3>
                {cpApp.interviewScheduledAt ? (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                      Your interview has been confirmed. You will receive a calendar invite by email. If you need to reschedule, reach out to your reviewer.
                    </p>
                    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
                      <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                        {new Date(cpApp.interviewScheduledAt).toLocaleString("en-US", {
                          weekday: "long", year: "numeric", month: "long", day: "numeric",
                          hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </>
                ) : (
                  <AvailabilityForm
                    applicationId={cpApp.id}
                    variant="cp"
                    existingWindows={cpApp.availabilityWindows}
                    hadNoMatch={!!cpApp.schedulingNoMatchAt}
                  />
                )}
              </>
            )}
            {cpApp.status === "RECOMMENDATION_SUBMITTED" && (
              <>
                <h3 className="section-title">Under Final Review</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Your interview is complete and a recommendation has been submitted. The hiring committee is making the final decision.
                </p>
              </>
            )}
            {cpApp.status === "INTERVIEW_COMPLETED" && (
              <>
                <h3 className="section-title">Interview Completed</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>A final decision is pending.</p>
              </>
            )}
            {cpApp.status === "APPROVED" && (
              <>
                <h3 className="section-title" style={{ color: "#16a34a" }}>Approved!</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
                  Your chapter president application has been approved. Welcome to the leadership team!
                </p>
                <Link href="/chapter/onboarding" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
                  Start Chapter Onboarding
                </Link>
              </>
            )}
            {cpApp.status === "REJECTED" && (
              <>
                <h3 className="section-title">Application Not Accepted</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Thank you for your interest in leading a chapter. We are not moving forward at this time.
                </p>
                {cpApp.rejectionReason && (
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px" }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Reviewer notes:</strong></p>
                    <p style={{ fontSize: 14, margin: 0 }}>{cpApp.rejectionReason}</p>
                  </div>
                )}
              </>
            )}
            {cpApp.reviewerNotes && cpApp.status !== "REJECTED" && (
              <div style={{ marginTop: 16, background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px" }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Feedback from reviewer:</strong></p>
                <p style={{ fontSize: 14, margin: 0 }}>{cpApp.reviewerNotes}</p>
              </div>
            )}
          </div>

          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, padding: "4px 0" }}>
              Your Application Details
            </summary>
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Leadership experience:</strong></p>
                <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{cpApp.leadershipExperience}</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Chapter vision:</strong></p>
                <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{cpApp.chapterVision}</p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Interview availability:</strong></p>
                <p style={{ fontSize: 14, margin: 0 }}>{cpApp.availability}</p>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
