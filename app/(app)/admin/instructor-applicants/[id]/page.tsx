import { notFound } from "next/navigation";

import { requireApplicationReviewerPage } from "@/lib/page-guards";
import {
  assertCanViewApplicant,
  canChangeReviewer,
  canChangeLeadInterviewer,
  canSeeChairQueue,
  getHiringActor,
} from "@/lib/chapter-hiring-permissions";
import { loadApplicationRecord } from "@/lib/applications/application-record";
import {
  buildDecisionReadinessChecks,
  readinessFactValue,
  readinessSummary,
} from "@/lib/applications/decision-readiness";
import { loadInlineReviewPanels } from "@/lib/applications/load-inline-review-panels";
import {
  getApplicationForWorkspace,
  getCandidateInterviewers,
  getCandidateReviewers,
} from "@/lib/instructor-applicant-board-queries";
import {
  canMakeFinalApplicantDecision,
  getActiveChair,
  NON_CHAIR_DECISION_MESSAGE,
} from "@/lib/active-chair";
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { ApplicationRecordSimple } from "@/components/instructor-applicants/ApplicationRecordSimple";
import {
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

const DECIDED_STATUSES = new Set([
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
  "WAITLISTED",
  "WITHDRAWN",
]);

/** Deep-serialize Prisma rows for client components (dates → ISO strings). */
function serializeWorkspaceApplicant(
  app: NonNullable<Awaited<ReturnType<typeof getApplicationForWorkspace>>>
) {
  return JSON.parse(
    JSON.stringify(app, (_key, value) => (value instanceof Date ? value.toISOString() : value))
  ) as NonNullable<Awaited<ReturnType<typeof getApplicationForWorkspace>>>;
}

/**
 * Application 360 — one scrollable record: contact, materials, reviews,
 * readiness, and inline chair decision. No separate cockpit or tab strip.
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

  const [workspaceRow, activeChair, inlineReviewPanels] = await Promise.all([
    !DECIDED_STATUSES.has(record.status)
      ? getApplicationForWorkspace(id)
      : Promise.resolve(null),
    canSeeChairQueue(actor) ? getActiveChair() : Promise.resolve(null),
    loadInlineReviewPanels(id, record, actor),
  ]);

  const canMakeFinalDecision = canMakeFinalApplicantDecision(
    { id: sessionUser.id },
    activeChair
  );
  const decisionApplicant = workspaceRow ? serializeWorkspaceApplicant(workspaceRow) : null;

  const viewerIsChair = canSeeChairQueue(actor);
  const isActiveChair = canMakeFinalDecision;

  const status = STATUS_META[record.status] ?? {
    label: pretty(record.status),
    tone: "neutral" as StatusTone,
  };

  const readinessChecks = buildDecisionReadinessChecks(record, {
    applicationId: id,
    actorId: sessionUser.id,
    inlineForms: true,
  });
  const { readyCount, headline: readinessHeadline } = readinessSummary(readinessChecks);

  const canChangeReviewerRole = canChangeReviewer(actor, record.applicant.chapterId, {
    isActiveChair,
  });
  const canChangeLeadInterviewerRole = canChangeLeadInterviewer(actor, record.applicant.chapterId, {
    isActiveChair,
  });
  let reviewerCandidates: Awaited<ReturnType<typeof getCandidateReviewers>> = [];
  let leadInterviewerCandidates: Awaited<ReturnType<typeof getCandidateInterviewers>> = [];
  if (canChangeReviewerRole) {
    try {
      reviewerCandidates = await getCandidateReviewers(id);
    } catch {
      reviewerCandidates = [];
    }
  }
  if (canChangeLeadInterviewerRole) {
    try {
      leadInterviewerCandidates = await getCandidateInterviewers(id, { role: "LEAD" });
    } catch {
      leadInterviewerCandidates = [];
    }
  }

  const nextStep = DECIDED_STATUSES.has(record.status)
    ? null
    : record.status === "CHAIR_REVIEW"
      ? {
          title: "Decision needed",
          detail: record.chairQueuedAtISO
            ? `In the chair queue since ${fmtDate(record.chairQueuedAtISO)}.`
            : "This application is waiting on a chair decision.",
          href: "#decision",
          cta: "Go to decision",
        }
      : record.status === "SUBMITTED"
        ? record.reviewer
          ? {
              title: "Review pending",
              detail: `${record.reviewer.name} is assigned but hasn't submitted a review yet.`,
              href: "#inline-initial-review",
              cta: "Open review form",
            }
          : {
              title: "Assign a reviewer",
              detail: "Choose who will lead the initial application review.",
              href: "",
              cta: "Assign reviewer",
              ctaKind: "assign-reviewer" as const,
            }
        : record.status === "UNDER_REVIEW"
          ? {
              title: "Review in progress",
              detail: record.reviewer
                ? `${record.reviewer.name} is reviewing.`
                : "A review is in progress.",
              href: "#inline-initial-review",
              cta: "Open review form",
            }
          : record.status === "INFO_REQUESTED"
            ? record.applicantResponse
              ? {
                  title: "Applicant responded — resume the review",
                  detail: "The requested information has been provided.",
                  href: "#application",
                  cta: "View response",
                }
              : {
                  title: "Waiting on the applicant",
                  detail: record.infoRequest
                    ? `Requested: ${record.infoRequest.slice(0, 140)}`
                    : "An information request is outstanding.",
                  href: "#application",
                  cta: "View request",
                }
            : record.status === "PRE_APPROVED"
              ? {
                  title: "Schedule the interview",
                  detail:
                    "Pre-approved — schedule an interview from the pipeline board when ready.",
                  href: "",
                  cta: "",
                }
              : record.status === "INTERVIEW_SCHEDULED"
                ? {
                    title: record.interviewScheduledAtISO
                      ? "Interview scheduled"
                      : "Interview scheduling in progress",
                    detail: record.interviewScheduledAtISO
                      ? `Interview on ${fmtDate(record.interviewScheduledAtISO)}. Mark complete on the pipeline when done.`
                      : "Waiting on the applicant to pick a time from the proposed slots.",
                    href: "#reviews",
                    cta: "View interview",
                  }
                : record.status === "INTERVIEW_COMPLETED"
                  ? {
                      title: "Submit interview reviews, then queue for chair",
                      detail:
                        record.interviewReviews.filter((r) => r.status === "SUBMITTED").length ===
                        0
                          ? "The interview happened but no review is submitted yet."
                          : "Reviews are in — move this application to the chair queue.",
                      href: "#reviews",
                      cta: "View reviews",
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
      value: readinessFactValue(readinessChecks),
      tone: readyCount < readinessChecks.length && record.status === "CHAIR_REVIEW" ? "attention" : undefined,
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
      maxWidth={1280}
      actions={[
        { label: "Application board", href: "/admin/instructor-applicants", icon: "list" },
        ...(viewerIsChair
          ? [
              {
                label: "Chair queue",
                href: "/admin/instructor-applicants/chair-queue",
                icon: "inbox" as const,
              },
            ]
          : []),
      ]}
    >
      <ApplicationRecordSimple
        record={record}
        status={status}
        identityLine={identityLine}
        facts={facts}
        nextStep={nextStep}
        readinessChecks={readinessChecks}
        readinessHeadline={readinessHeadline}
        actorId={sessionUser.id}
        canMakeFinalDecision={canMakeFinalDecision}
        activeChairName={activeChair?.name ?? activeChair?.email ?? null}
        decisionLockMessage={NON_CHAIR_DECISION_MESSAGE}
        decisionApplicant={decisionApplicant}
        inlineReviewPanels={inlineReviewPanels}
        returnTo={`/admin/instructor-applicants/${id}`}
        canMarkMaterials
        canChangeReviewer={canChangeReviewerRole}
        reviewerCandidates={reviewerCandidates}
        canChangeLeadInterviewer={canChangeLeadInterviewerRole}
        leadInterviewerCandidates={leadInterviewerCandidates}
      />
    </ApplicationReviewShell>
  );
}
