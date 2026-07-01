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
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { ApplicationRecordSimple } from "@/components/instructor-applicants/ApplicationRecordSimple";
import {
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

  // Action System 4.0 — tracker actions linked to this application.
  const linkedActions = await getActionsForEntity("INSTRUCTOR_APPLICATION", id, {
    id: sessionUser.id,
    roles: sessionUser.roles,
    primaryRole: sessionUser.primaryRole ?? null,
    adminSubtypes: sessionUser.adminSubtypes ?? [],
  }).catch(() => []);

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
                  href: detailHref,
                  cta: "Schedule interview",
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
    <ApplicationReviewShell
      maxWidth={900}
      actions={[
        { label: "Application board", href: "/admin/instructor-applicants", icon: "list" },
        ...(viewerIsChair
          ? [{ label: "Chair queue", href: "/admin/instructor-applicants/chair-queue", icon: "inbox" as const }]
          : []),
        { label: "Home", href: "/", icon: "compass" },
      ]}
    >
      <ApplicationRecordSimple
      record={record}
      status={status}
      identityLine={identityLine}
      facts={facts}
      nextStep={nextStep}
      readinessChecks={readinessChecks}
      readyCount={readyCount}
      viewerIsChair={viewerIsChair}
      detailHref={detailHref}
      cockpitHref={cockpitHref}
      applicantIsMember={applicantIsMember}
      chairDecisionOptions={CHAIR_DECISION_OPTIONS}
      linkedActions={linkedActions}
      sessionUser={{
        id: sessionUser.id,
        roles: sessionUser.roles,
        primaryRole: sessionUser.primaryRole ?? null,
        adminSubtypes: sessionUser.adminSubtypes ?? [],
      }}
    />
    </ApplicationReviewShell>
  );
}
