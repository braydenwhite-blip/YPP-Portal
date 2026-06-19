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
import WithdrawForm from "./withdraw-form";
import ApplicantEditForm from "./edit-form";
import Link from "next/link";
import InstructorApplicationMotivationResponse from "@/components/instructor-application-motivation-response";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";
import { isHttpUrl } from "@/lib/meeting-details";
import type { WorkshopOutline } from "@/lib/summer-workshop";
import { cpApplicantFacingStatusLabel } from "@/lib/chapter-president-lifecycle";

function instructorStatusLabel(status: InstructorApplicationStatus): string {
  switch (status) {
    case "SUBMITTED": return "Submitted";
    case "UNDER_REVIEW": return "Under Review";
    case "INFO_REQUESTED": return "More Info Requested";
    case "PRE_APPROVED": return "Pre-Approved";
    case "INTERVIEW_SCHEDULED": return "Interview Scheduled";
    case "INTERVIEW_COMPLETED": return "Interview Completed";
    case "ON_HOLD": return "On Hold";
    case "CHAIR_REVIEW": return "Under Final Review";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Not Accepted";
    case "WITHDRAWN": return "Withdrawn";
    case "WAITLISTED": return "Waitlisted";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function cpStatusLabel(status: ChapterPresidentApplicationStatus): string {
  return cpApplicantFacingStatusLabel(status);
}

function statusColor(status: string): string {
  if (["APPROVED", "ACCEPTED", "ONBOARDING", "ACTIVE_CP"].includes(status)) return "#16a34a";
  if (["REJECTED", "DECLINED"].includes(status)) return "#dc2626";
  if (["INFO_REQUESTED", "NEEDS_MORE_INFO"].includes(status)) return "#d97706";
  if (status === "ON_HOLD") return "#71717a";
  if (status === "PRE_APPROVED") return "#7c3aed";
  return "#6b21c8";
}

function currentStageIndex(status: string): number {
  if (status === "SUBMITTED") return 0;
  if (["UNDER_REVIEW", "INITIAL_REVIEW", "INFO_REQUESTED", "NEEDS_MORE_INFO", "ON_HOLD"].includes(status)) return 1;
  if (["PRE_APPROVED", "INTERVIEW_NEEDED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETE", "INTERVIEW_COMPLETED"].includes(status)) return 2;
  return 3;
}

function ProgressStepper({
  status,
  middleStageLabel = "Interview",
}: {
  status: string;
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
    <div className="card application-progress-card">
      <ol className="application-progress-track" aria-label="Application progress">
        {stages.map((stage, i) => (
          <li
            key={stage.key}
            className="application-progress-step"
            data-active={i <= stageIdx}
            data-complete={i < stageIdx}
          >
            <span className="application-progress-dot">
              {i < stageIdx ? "\u2713" : i + 1}
            </span>
            <span className="application-progress-label">{stage.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function ApplicationStatusPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole;
  const hiringDemoMode = isHiringDemoModeEnabled();

  // Re-application: a user can have multiple InstructorApplication rows over
  // time, but only one non-terminal row at any given moment. Surface the
  // most recent record (live or last closed) so the applicant always sees
  // their current status, including the prior outcome before they re-apply.
  const loadInstructorApplication = () =>
    prisma.instructorApplication.findFirst({
      where: { applicantId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: { select: { name: true } },
        availabilityWindows: true,
        offeredSlots: {
          select: {
            id: true,
            scheduledAt: true,
            durationMinutes: true,
            meetingUrl: true,
            confirmedAt: true,
          },
          orderBy: { scheduledAt: "asc" },
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

  const confirmedInstructorSlot =
    instructorApp?.offeredSlots.find((slot) => slot.confirmedAt) ?? null;
  const pendingInstructorSlots =
    instructorApp?.offeredSlots.filter((slot) => !slot.confirmedAt) ?? [];

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Applications</h1>
          <p className="page-subtitle">Track the status of your applications.</p>
        </div>
      </div>

      {/* Instructor Application */}
      {instructorApp && (() => {
        const isSummerWorkshopApp =
          instructorApp.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR";
        const trackTitle = isSummerWorkshopApp
          ? "Summer Workshop Instructor Application"
          : "Instructor Application";
        return (
        <div style={{ marginBottom: 32 }}>
          <div className="application-status-heading-row">
            <span className="badge" style={{ background: statusColor(instructorApp.status), color: "white" }}>
              {instructorStatusLabel(instructorApp.status)}
            </span>
            <h2 className="application-status-card-title">{trackTitle}</h2>
            {isSummerWorkshopApp && (
              <span
                className="pill"
                style={{
                  background: "#f5f3ff",
                  color: "#6b21c8",
                  border: "1px solid #ddd6fe",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
                title="Summer Workshop Instructor — a focused, fast-start teaching role at YPP camps"
              >
                Summer Workshop
              </span>
            )}
            <span className="application-status-date">
              Applied {new Date(instructorApp.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <ProgressStepper status={instructorApp.status} />

          <div className="card" style={{ marginBottom: 16 }}>
            {instructorApp.status === "SUBMITTED" && (
              <>
                <h3 className="section-title">Application Received</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                  <strong>Next:</strong> a reviewer will be assigned and you&apos;ll hear back within <strong>3–5 business days</strong>. No action needed from you right now — contact your chapter if you need something sooner.
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
                  {isSummerWorkshopApp
                    ? "Reviewers are reading your workshop outline for energy, clarity, classroom presence, and engagement — what it takes to lead a focused, high-impact session at camp. They may invite you to a short conversation."
                    : "We are looking for fit and clarity, not perfection. If we move forward, you will be invited to a short interview — a two-way discussion, not an audition."}
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
            {/* PRE_APPROVED is still set in some flows: the legacy admin
                applicant-detail-panel calls preApproveApplication() and the
                application-cohort batch action can set it via
                statusByLegacyAction. Keep this UI even though the V1 chair
                decide path no longer transitions through PRE_APPROVED — an
                applicant could land here via either of those paths. If both
                of those setters are removed in the future, this block can
                go too (audit doc: docs/instructor-applicant-implementation-plan.md). */}
            {instructorApp.status === "PRE_APPROVED" && (
              <>
                <h3 className="section-title" style={{ color: "#6b21c8" }}>You&apos;ve Been Pre-Approved!</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Great news — you&apos;ve been pre-approved to move forward in the instructor pathway. Instructor training will unlock after final approval.
                </p>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
                  We&apos;ll be in touch shortly to schedule your interview.
                </p>
              </>
            )}
            {instructorApp.status === "INTERVIEW_SCHEDULED" && (
              <>
                <h3 className="section-title">Interview</h3>
                {instructorApp.interviewScheduledAt ? (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                      Your interview has been confirmed. Your calendar invite includes the same meeting details shown here. If you need to reschedule, reach out to your lead interviewer.
                    </p>
                    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
                      <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                        {new Date(instructorApp.interviewScheduledAt).toLocaleString("en-US", {
                          weekday: "long", year: "numeric", month: "long", day: "numeric",
                          hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                      {confirmedInstructorSlot?.meetingUrl && isHttpUrl(confirmedInstructorSlot.meetingUrl) && (
                        <a
                          href={confirmedInstructorSlot.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="button"
                          style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}
                        >
                          Join Interview
                        </a>
                      )}
                      {confirmedInstructorSlot?.meetingUrl && !isHttpUrl(confirmedInstructorSlot.meetingUrl) && (
                        <p style={{ fontSize: 14, color: "var(--muted)", margin: "10px 0 0" }}>
                          Meeting details: {confirmedInstructorSlot.meetingUrl}
                        </p>
                      )}
                    </div>
                  </>
                ) : pendingInstructorSlots.length > 0 ? (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                      Your lead interviewer has proposed the following times. Pick the one that works best, or let us know if none of them work.
                    </p>
                    <SlotPickerForm applicationId={instructorApp.id} slots={pendingInstructorSlots} />
                  </>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                    Your lead interviewer will propose exactly 3 available times shortly. Check back here to pick the time that works best for you.
                  </p>
                )}
              </>
            )}
            {instructorApp.status === "INTERVIEW_COMPLETED" && (
              <>
                <h3 className="section-title">Interview Completed</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>A final decision is pending.</p>
              </>
            )}
            {instructorApp.status === "CHAIR_REVIEW" && (
              <>
                <h3 className="section-title">Under Final Review</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Your interview notes are with the final review team. You do not need to take action unless we ask for more information.
                </p>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
                  If your prep materials are still missing, you can upload them above. They help the team compare your plan, but they do not block review.
                </p>
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
            {instructorApp.status === "WAITLISTED" && (
              <>
                <h3 className="section-title">Waitlisted</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Thanks for your interest. Your application is on our waitlist while we evaluate openings. We&apos;ll reach out if a spot opens up — no further action is needed from you right now.
                </p>
              </>
            )}
            {instructorApp.status === "APPROVED" && (
              <>
                <h3 className="section-title" style={{ color: "#16a34a" }}>Approved!</h3>
                {instructorApp.instructorSubtype === "SUMMER_WORKSHOP" ? (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
                      You&rsquo;re approved as a Summer Workshop Instructor — a focused, high-impact teaching role. Finish required training, then submit a workshop in the Workshop Design Studio (design your own or pick from the approved library). Strong workshop instructors may quickly be considered for full instructor responsibilities and instructor mentorship based on readiness and leadership.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link href="/instructor-training" className="button" style={{ textDecoration: "none" }}>
                        Start Instructor Training
                      </Link>
                      <Link
                        href="/instructor/workshop-design-studio"
                        className="button secondary"
                        style={{ textDecoration: "none" }}
                      >
                        Open Workshop Design Studio
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
                      Your instructor application has been approved. Continue your studio journey in instructor training.
                    </p>
                    <Link href="/instructor-training" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
                      Start Instructor Training
                    </Link>
                  </>
                )}
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

          {/* Growth pathway card — only for approved Summer Workshop instructors.
              Sets honest expectations: strong workshop instructors may quickly be
              invited to take on full instructor work or to mentor other
              instructors, based on readiness and leadership. No promises. */}
          {instructorApp.status === "APPROVED" &&
            instructorApp.instructorSubtype === "SUMMER_WORKSHOP" && (
              <div
                className="card"
                style={{
                  marginBottom: 16,
                  background: "#f5f3ff",
                  border: "1px solid #ddd6fe",
                }}
              >
                <h3 className="section-title" style={{ color: "#5b21b6", marginTop: 0 }}>
                  Your growth pathway
                </h3>
                <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.55 }}>
                  Summer Workshop Instructor is a focused, fast-start teaching role.
                  As you lead workshops well, more responsibility opens up.
                </p>
                <ul
                  style={{
                    margin: "0 0 12px",
                    paddingLeft: 18,
                    fontSize: 13,
                    color: "var(--muted)",
                    lineHeight: 1.65,
                  }}
                >
                  <li>
                    <strong>Lead the room.</strong> Run your workshop with energy, clarity,
                    and classroom presence.
                  </li>
                  <li>
                    <strong>Strong performance may open the door to full instructor work.</strong>{" "}
                    Admins and hiring chairs review readiness and leadership and can invite
                    strong workshop instructors to expand into the full instructor role.
                  </li>
                  <li>
                    <strong>High-performing instructors may mentor others.</strong> Once
                    you&rsquo;ve shown strong teaching and leadership, you may be invited to
                    mentor newer instructors.
                  </li>
                </ul>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>
                  Decisions are made by YPP staff based on readiness, leadership, and review
                  notes — nothing is automatic.
                </p>
              </div>
            )}

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
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Interview availability:</strong></p>
                <p style={{ fontSize: 14, margin: 0 }}>{instructorApp.availability}</p>
              </div>
              {(instructorApp.courseIdea || instructorApp.textbook) && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Class idea:</strong></p>
                  <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{instructorApp.courseIdea ?? instructorApp.textbook}</p>
                </div>
              )}
              {instructorApp.courseOutline && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>Rough course outline:</strong></p>
                  <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{instructorApp.courseOutline}</p>
                </div>
              )}
              {instructorApp.firstClassPlan && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}><strong>First-session sketch:</strong></p>
                  <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{instructorApp.firstClassPlan}</p>
                </div>
              )}
              {(() => {
                const outline = (instructorApp.workshopOutline as WorkshopOutline | null) ?? null;
                if (!outline || !outline.title) return null;
                return (
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "var(--surface-2)" }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Workshop outline you submitted
                    </p>
                    <p style={{ fontSize: 14, margin: "0 0 6px" }}><strong>{outline.title}</strong></p>
                    <p style={{ fontSize: 13, margin: "0 0 8px", color: "var(--muted)" }}>
                      {outline.ageRange}
                      {outline.durationMinutes ? ` · ${outline.durationMinutes} minutes` : ""}
                    </p>
                    {outline.learningGoals?.length ? (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>Learning goals</p>
                        <ul style={{ fontSize: 13, margin: "0 0 0 18px", padding: 0 }}>
                          {outline.learningGoals.map((g, i) => <li key={i} style={{ marginBottom: 2 }}>{g}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {outline.activityFlow ? (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>Activity flow</p>
                        <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{outline.activityFlow}</p>
                      </div>
                    ) : null}
                    {outline.engagementHook ? (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>Engagement hook</p>
                        <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{outline.engagementHook}</p>
                      </div>
                    ) : null}
                    {outline.adaptationNotes ? (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>Adapting on the fly</p>
                        <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{outline.adaptationNotes}</p>
                      </div>
                    ) : null}
                    {outline.materialsNeeded?.length ? (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>Materials</p>
                        <ul style={{ fontSize: 13, margin: "0 0 0 18px", padding: 0 }}>
                          {outline.materialsNeeded.map((m, i) => <li key={i} style={{ marginBottom: 2 }}>{m}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </details>

          {/* Edit — applicants can update most fields while review is open
              (CHAIR_REVIEW + terminal statuses are locked server-side). */}
          {!["CHAIR_REVIEW", "ON_HOLD", "WAITLISTED", "APPROVED", "REJECTED", "WITHDRAWN"].includes(
            instructorApp.status
          ) && (
            (() => {
              const editOutline =
                (instructorApp.workshopOutline as WorkshopOutline | null) ?? null;
              return (
                <ApplicantEditForm
                  isSummerWorkshop={instructorApp.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR"}
                  values={{
                    motivation: instructorApp.motivation,
                    teachingExperience: instructorApp.teachingExperience,
                    availability: instructorApp.availability,
                    hoursPerWeek: instructorApp.hoursPerWeek,
                    preferredStartDate: instructorApp.preferredStartDate,
                    subjectsOfInterest: instructorApp.subjectsOfInterest,
                    courseIdea: instructorApp.courseIdea,
                    courseOutline: instructorApp.courseOutline,
                    firstClassPlan: instructorApp.firstClassPlan,
                    preferredFirstName: instructorApp.preferredFirstName,
                    lastName: instructorApp.lastName,
                    phoneNumber: instructorApp.phoneNumber,
                    city: instructorApp.city,
                    stateProvince: instructorApp.stateProvince,
                    zipCode: instructorApp.zipCode,
                  }}
                  workshopOutline={
                    editOutline
                      ? {
                          title: editOutline.title ?? "",
                          ageRange: editOutline.ageRange ?? "",
                          durationMinutes: editOutline.durationMinutes ?? null,
                          learningGoals: editOutline.learningGoals ?? [],
                          activityFlow: editOutline.activityFlow ?? "",
                          materialsNeeded: editOutline.materialsNeeded ?? [],
                          engagementHook: editOutline.engagementHook ?? "",
                          adaptationNotes: editOutline.adaptationNotes ?? "",
                        }
                      : null
                  }
                />
              );
            })()
          )}

          {/* Withdraw — applicants control their own data */}
          {!["APPROVED", "REJECTED", "WITHDRAWN"].includes(instructorApp.status) && (
            <WithdrawForm />
          )}

          {/* Re-apply when the latest application is closed (terminal) */}
          {["REJECTED", "WITHDRAWN"].includes(instructorApp.status) && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#f5f3ff",
                border: "1px solid #ddd6fe",
                fontSize: 13,
                color: "#5b21b6",
                lineHeight: 1.55,
              }}
            >
              You can submit a new application — we&apos;ll pre-fill it with what
              you had before, and flag it as a re-application for the review team.
              <div style={{ marginTop: 10 }}>
                <Link
                  href="/applications/instructor/new"
                  className="button"
                  style={{ fontSize: 13, padding: "8px 14px", textDecoration: "none" }}
                >
                  Start a new application
                </Link>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Chapter President Application */}
      {cpApp && (
        <div style={{ marginBottom: 32 }}>
          <div className="application-status-heading-row">
            <span className="badge" style={{ background: statusColor(cpApp.status), color: "white" }}>
              {cpStatusLabel(cpApp.status)}
            </span>
            <h2 className="application-status-card-title">Chapter President Application</h2>
            {cpApp.chapter && (
              <span className="pill">{cpApp.chapter.name}</span>
            )}
            <span className="application-status-date">
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
            {["UNDER_REVIEW", "INITIAL_REVIEW"].includes(cpApp.status) && (
              <>
                <h3 className="section-title">Under Review</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  {cpApp.reviewer ? `${cpApp.reviewer.name} is` : "A reviewer is"} currently evaluating your application.
                </p>
              </>
            )}
            {["INFO_REQUESTED", "NEEDS_MORE_INFO"].includes(cpApp.status) && (
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
            {cpApp.status === "INTERVIEW_NEEDED" && (
              <>
                <h3 className="section-title">Interview Needed</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Your application is moving to the interview step. A reviewer will share scheduling details here.
                </p>
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
                      {cpApp.interviewMeetingUrl && (
                        <a
                          href={cpApp.interviewMeetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="button"
                          style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}
                        >
                          Join Interview
                        </a>
                      )}
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
            {["DECISION_NEEDED", "RECOMMENDATION_SUBMITTED"].includes(cpApp.status) && (
              <>
                <h3 className="section-title">Under Final Review</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>
                  Your interview is complete and a recommendation has been submitted. The hiring committee is making the final decision.
                </p>
              </>
            )}
            {["INTERVIEW_COMPLETE", "INTERVIEW_COMPLETED"].includes(cpApp.status) && (
              <>
                <h3 className="section-title">Interview Completed</h3>
                <p style={{ color: "var(--muted)", fontSize: 14 }}>A final decision is pending.</p>
              </>
            )}
            {["APPROVED", "ACCEPTED", "ONBOARDING", "ACTIVE_CP"].includes(cpApp.status) && (
              <>
                <h3 className="section-title" style={{ color: "#16a34a" }}>Approved!</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
                  Your chapter president application has been approved. Welcome to the leadership team! Start with onboarding, then run your chapter from the President Dashboard.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/chapter/onboarding" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
                    Start Chapter Onboarding
                  </Link>
                  <Link href="/chapter/dashboard" className="button outline" style={{ display: "inline-block", textDecoration: "none" }}>
                    President Dashboard
                  </Link>
                </div>
              </>
            )}
            {["REJECTED", "DECLINED"].includes(cpApp.status) && (
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
