import { prisma } from "@/lib/prisma";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import {
  computeReadinessSignals,
  type ReadinessSignals,
} from "@/lib/readiness-signals";

/**
 * Application 360 record reads (Knowledge OS V2, plan §16).
 *
 * One loader assembling the decision-first picture of an instructor
 * application at ANY pipeline status (the final-review queries only serve
 * CHAIR_REVIEW): identity, track, stage, the concrete decision-readiness
 * checks, reviewer/interviewer state, review content summaries, documents,
 * decision history, and the timeline. Review CONTENT here is the summary
 * altitude — the full editors stay on the dedicated hiring surfaces.
 */

export type ApplicationRecord = {
  id: string;
  status: string;
  displayName: string;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    primaryRole: string;
    chapterId: string | null;
    chapterName: string | null;
  };
  interviewRound: number | null;
  applicationTrack: string;
  instructorSubtype: string;
  source: string;
  isReapplication: boolean;
  previousApplicationId: string | null;
  schoolName: string | null;
  subjectsOfInterest: string | null;
  city: string | null;
  stateProvince: string | null;
  createdAtISO: string;
  updatedAtISO: string;
  chairQueuedAtISO: string | null;
  materialsReadyAtISO: string | null;
  interviewScheduledAtISO: string | null;
  infoRequest: string | null;
  applicantResponse: string | null;
  rejectionReason: string | null;
  archived: boolean;
  /** The 4 concrete decision-readiness checks (lib/readiness-signals). */
  readiness: ReadinessSignals;
  /** Materials presence, field by field — never a bare percentage. */
  materials: {
    courseOutline: boolean;
    firstClassPlan: boolean;
    workshopOutline: boolean;
    motivation: boolean;
  };
  workshopOutlineTitle: string | null;
  reviewer: { id: string; name: string } | null;
  reviewerAssignedAtISO: string | null;
  applicationReviews: Array<{
    id: string;
    reviewerName: string;
    isLeadReview: boolean;
    status: string;
    overallRating: string | null;
    nextStep: string | null;
    summary: string | null;
    submittedAtISO: string | null;
  }>;
  interviewReviews: Array<{
    id: string;
    reviewerName: string;
    round: number;
    status: string;
    recommendation: string | null;
    overallRating: string | null;
    submittedAtISO: string | null;
  }>;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    round: number | null;
    interviewer: { id: string; name: string };
  }>;
  documents: Array<{
    id: string;
    kind: string;
    originalName: string | null;
    uploadedAtISO: string;
  }>;
  latestDecision: {
    action: string;
    decidedAtISO: string;
    decidedBy: string;
    rationale: string | null;
    conditionCount: number;
  } | null;
  decisionHistory: Array<{
    id: string;
    action: string;
    decidedAtISO: string;
    decidedBy: string;
    superseded: boolean;
  }>;
  timeline: Array<{
    id: string;
    kind: string;
    actorName: string | null;
    createdAtISO: string;
  }>;
};

export async function loadApplicationRecord(
  id: string
): Promise<ApplicationRecord | null> {
  const app = await prisma.instructorApplication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      preferredFirstName: true,
      lastName: true,
      legalName: true,
      applicationTrack: true,
      instructorSubtype: true,
      source: true,
      isReapplication: true,
      previousApplicationId: true,
      schoolName: true,
      subjectsOfInterest: true,
      city: true,
      stateProvince: true,
      createdAt: true,
      updatedAt: true,
      chairQueuedAt: true,
      materialsReadyAt: true,
      interviewScheduledAt: true,
      interviewRound: true,
      reviewerAssignedAt: true,
      infoRequest: true,
      applicantResponse: true,
      rejectionReason: true,
      archivedAt: true,
      courseOutline: true,
      firstClassPlan: true,
      motivation: true,
      workshopOutline: true,
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapterId: true,
          chapter: { select: { name: true } },
        },
      },
      reviewer: { select: { id: true, name: true, email: true } },
      applicationReviews: {
        orderBy: [{ isLeadReview: "desc" }, { updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          isLeadReview: true,
          status: true,
          overallRating: true,
          nextStep: true,
          summary: true,
          submittedAt: true,
          reviewer: { select: { name: true, email: true } },
        },
      },
      interviewReviews: {
        orderBy: [{ round: "desc" }, { updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          round: true,
          status: true,
          recommendation: true,
          overallRating: true,
          submittedAt: true,
          reviewer: { select: { name: true, email: true } },
        },
      },
      interviewerAssignments: {
        where: { removedAt: null },
        select: {
          id: true,
          role: true,
          round: true,
          interviewer: { select: { id: true, name: true, email: true } },
        },
      },
      documents: {
        where: { supersededAt: null },
        orderBy: { uploadedAt: "desc" },
        take: 10,
        select: { id: true, kind: true, originalName: true, uploadedAt: true },
      },
      chairDecisions: {
        orderBy: { decidedAt: "desc" },
        take: 5,
        select: {
          id: true,
          action: true,
          rationale: true,
          conditions: true,
          decidedAt: true,
          supersededAt: true,
          chair: { select: { name: true, email: true } },
        },
      },
      timeline: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          kind: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!app) return null;

  // Readiness counts SUBMITTED reviews only — drafts are not a decision input.
  const submittedInterviewReviews = app.interviewReviews.filter(
    (r) => r.status === "SUBMITTED"
  );
  const submittedApplicationReviews = app.applicationReviews.filter(
    (r) => r.status === "SUBMITTED"
  );
  const readiness = computeReadinessSignals({
    interviewReviews: submittedInterviewReviews,
    applicationReviews: submittedApplicationReviews,
    materialsReadyAt: app.materialsReadyAt,
    infoRequest: app.infoRequest,
  });

  const activeDecision = app.chairDecisions.find((d) => !d.supersededAt) ?? null;
  const workshopOutline = app.workshopOutline as { title?: string } | null;

  return {
    id: app.id,
    status: app.status,
    displayName: formatApplicantDisplayName({
      preferredFirstName: app.preferredFirstName,
      lastName: app.lastName,
      legalName: app.legalName,
      applicant: { name: app.applicant.name, email: app.applicant.email },
    }),
    applicant: {
      id: app.applicant.id,
      name: app.applicant.name,
      email: app.applicant.email,
      primaryRole: app.applicant.primaryRole,
      chapterId: app.applicant.chapterId,
      chapterName: app.applicant.chapter?.name ?? null,
    },
    interviewRound: app.interviewRound,
    applicationTrack: app.applicationTrack,
    instructorSubtype: app.instructorSubtype,
    source: app.source,
    isReapplication: app.isReapplication,
    previousApplicationId: app.previousApplicationId,
    schoolName: app.schoolName,
    subjectsOfInterest: app.subjectsOfInterest,
    city: app.city,
    stateProvince: app.stateProvince,
    createdAtISO: app.createdAt.toISOString(),
    updatedAtISO: app.updatedAt.toISOString(),
    chairQueuedAtISO: app.chairQueuedAt?.toISOString() ?? null,
    materialsReadyAtISO: app.materialsReadyAt?.toISOString() ?? null,
    interviewScheduledAtISO: app.interviewScheduledAt?.toISOString() ?? null,
    infoRequest: app.infoRequest,
    applicantResponse: app.applicantResponse,
    rejectionReason: app.rejectionReason,
    archived: Boolean(app.archivedAt),
    readiness,
    materials: {
      courseOutline: Boolean(app.courseOutline?.trim()),
      firstClassPlan: Boolean(app.firstClassPlan?.trim()),
      workshopOutline: Boolean(app.workshopOutline),
      motivation: Boolean(app.motivation?.trim()),
    },
    workshopOutlineTitle: workshopOutline?.title ?? null,
    reviewer: app.reviewer
      ? { id: app.reviewer.id, name: app.reviewer.name || app.reviewer.email }
      : null,
    reviewerAssignedAtISO: app.reviewerAssignedAt?.toISOString() ?? null,
    applicationReviews: app.applicationReviews.map((r) => ({
      id: r.id,
      reviewerName: r.reviewer.name || r.reviewer.email,
      isLeadReview: r.isLeadReview,
      status: r.status,
      overallRating: r.overallRating,
      nextStep: r.nextStep,
      summary: r.summary,
      submittedAtISO: r.submittedAt?.toISOString() ?? null,
    })),
    interviewReviews: app.interviewReviews.map((r) => ({
      id: r.id,
      reviewerName: r.reviewer.name || r.reviewer.email,
      round: r.round,
      status: r.status,
      recommendation: r.recommendation,
      overallRating: r.overallRating,
      submittedAtISO: r.submittedAt?.toISOString() ?? null,
    })),
    interviewerAssignments: app.interviewerAssignments.map((a) => ({
      id: a.id,
      role: a.role,
      round: a.round,
      interviewer: {
        id: a.interviewer.id,
        name: a.interviewer.name || a.interviewer.email,
      },
    })),
    documents: app.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      originalName: d.originalName,
      uploadedAtISO: d.uploadedAt.toISOString(),
    })),
    latestDecision: activeDecision
      ? {
          action: activeDecision.action,
          decidedAtISO: activeDecision.decidedAt.toISOString(),
          decidedBy: activeDecision.chair.name || activeDecision.chair.email,
          rationale: activeDecision.rationale,
          conditionCount: Array.isArray(activeDecision.conditions)
            ? activeDecision.conditions.length
            : 0,
        }
      : null,
    decisionHistory: app.chairDecisions.map((d) => ({
      id: d.id,
      action: d.action,
      decidedAtISO: d.decidedAt.toISOString(),
      decidedBy: d.chair.name || d.chair.email,
      superseded: Boolean(d.supersededAt),
    })),
    timeline: app.timeline.map((event) => ({
      id: event.id,
      kind: event.kind,
      actorName: event.actor ? event.actor.name || event.actor.email : null,
      createdAtISO: event.createdAt.toISOString(),
    })),
  };
}
