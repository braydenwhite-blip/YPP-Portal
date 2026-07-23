import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getEnabledFeatureKeysForUser } from "@/lib/feature-gates";
import {
  isHiringDecisionApproved,
  isHiringDecisionPending,
  isHiringDecisionReturned,
} from "@/lib/hiring-decision-utils";
import { prisma } from "@/lib/prisma";
import {
  cancelApplicationInterviewSlot,
  confirmInterviewSlot,
  markApplicationInterviewCompleted,
  updateApplicationStatus,
} from "@/lib/application-actions";
import { ApplicationStatus } from "@prisma/client";
import AddToCalendarButton from "@/components/add-to-calendar-button";
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { HiringApplicationRecordSimple } from "@/components/applications/HiringApplicationRecordSimple";
import { HiringApplicationMaterialsEditor } from "@/components/applications/HiringApplicationMaterialsEditor";
import { HiringApplicationInterviewSchedule } from "@/components/applications/HiringApplicationInterviewSchedule";
import { StaffDecisionPanel } from "@/components/applications/StaffDecisionPanel";
import { StaffInterviewNotesEditor } from "@/components/applications/StaffInterviewNotesEditor";
import { StaffLocationEditor } from "@/components/applications/StaffLocationEditor";
import { RecordSection, StatusBadge, type KeyFact, type StatusTone } from "@/components/ui-v2";
import { normalizeRoleList } from "@/lib/authorization";
import { listOperatingChaptersForFilters } from "@/lib/chapters/operating";
import {
  gradeLabel,
  isSocialMediaManagerPosition,
  parseSocialMediaManagerMetadata,
} from "@/lib/social-media-manager-application";
import { extractStaffLocation } from "@/lib/staff-applicant-location";

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "ACCEPTED":
      return "success";
    case "REJECTED":
    case "WITHDRAWN":
      return "danger";
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETED":
      return "info";
    case "UNDER_REVIEW":
      return "warning";
    case "SUBMITTED":
      return "brand";
    default:
      return "neutral";
  }
}

function interviewSlotTone(status: string): StatusTone {
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    default:
      return "warning";
  }
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
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      chapterId: true,
      primaryRole: true,
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
          chapterId: true,
          chapter: { select: { id: true, name: true } },
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
          hiringChair: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!application) {
    notFound();
  }

  const roles = normalizeRoleList(currentUser.roles, currentUser.primaryRole);
  const isAdmin = roles.includes("ADMIN");
  const isHiringChair = roles.includes("HIRING_CHAIR");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  const enabledFeatureKeys = await getEnabledFeatureKeysForUser({
    userId: currentUser.id,
    chapterId: currentUser.chapterId,
    roles,
    primaryRole: session.user.primaryRole ?? null,
  }).catch(() => [] as Awaited<ReturnType<typeof getEnabledFeatureKeysForUser>>);
  const isDesignatedInterviewer = new Set(enabledFeatureKeys).has("INTERVIEWER");
  const isApplicant = application.applicantId === currentUser.id;
  const isChapterReviewer =
    isChapterLead &&
    !!application.position.chapterId &&
    currentUser.chapterId === application.position.chapterId;
  const isNetworkStaffOpening =
    application.position.type === "STAFF" && !application.position.chapterId;
  const isInterviewReviewer =
    isAdmin ||
    isHiringChair ||
    isChapterReviewer ||
    (isDesignatedInterviewer &&
      (isNetworkStaffOpening ||
        (!!application.position.chapterId &&
          currentUser.chapterId === application.position.chapterId)));
  const canManagePipeline = isAdmin || isHiringChair || isChapterReviewer;

  if (!isApplicant && !isInterviewReviewer) {
    redirect("/applications");
  }

  const isClosedApplication = ["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(application.status);
  const hasApprovedDecision = isHiringDecisionApproved(application.decision);
  const hasPendingDecision = isHiringDecisionPending(application.decision);
  const hasReturnedDecision = isHiringDecisionReturned(application.decision);
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
  const canFinalizeStaffDecision =
    !isClosedApplication &&
    !hasApprovedDecision &&
    (isAdmin || isHiringChair || (isChapterReviewer && canChapterDecideRole));

  const staffReadinessChecks = [
    {
      id: "notes",
      label: "Interview notes",
      done: application.interviewNotes.length > 0,
      detail:
        application.interviewNotes.length > 0
          ? "Notes on file"
          : "Add interview notes above",
    },
    {
      id: "recommendation",
      label: "Recommendation",
      done: !interviewRequired || hasRecommendation,
      detail: hasRecommendation
        ? "Recommendation recorded"
        : interviewRequired
          ? "Add a recommendation on your notes"
          : "Not required",
    },
    {
      id: "interview",
      label: "Interview complete",
      done: !interviewRequired || hasCompletedInterview,
      detail: hasCompletedInterview
        ? "Interview marked complete"
        : interviewRequired
          ? "Mark the interview complete"
          : "Not required",
    },
  ];
  const staffReadinessDone = staffReadinessChecks.filter((c) => c.done).length;
  const staffReadinessHeadline = `${staffReadinessDone} of ${staffReadinessChecks.length} complete`;

  const finalDecisionDetail = hasApprovedDecision
    ? `${application.decision?.accepted ? "Accepted" : "Rejected"} on ${new Date(
        application.decision?.hiringChairAt ?? application.decision?.decidedAt ?? application.submittedAt
      ).toLocaleString()}`
    : hasPendingDecision
      ? "A prior Chair recommendation is pending — finalize below to close it out."
      : hasReturnedDecision
        ? "Previously returned — finalize a new decision below."
        : "Pending";

  const chapterProposal = parseChapterProposalMetadata(application.additionalMaterials);
  const socialMediaApplication = parseSocialMediaManagerMetadata(application.additionalMaterials);

  // Interview detail for facts strip (scheduled / confirmed / completed).
  const interviewFactValue = completedSlot
    ? "Completed"
    : confirmedSlot
      ? "Confirmed"
      : firstPostedSlot
        ? new Date(firstPostedSlot.scheduledAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : interviewRequired
          ? "Not scheduled"
          : "Not required";

  const backHref = isApplicant
    ? "/applications"
    : isAdmin
      ? "/admin/instructor-applicants"
      : isChapterReviewer
        ? "/chapter/recruiting"
        : "/interviews?scope=hiring&view=team&state=needs_action";

  const backLabel = isApplicant
    ? "My applications"
    : isAdmin
      ? "Application board"
      : "Back";

  const nextStep = (() => {
    if (isClosedApplication) {
      return hasApprovedDecision
        ? {
            title: application.decision?.accepted ? "Accepted" : "Rejected",
            detail: finalDecisionDetail,
          }
        : { title: "Closed", detail: formatStatus(application.status) };
    }
    if (isApplicant) {
      if (application.status === "SUBMITTED") {
        return {
          title: "Under review soon",
          detail: "A reviewer will look at your materials next.",
        };
      }
      const posted = application.interviewSlots.find((s) => s.status === "POSTED");
      if (posted) {
        return {
          title: "Confirm your interview",
          detail: `Pick the offered time on ${new Date(posted.scheduledAt).toLocaleString()}.`,
        };
      }
      return {
        title: "You're all set for now",
        detail: interviewRequired
          ? "Interview updates and the final decision will show up here."
          : "You'll be notified when a decision is made.",
      };
    }
    if (hasApprovedDecision) {
      return {
        title: application.decision?.accepted ? "Accepted" : "Rejected",
        detail: finalDecisionDetail,
      };
    }
    if (canFinalizeStaffDecision && staffReadinessDone === staffReadinessChecks.length) {
      return {
        title: "Ready to decide",
        detail: "Approve or reject below — it finalizes immediately.",
      };
    }
    if (application.status === "SUBMITTED") {
      return {
        title: "Start review",
        detail: "Open the application, then move status to Under Review when ready.",
      };
    }
    if (interviewRequired && !firstPostedSlot) {
      return {
        title: "Schedule the interview",
        detail: "Set a time below, then mark it complete after the call.",
      };
    }
    if (interviewRequired && !hasCompletedInterview) {
      return {
        title: "Finish the interview",
        detail: decisionBlockers[0] ?? "Confirm, complete, and add a recommendation note.",
      };
    }
    return {
      title: "Keep reviewing",
      detail: decisionBlockers[0] ?? "Add notes, then decide below.",
    };
  })();

  const staffLocationLabel =
    application.position.type === "STAFF"
      ? extractStaffLocation(application.additionalMaterials) ??
        application.applicant.chapter?.name ??
        null
      : null;

  const identityLine = [
    application.applicant.email,
    application.position.type === "STAFF"
      ? staffLocationLabel ?? "Location not set"
      : application.position.chapter?.name ??
        application.applicant.chapter?.name ??
        "Global",
    socialMediaApplication
      ? `${socialMediaApplication.school} · ${gradeLabel(socialMediaApplication.grade)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const locationOptions =
    application.position.type === "STAFF" && isInterviewReviewer
      ? await listOperatingChaptersForFilters()
      : [];

  const facts: KeyFact[] = [
    {
      label: "Position",
      value: application.position.title,
      detail: formatStatus(application.position.type),
    },
    {
      label: application.position.type === "STAFF" ? "Location" : "Chapter",
      value:
        application.position.type === "STAFF"
          ? staffLocationLabel ?? "Not set"
          : application.applicant.chapter?.name ??
            application.position.chapter?.name ??
            "Global",
      tone:
        application.position.type === "STAFF" && !staffLocationLabel
          ? "attention"
          : undefined,
    },
    {
      label: "Interview",
      value: interviewFactValue,
      tone:
        interviewRequired && !firstPostedSlot && !isClosedApplication
          ? "attention"
          : undefined,
      href: interviewRequired ? "#interview" : undefined,
    },
    {
      label: "Applied",
      value: new Date(application.submittedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    },
  ];

  const applicationFields: Array<{ title: string; body: string }> = [];
  if (chapterProposal) {
    applicationFields.push(
      { title: "Proposed chapter", body: chapterProposal.chapterName },
      {
        title: "City / region",
        body: [chapterProposal.city, chapterProposal.region].filter(Boolean).join(", ") || "—",
      }
    );
    if (chapterProposal.partnerSchool) {
      applicationFields.push({ title: "Partner school", body: chapterProposal.partnerSchool });
    }
    if (chapterProposal.chapterVision) {
      applicationFields.push({ title: "Vision", body: chapterProposal.chapterVision });
    }
    if (chapterProposal.launchPlan) {
      applicationFields.push({ title: "Launch plan", body: chapterProposal.launchPlan });
    }
    if (chapterProposal.recruitmentPlan) {
      applicationFields.push({ title: "Recruitment plan", body: chapterProposal.recruitmentPlan });
    }
    if (chapterProposal.additionalContext) {
      applicationFields.push({
        title: "Additional context",
        body: chapterProposal.additionalContext,
      });
    }
  }
  if (socialMediaApplication) {
    applicationFields.push(
      { title: "School", body: socialMediaApplication.school },
      { title: "Grade", body: gradeLabel(socialMediaApplication.grade) },
      { title: "Platforms", body: socialMediaApplication.platforms },
      { title: "Experience", body: socialMediaApplication.experience }
    );
    if (socialMediaApplication.portfolioLinks) {
      applicationFields.push({
        title: "Portfolio / links",
        body: socialMediaApplication.portfolioLinks,
      });
    }
    applicationFields.push(
      { title: "Content ideas", body: socialMediaApplication.contentIdeas },
      {
        title: "Weekly availability",
        body: socialMediaApplication.weeklyAvailability,
      }
    );
    if (socialMediaApplication.additionalNotes) {
      applicationFields.push({
        title: "Additional notes",
        body: socialMediaApplication.additionalNotes,
      });
    }
  }
  if (application.coverLetter?.trim()) {
    applicationFields.push({
      title: socialMediaApplication ? "Why they want to join" : "Cover letter",
      body: application.coverLetter.trim(),
    });
  }
  if (
    !chapterProposal &&
    !socialMediaApplication &&
    application.additionalMaterials?.trim()
  ) {
    applicationFields.push({
      title: "Additional materials",
      body: application.additionalMaterials.trim(),
    });
  }

  const documents = application.resumeUrl
    ? [{ label: "Resume", href: application.resumeUrl }]
    : [];

  const badges: Array<{ label: string; tone: StatusTone }> = [
    {
      label: interviewRequired ? "Interview required" : "No interview",
      tone: interviewRequired ? "info" : "success",
    },
  ];

  const materialsMode: "social_media" | "chapter_proposal" | "generic" =
    socialMediaApplication || isSocialMediaManagerPosition(application.position.title)
      ? "social_media"
      : chapterProposal
        ? "chapter_proposal"
        : "generic";

  const canEditMaterials =
    isInterviewReviewer && !isClosedApplication && !hasApprovedDecision;

  const activeInterviewSlot =
    confirmedSlot ||
    application.interviewSlots.find((slot) => slot.status === "POSTED") ||
    null;

  return (
    <ApplicationReviewShell
      maxWidth={1100}
      actions={
        isAdmin
          ? [{ label: "Application board", href: "/admin/instructor-applicants", icon: "list" }]
          : undefined
      }
    >
      <HiringApplicationRecordSimple
        backHref={backHref}
        backLabel={backLabel}
        eyebrow={application.position.title}
        displayName={application.applicant.name || "Applicant"}
        identityLine={identityLine}
        status={{ label: formatStatus(application.status), tone: statusTone(application.status) }}
        badges={badges}
        nextStep={nextStep}
        facts={facts}
        contact={{
          email: application.applicant.email,
          phone: application.applicant.phone,
        }}
        locationEditor={
          application.position.type === "STAFF" && isInterviewReviewer ? (
            <StaffLocationEditor
              applicationId={application.id}
              currentLocation={staffLocationLabel}
              locations={locationOptions.map(({ id, name }) => ({ id, name }))}
            />
          ) : null
        }
        applicationFields={applicationFields}
        applicationEditor={
          <HiringApplicationMaterialsEditor
            applicationId={application.id}
            mode={materialsMode}
            canEdit={canEditMaterials}
            coverLetter={application.coverLetter ?? ""}
            additionalMaterials={
              !chapterProposal && !socialMediaApplication
                ? application.additionalMaterials ?? ""
                : ""
            }
            socialMedia={socialMediaApplication}
            chapterProposal={
              chapterProposal
                ? {
                    chapterName: chapterProposal.chapterName,
                    city: chapterProposal.city ?? "",
                    region: chapterProposal.region ?? "",
                    partnerSchool: chapterProposal.partnerSchool ?? "",
                    chapterVision: chapterProposal.chapterVision ?? "",
                    launchPlan: chapterProposal.launchPlan ?? "",
                    recruitmentPlan: chapterProposal.recruitmentPlan ?? "",
                    additionalContext: chapterProposal.additionalContext ?? "",
                    coverLetter: application.coverLetter ?? "",
                  }
                : null
            }
          />
        }
        documents={documents}
        interviewSection={
          interviewRequired || application.interviewSlots.length > 0 ? (
            <RecordSection id="interview" title="Interview" className="scroll-mt-24">
              {application.interviewSlots.length === 0 ? (
                <p className="m-0 text-[13px] text-ink-muted">No interview scheduled yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {application.interviewSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-[10px] border border-line-soft bg-surface-soft px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="m-0 text-[14px] font-semibold text-ink">
                            {new Date(slot.scheduledAt).toLocaleString()}
                          </p>
                          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                            {slot.duration} min
                            {slot.interviewer?.name
                              ? ` · ${slot.interviewer.name}`
                              : ""}
                          </p>
                        </div>
                        <StatusBadge tone={interviewSlotTone(slot.status)}>
                          {formatStatus(slot.status)}
                        </StatusBadge>
                      </div>

                      {slot.meetingLink ? (
                        <a
                          href={slot.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-[13px] font-semibold text-brand-700 no-underline hover:underline"
                        >
                          Join meeting
                        </a>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {isApplicant && slot.status === "POSTED" && !isClosedApplication ? (
                          <form action={confirmInterviewSlot}>
                            <input type="hidden" name="slotId" value={slot.id} />
                            <button
                              type="submit"
                              className="rounded-[9px] bg-brand-600 px-3 py-1.5 text-[12.5px] font-bold text-white"
                            >
                              Confirm this slot
                            </button>
                          </form>
                        ) : null}

                        {isInterviewReviewer &&
                        slot.status === "CONFIRMED" &&
                        !isClosedApplication &&
                        !hasApprovedDecision ? (
                          <form action={markApplicationInterviewCompleted}>
                            <input type="hidden" name="slotId" value={slot.id} />
                            <button
                              type="submit"
                              className="rounded-[9px] bg-brand-600 px-3 py-1.5 text-[12.5px] font-bold text-white"
                            >
                              Mark completed
                            </button>
                          </form>
                        ) : null}

                        {isInterviewReviewer &&
                        slot.status !== "COMPLETED" &&
                        slot.status !== "CANCELLED" &&
                        !isClosedApplication &&
                        !hasApprovedDecision ? (
                          <form action={cancelApplicationInterviewSlot}>
                            <input type="hidden" name="slotId" value={slot.id} />
                            <button
                              type="submit"
                              className="rounded-[9px] border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted"
                            >
                              Cancel slot
                            </button>
                          </form>
                        ) : null}

                        {(slot.status === "POSTED" || slot.status === "CONFIRMED") && (
                          <AddToCalendarButton
                            scheduledAt={slot.scheduledAt}
                            duration={slot.duration}
                            positionTitle={application.position.title}
                            applicantName={application.applicant.name || "Candidate"}
                            meetingLink={slot.meetingLink}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isInterviewReviewer && !isClosedApplication && !hasApprovedDecision ? (
                <HiringApplicationInterviewSchedule
                  applicationId={application.id}
                  scheduledAtISO={
                    activeInterviewSlot ? activeInterviewSlot.scheduledAt.toISOString() : null
                  }
                  meetingLink={activeInterviewSlot?.meetingLink ?? null}
                  durationMinutes={activeInterviewSlot?.duration ?? 30}
                  canSchedule
                />
              ) : null}
            </RecordSection>
          ) : null
        }
        notesSection={
          isInterviewReviewer ? (
            <RecordSection id="notes" title="Interview notes" className="scroll-mt-24">
              <StaffInterviewNotesEditor
                applicationId={application.id}
                actorId={currentUser.id}
                disabled={isClosedApplication}
                notes={application.interviewNotes.map((note) => ({
                  id: note.id,
                  content: note.content,
                  rating: note.rating,
                  recommendation: note.recommendation,
                  strengths: note.strengths,
                  concerns: note.concerns,
                  nextStepSuggestion: note.nextStepSuggestion,
                  createdAt: note.createdAt,
                  author: note.author,
                }))}
              />
            </RecordSection>
          ) : null
        }
        actionsSection={
          isInterviewReviewer && !isClosedApplication ? (
            <RecordSection id="actions" title="Reviewer actions" className="scroll-mt-24">
              <div className="flex flex-col gap-5">
                {canManagePipeline ? (
                  <form action={updateApplicationStatus} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[12px] font-semibold text-ink-muted">
                      Status
                      <select
                        name="status"
                        className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-[13px] text-ink"
                        defaultValue={
                          reviewStatuses.includes(application.status)
                            ? application.status
                            : "UNDER_REVIEW"
                        }
                      >
                        {reviewStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="h-9 rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-bold text-white"
                    >
                      Update status
                    </button>
                  </form>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/interviews/schedule"
                    className="inline-flex items-center rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold text-ink no-underline hover:border-brand-300 hover:text-brand-800"
                  >
                    Interview scheduler
                  </Link>
                  <Link
                    href="/interviews?scope=hiring&view=team&state=needs_action"
                    className="inline-flex items-center rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold text-ink no-underline hover:border-brand-300 hover:text-brand-800"
                  >
                    Interview command center
                  </Link>
                </div>
              </div>
            </RecordSection>
          ) : !isInterviewReviewer ? (
            <RecordSection title="Updates">
              <p className="m-0 text-[13px] text-ink-muted">
                {interviewRequired
                  ? "Reviewer notes stay internal. Interview scheduling and the final decision will appear here."
                  : "This role does not require an interview. You'll be notified when a decision is made."}
              </p>
            </RecordSection>
          ) : null
        }
        decisionSection={
          isInterviewReviewer ? (
            <RecordSection
              id="decision"
              title="Decision"
              className={
                !hasApprovedDecision
                  ? "scroll-mt-24 overflow-hidden p-4 sm:p-6 border-brand-200 bg-gradient-to-br from-brand-50/80 via-surface to-surface"
                  : "scroll-mt-24"
              }
            >
              <StaffDecisionPanel
                applicationId={application.id}
                canDecide={canFinalizeStaffDecision}
                checks={staffReadinessChecks}
                summaryLine={staffReadinessHeadline}
                decided={hasApprovedDecision}
                decidedLabel={
                  hasApprovedDecision
                    ? application.decision?.accepted
                      ? "Accepted"
                      : "Rejected"
                    : null
                }
              />
              {hasApprovedDecision && application.decision ? (
                <div className="mt-4 border-t border-line-soft pt-4">
                  {application.decision.notes ? (
                    <p className="m-0 whitespace-pre-wrap text-[14px] text-ink">
                      {application.decision.notes}
                    </p>
                  ) : null}
                  <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
                    Decided by {application.decision.decidedBy.name} on{" "}
                    {new Date(
                      application.decision.hiringChairAt ?? application.decision.decidedAt
                    ).toLocaleString()}
                  </p>
                </div>
              ) : null}
            </RecordSection>
          ) : null
        }
      />
    </ApplicationReviewShell>
  );
}
