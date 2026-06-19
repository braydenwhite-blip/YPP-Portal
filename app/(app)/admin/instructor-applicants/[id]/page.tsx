import { notFound } from "next/navigation";

import { requireApplicationReviewerPage } from "@/lib/page-guards";
import {
  assertCanViewApplicant,
  canSeeChairQueue,
  getHiringActor,
} from "@/lib/chapter-hiring-permissions";
import { loadApplicationRecord } from "@/lib/applications/application-record";
import { readinessSignalLabel } from "@/lib/readiness-signals";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";
import { canCreateAction } from "@/lib/people-strategy/action-permissions";
import {
  getMeetingsForEntity,
  meetingDisplayTitle,
} from "@/lib/people-strategy/meetings-queries";
import { meetingTypeLabel } from "@/lib/people-strategy/meeting-operating-model";
import { meetingPrefillToQuery } from "@/lib/people-strategy/action-prefill";
import { EntityActionPanel } from "@/components/work/entity-action-panel";
import {
  ButtonLink,
  Checklist,
  DecisionDock,
  EntityChip,
  KeyFactsGrid,
  ProfileHeader,
  RecordSection,
  StatusBadge,
  type ChecklistItem,
  type DecisionOption,
  type KeyFact,
  type StatusTone,
} from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Application record — Pathways Portal" };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pretty(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  SUBMITTED: { label: "Submitted", tone: "neutral" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  INFO_REQUESTED: { label: "Info requested", tone: "warning" },
  PRE_APPROVED: { label: "Pre-approved", tone: "info" },
  INTERVIEW_SCHEDULED: { label: "Interview scheduled", tone: "info" },
  INTERVIEW_COMPLETED: { label: "Interview completed", tone: "info" },
  CHAIR_REVIEW: { label: "Chair review", tone: "brand" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Declined", tone: "danger" },
  ON_HOLD: { label: "On hold", tone: "warning" },
  WAITLISTED: { label: "Waitlisted", tone: "info" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

/** The real chair vocabulary — 1:1 with the ChairDecisionAction enum. */
const CHAIR_DECISION_OPTIONS: DecisionOption[] = [
  { label: "Approve", description: "approve and start instructor onboarding." },
  {
    label: "Approve with conditions",
    description: "approve with named conditions that must be satisfied first.",
  },
  {
    label: "Request more information",
    description: "send the applicant a specific information request.",
  },
  {
    label: "Request second interview",
    description: "send the application back for another interview round.",
  },
  { label: "Hold", description: "pause the application with a recorded reason." },
  { label: "Waitlist", description: "keep the applicant warm for a later cohort." },
  { label: "Decline", description: "decline with a recorded rejection reason." },
];

const DECIDED_STATUSES = new Set([
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
  "WAITLISTED",
  "WITHDRAWN",
]);

/**
 * Application 360 (Knowledge OS V2, plan §16) — the decision-first record
 * page for one instructor application: who, what track, what stage, what is
 * concretely missing, what reviewers said, and what the chair can do next.
 * Deep workflows stay where they are proven: the role-scoped detail page
 * (materials, assignment tools) and the chair decision cockpit (commit form
 * with idempotency/conditions/warnings). This page is the connected summary
 * altitude that previously didn't exist — the old route was a blind redirect.
 */
export default async function ApplicationRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireApplicationReviewerPage();
  const { id } = await params;

  const record = await loadApplicationRecord(id);
  if (!record) notFound();

  const actor = await getHiringActor(sessionUser.id);
  try {
    assertCanViewApplicant(actor, {
      id: record.id,
      applicantId: record.applicant.id,
      reviewerId: record.reviewer?.id ?? null,
      interviewRound: record.interviewRound,
      applicantChapterId: record.applicant.chapterId,
      interviewerAssignments: record.interviewerAssignments.map((assignment) => ({
        interviewerId: assignment.interviewer.id,
        round: assignment.round,
        removedAt: null,
      })),
    });
  } catch {
    notFound();
  }

  const trackerViewer = {
    id: sessionUser.id,
    roles: sessionUser.roles,
    primaryRole: sessionUser.primaryRole ?? null,
    adminSubtypes: sessionUser.adminSubtypes ?? [],
  };
  const canUseMeetingTracker = canCreateAction(trackerViewer);
  const interviewerIds = Array.from(
    new Set(record.interviewerAssignments.map((assignment) => assignment.interviewer.id))
  );
  const interviewMeetingHref = meetingPrefillToQuery({
    relatedType: "INSTRUCTOR_APPLICATION",
    relatedId: record.id,
    area: "APPLICATIONS",
    meetingType: "INSTRUCTOR_APPLICANT_INTERVIEW",
    title: `Instructor applicant interview: ${record.displayName}`,
    purpose: `Interview ${record.displayName}, capture notes, concerns, recommendation, and applicant follow-up actions.`,
    facilitatorId: interviewerIds[0],
    attendeeIds: interviewerIds,
    agendaTitles: [
      "Applicant identity and current stage",
      "Teaching motivation and availability",
      "Curriculum or class idea discussion",
      "Scores, notes, and concerns",
      "Recommended next step",
      "Follow-up actions",
    ],
  });

  // Action System 4.0 — tracker actions linked to this application.
  const [linkedActions, linkedMeetings] = await Promise.all([
    getActionsForEntity("INSTRUCTOR_APPLICATION", id, trackerViewer).catch(() => []),
    canUseMeetingTracker
      ? getMeetingsForEntity("INSTRUCTOR_APPLICATION", id, 8).catch(() => [])
      : Promise.resolve([]),
  ]);

  const viewerIsChair = canSeeChairQueue(actor);

  const status = STATUS_META[record.status] ?? {
    label: pretty(record.status),
    tone: "neutral" as StatusTone,
  };
  const detailHref = `/applications/instructor/${record.id}`;
  const cockpitHref = `/admin/instructor-applicants/${record.id}/review`;
  const applicantIsMember = record.applicant.primaryRole !== "APPLICANT";

  // Decision-readiness checks — the four real inputs, by name (plan §16:
  // never a bare percentage without its inputs).
  const readinessChecks: ChecklistItem[] = (
    [
      "hasMaterialsComplete",
      "hasSubmittedInterviewReviews",
      "hasReviewerRecommendation",
      "hasNoOpenInfoRequest",
    ] as const
  ).map((key) => {
    const meta = readinessSignalLabel(key);
    const done = record.readiness[key];
    return {
      label: meta.title,
      done,
      detail: done ? meta.complete : meta.gap,
      href: detailHref,
    };
  });
  const readyCount = readinessChecks.filter((c) => c.done).length;

  // The concrete next step per pipeline stage.
  const nextStep = DECIDED_STATUSES.has(record.status)
    ? null
    : record.status === "CHAIR_REVIEW"
      ? {
          title: "Decision needed",
          detail: record.chairQueuedAtISO
            ? `In the chair queue since ${fmtDate(record.chairQueuedAtISO)}.`
            : "This application is waiting on a chair decision.",
          href: cockpitHref,
          cta: "Open decision cockpit",
        }
      : record.status === "SUBMITTED"
        ? record.reviewer
          ? {
              title: "Review pending",
              detail: `${record.reviewer.name} is assigned but hasn't submitted a review yet.`,
              href: detailHref,
              cta: "Open application",
            }
          : {
              title: "Assign a reviewer",
              detail: "Nobody is reviewing this application yet.",
              href: detailHref,
              cta: "Assign reviewer",
            }
        : record.status === "UNDER_REVIEW"
          ? {
              title: "Review in progress",
              detail: record.reviewer
                ? `${record.reviewer.name} is reviewing.`
                : "A review is in progress.",
              href: detailHref,
              cta: "Open application",
            }
          : record.status === "INFO_REQUESTED"
            ? record.applicantResponse
              ? {
                  title: "Applicant responded — resume the review",
                  detail: "The requested information has been provided.",
                  href: detailHref,
                  cta: "Open application",
                }
              : {
                  title: "Waiting on the applicant",
                  detail: record.infoRequest
                    ? `Requested: ${record.infoRequest.slice(0, 140)}`
                    : "An information request is outstanding.",
                  href: detailHref,
                  cta: "Open application",
                }
            : record.status === "PRE_APPROVED"
              ? {
                  title: "Schedule the interview",
                  detail: "Pre-approved; no interview is on the calendar yet.",
                  href: canUseMeetingTracker ? interviewMeetingHref : detailHref,
                  cta: canUseMeetingTracker ? "Schedule interview meeting" : "Schedule interview",
                }
              : record.status === "INTERVIEW_SCHEDULED"
                ? {
                    title: record.interviewScheduledAtISO
                      ? "Interview scheduled — mark it complete afterwards"
                      : "Interview scheduling in progress",
                    detail: record.interviewScheduledAtISO
                      ? `Interview on ${fmtDate(record.interviewScheduledAtISO)}. Once it happens, mark the interview complete to move into post-interview review.`
                      : "Waiting on the applicant to pick a time from the proposed slots.",
                    href: detailHref,
                    cta: "Open application",
                  }
                : record.status === "INTERVIEW_COMPLETED"
                  ? {
                      title: "Submit interview reviews, then queue for chair",
                      detail:
                        record.interviewReviews.filter((r) => r.status === "SUBMITTED")
                          .length === 0
                          ? "The interview happened but no review is submitted yet."
                          : "Reviews are in — move this application to the chair queue.",
                      href: detailHref,
                      cta: "Open application",
                    }
                  : null;

  const facts: KeyFact[] = [
    {
      label: "Stage",
      value: status.label,
      detail: `updated ${fmtDate(record.updatedAtISO)}`,
    },
    { label: "Track", value: pretty(record.applicationTrack) },
    {
      label: "Reviewer",
      value: record.reviewer ? record.reviewer.name : "Unassigned",
      tone: record.reviewer ? undefined : "attention",
      detail: record.reviewerAssignedAtISO
        ? `assigned ${fmtDate(record.reviewerAssignedAtISO)}`
        : undefined,
      href: "#reviews",
    },
    {
      label: "Interview",
      value: record.interviewReviews.some((r) => r.status === "SUBMITTED")
        ? "Reviewed"
        : record.interviewScheduledAtISO
          ? fmtDate(record.interviewScheduledAtISO)
          : "Not scheduled",
      href: "#reviews",
    },
    {
      label: "Decision readiness",
      value: `${readyCount}/4 checks`,
      tone: readyCount < 4 && record.status === "CHAIR_REVIEW" ? "attention" : undefined,
      href: "#readiness",
    },
    {
      label: "Applied",
      value: fmtDate(record.createdAtISO),
      detail: pretty(record.source),
    },
  ];

  const identityLine = [
    record.applicant.email,
    record.applicant.chapterName,
    record.schoolName,
    [record.city, record.stateProvince].filter(Boolean).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <ProfileHeader
        name={record.displayName}
        eyebrow="Application record"
        identityLine={identityLine}
        backHref="/admin/instructor-applicants"
        backLabel="Application board"
        badges={
          <>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {record.isReapplication ? (
              <StatusBadge tone="info">Reapplication</StatusBadge>
            ) : null}
            {record.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
          </>
        }
        actions={
          <>
            <ButtonLink href={detailHref} variant="primary" size="md">
              Open full application
            </ButtonLink>
            {record.status === "CHAIR_REVIEW" && viewerIsChair ? (
              <ButtonLink href={cockpitHref} size="md">
                Decision cockpit
              </ButtonLink>
            ) : null}
            {canUseMeetingTracker ? (
              <ButtonLink href={interviewMeetingHref} variant="secondary" size="md">
                Schedule interview
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <KeyFactsGrid facts={facts} />

      {nextStep ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warning-700/25 bg-warning-100/40 px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-warning-700">
              Next step
            </p>
            <p className="m-0 text-[14.5px] font-semibold text-ink">{nextStep.title}</p>
            <p className="m-0 text-[12.5px] text-ink-muted">{nextStep.detail}</p>
          </div>
          <ButtonLink href={nextStep.href} size="sm">
            {nextStep.cta} →
          </ButtonLink>
        </div>
      ) : null}

      <DecisionDock
        tone={record.status === "CHAIR_REVIEW" ? "attention" : "default"}
        statusLabel={
          record.latestDecision
            ? `${pretty(record.latestDecision.action)} · ${fmtDate(record.latestDecision.decidedAtISO)}`
            : record.status === "CHAIR_REVIEW"
              ? "Decision needed"
              : "Not yet at chair review"
        }
        statusDetail={
          record.latestDecision
            ? [
                `Decided by ${record.latestDecision.decidedBy}`,
                record.latestDecision.conditionCount > 0
                  ? `${record.latestDecision.conditionCount} condition${record.latestDecision.conditionCount === 1 ? "" : "s"}`
                  : null,
                record.latestDecision.rationale
                  ? `"${record.latestDecision.rationale.slice(0, 160)}"`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : record.status === "CHAIR_REVIEW"
              ? `${readyCount}/4 readiness checks met — the cockpit commits the decision.`
              : "The chair vocabulary below applies once the application reaches the chair queue."
        }
        primaryAction={
          record.status === "CHAIR_REVIEW" && viewerIsChair ? (
            <ButtonLink href={cockpitHref} variant="primary" size="md">
              Decide in the cockpit →
            </ButtonLink>
          ) : undefined
        }
        options={
          record.latestDecision && DECIDED_STATUSES.has(record.status)
            ? undefined
            : CHAIR_DECISION_OPTIONS
        }
      />

      <RecordSection
        id="readiness"
        title="Decision readiness"
        description={`${readyCount} of 4 inputs in place — each check is a real gate, not a score.`}
      >
        <Checklist items={readinessChecks} />
      </RecordSection>

      <RecordSection
        id="reviews"
        title="Reviews & interviews"
        description="What reviewers and interviewers actually said — summaries here, full editors on the application page."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Application reviews
            </p>
            {record.applicationReviews.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-muted">No reviews yet.</p>
            ) : (
              record.applicationReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[8px] border border-line-soft px-3.5 py-2.5"
                >
                  <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                    {review.reviewerName}
                    {review.isLeadReview ? (
                      <StatusBadge tone="brand">Lead</StatusBadge>
                    ) : null}
                    <StatusBadge
                      tone={review.status === "SUBMITTED" ? "success" : "warning"}
                    >
                      {pretty(review.status)}
                    </StatusBadge>
                  </p>
                  <p className="m-0 text-[12px] text-ink-muted">
                    {[
                      review.overallRating ? `Rated ${pretty(review.overallRating)}` : null,
                      review.nextStep ? `Next step: ${pretty(review.nextStep)}` : null,
                      review.submittedAtISO ? fmtDate(review.submittedAtISO) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Draft in progress"}
                  </p>
                  {review.summary ? (
                    <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink">
                      {review.summary.length > 280
                        ? `${review.summary.slice(0, 280)}…`
                        : review.summary}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Interviews
            </p>
            {record.interviewerAssignments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {record.interviewerAssignments.map((assignment) => (
                  <EntityChip
                    key={assignment.id}
                    type="person"
                    id={assignment.interviewer.id}
                    label={assignment.interviewer.name}
                    sublabel={`${pretty(assignment.role)}${assignment.round && assignment.round > 1 ? ` · round ${assignment.round}` : ""}`}
                    href={`/people/${assignment.interviewer.id}`}
                  />
                ))}
              </div>
            ) : null}
            {record.interviewReviews.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-muted">
                {record.interviewScheduledAtISO
                  ? `Interview scheduled for ${fmtDate(record.interviewScheduledAtISO)} — no review submitted yet.`
                  : "No interview activity yet."}
              </p>
            ) : (
              record.interviewReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[8px] bg-surface-soft px-3.5 py-2.5"
                >
                  <p className="m-0 text-[13.5px] font-semibold text-ink">
                    {review.reviewerName}
                    {review.round > 1 ? (
                      <span className="ml-2 font-normal text-ink-muted">
                        Round {review.round}
                      </span>
                    ) : null}
                  </p>
                  <p className="m-0 text-[12px] text-ink-muted">
                    {[
                      review.recommendation
                        ? `Recommends: ${pretty(review.recommendation)}`
                        : review.status === "SUBMITTED"
                          ? "No recommendation recorded"
                          : "Draft in progress",
                      review.overallRating ? `Rated ${pretty(review.overallRating)}` : null,
                      review.submittedAtISO ? fmtDate(review.submittedAtISO) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </RecordSection>

      {canUseMeetingTracker ? (
        <RecordSection
          id="interview-meetings"
          title="Interview meetings"
          description="Meeting Tracker records linked to this applicant — agenda, notes, decisions, and follow-up actions stay connected here."
          action={
            <ButtonLink href={interviewMeetingHref} variant="secondary" size="sm">
              Schedule interview →
            </ButtonLink>
          }
        >
          {linkedMeetings.length === 0 ? (
            <p className="m-0 text-[13px] text-ink-muted">
              No interview meeting is linked yet. Schedule one here so notes and follow-up
              actions attach back to this application.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {linkedMeetings.map((meeting) => (
                <li
                  key={meeting.id}
                  className="rounded-[8px] border border-line-soft px-3.5 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <ButtonLink
                        href={`/actions/meetings/${meeting.id}`}
                        variant="ghost"
                        size="sm"
                        className="h-auto justify-start px-0 py-0 text-[13.5px]"
                      >
                        {meetingDisplayTitle(meeting)} →
                      </ButtonLink>
                      <p className="m-0 mt-1 text-[12px] text-ink-muted">
                        {fmtDateTime(meeting.date)} ·{" "}
                        {meetingTypeLabel(meeting.meetingType)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={
                        meeting.summaryStatus === "SENT"
                          ? "success"
                          : meeting.status === "CANCELLED"
                            ? "neutral"
                            : "info"
                      }
                    >
                      {pretty(meeting.status)}
                    </StatusBadge>
                  </div>
                  <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
                    {meeting.agendaItems.length} agenda item
                    {meeting.agendaItems.length === 1 ? "" : "s"} ·{" "}
                    {meeting.followUps.length} follow-up
                    {meeting.followUps.length === 1 ? "" : "s"} ·{" "}
                    {meeting.actionItems.length} linked action
                    {meeting.actionItems.length === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
      ) : null}

      <RecordSection
        id="materials"
        title="Materials & documents"
        description="What the applicant has actually provided."
        action={
          <ButtonLink href={detailHref} variant="ghost" size="sm">
            Read materials →
          </ButtonLink>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Motivation", record.materials.motivation],
                ["Course outline", record.materials.courseOutline],
                ["First-class plan", record.materials.firstClassPlan],
                ...(record.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR"
                  ? ([
                      [
                        record.workshopOutlineTitle
                          ? `Workshop outline · ${record.workshopOutlineTitle}`
                          : "Workshop outline",
                        record.materials.workshopOutline,
                      ],
                    ] as Array<[string, boolean]>)
                  : []),
              ] as Array<[string, boolean]>
            ).map(([label, present]) => (
              <StatusBadge key={label} tone={present ? "success" : "warning"}>
                {label}: {present ? "provided" : "missing"}
              </StatusBadge>
            ))}
          </div>
          {record.documents.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {record.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"
                >
                  <span className="font-medium text-ink">
                    {doc.originalName ?? pretty(doc.kind)}
                    <span className="ml-2 font-normal text-ink-muted">
                      {pretty(doc.kind)}
                    </span>
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    {fmtDate(doc.uploadedAtISO)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {record.subjectsOfInterest ? (
            <p className="m-0 text-[12.5px] text-ink-muted">
              Subjects of interest: {record.subjectsOfInterest}
            </p>
          ) : null}
        </div>
      </RecordSection>

      {(applicantIsMember || record.previousApplicationId || record.decisionHistory.length > 1) && (
        <RecordSection
          id="connections"
          title="Connected records"
          description="Where this application links into the rest of the portal."
        >
          <div className="flex flex-wrap gap-2">
            {applicantIsMember ? (
              <EntityChip
                type="person"
                id={record.applicant.id}
                label={record.applicant.name ?? record.applicant.email}
                sublabel="Member record"
                href={`/people/${record.applicant.id}`}
              />
            ) : (
              <span className="text-[13px] text-ink-muted">
                The applicant doesn&apos;t have a member profile yet — it is created on
                approval.
              </span>
            )}
            {record.previousApplicationId ? (
              <EntityChip
                type="applicant"
                id={record.previousApplicationId}
                label="Previous application"
                href={`/admin/instructor-applicants/${record.previousApplicationId}`}
              />
            ) : null}
          </div>
          {record.decisionHistory.length > 1 ? (
            <div className="mt-3 border-t border-line-soft pt-3">
              <p className="m-0 mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                Decision history
              </p>
              {record.decisionHistory.map((decision) => (
                <p key={decision.id} className="m-0 text-[12.5px] text-ink-muted">
                  {pretty(decision.action)} · {decision.decidedBy} ·{" "}
                  {fmtDate(decision.decidedAtISO)}
                  {decision.superseded ? " · superseded" : ""}
                </p>
              ))}
            </div>
          ) : null}
        </RecordSection>
      )}

      <RecordSection
        id="work"
        title="Action operating panel"
        description="Tracker actions linked to this application — follow-ups, blockers, and the suggested next move."
      >
        <EntityActionPanel
          actions={linkedActions}
          viewer={trackerViewer}
          entityType="INSTRUCTOR_APPLICATION"
          entityId={record.id}
          entityLabel={record.displayName}
        />
      </RecordSection>

      {record.timeline.length > 0 ? (
        <RecordSection
          id="timeline"
          title="Timeline"
          description="Every recorded application event, newest first."
        >
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {record.timeline.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-1.5 text-[13px] last:border-b-0"
              >
                <span className="font-medium text-ink">
                  {pretty(event.kind)}
                  {event.actorName ? (
                    <span className="ml-2 font-normal text-ink-muted">
                      {event.actorName}
                    </span>
                  ) : null}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {fmtDate(event.createdAtISO)}
                </span>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}
    </div>
  );
}
