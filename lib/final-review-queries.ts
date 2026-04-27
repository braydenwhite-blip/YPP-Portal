/**
 * Server queries that hydrate the Final Review Cockpit (Phase 1+).
 *
 * These wrap the existing `getChairQueue*` helpers with a serialization layer
 * that matches the cockpit component contracts (Date → ISO, derived fields,
 * queue neighbor lookup with siblings).
 */

import { prisma } from "@/lib/prisma";
import {
  getChairQueue,
  getChairQueueItem,
} from "@/lib/instructor-applicant-board-queries";
import type {
  InstructorApplicationStatus,
  InstructorInterviewRecommendation,
  ChairDecisionAction,
} from "@prisma/client";

const SIBLINGS_LIMIT = 30;

type RawChairQueueItem = NonNullable<Awaited<ReturnType<typeof getChairQueueItem>>>;

export type SerializedReviewerNote = {
  summary: string | null;
  notes: string | null;
  nextStep: string | null;
  overallRating: string | null;
  categories: Array<{ category: string; rating: string | null; notes: string | null }>;
  editedAt: string | null;
  editedByName: string | null;
};

export type SerializedInterviewReview = {
  id: string;
  reviewerId: string;
  reviewerName: string | null;
  round: number | null;
  recommendation: InstructorInterviewRecommendation | null;
  overallRating: string | null;
  summary: string | null;
  categories: Array<{ category: string; rating: string | null; notes: string | null }>;
};

export type SerializedDocument = {
  id: string;
  kind: string;
  fileUrl: string;
  originalName: string | null;
  uploadedAt: string;
};

export type SerializedInterviewerAssignment = {
  id: string;
  round: number | null;
  role: string;
  interviewerId: string;
  interviewerName: string | null;
};

export type SerializedApplicationForReview = {
  id: string;
  status: InstructorApplicationStatus;
  motivation: string | null;
  teachingExperience: string | null;
  availability: string | null;
  subjectsOfInterest: string | null;
  courseIdea: string | null;
  textbook: string | null;
  courseOutline: string | null;
  firstClassPlan: string | null;
  preferredFirstName: string | null;
  legalName: string | null;
  chairQueuedAt: string | null;
  materialsReadyAt: string | null;
  interviewRound: number | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapterId: string | null;
    chapter: { id: string; name: string } | null;
  };
  reviewerName: string | null;
  reviewerId: string | null;
  reviewerNote: SerializedReviewerNote | null;
  interviewReviews: SerializedInterviewReview[];
  interviewerAssignments: SerializedInterviewerAssignment[];
  latestDecision: {
    action: ChairDecisionAction;
    decidedAt: string;
  } | null;
  documents: SerializedDocument[];
  daysInQueue: number | null;
};

export type QueueSibling = {
  id: string;
  displayName: string;
  chapterName: string | null;
  daysInQueue: number | null;
  recommendation: InstructorInterviewRecommendation | null;
};

export type QueueNeighbors = {
  position: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  siblings: QueueSibling[];
};

export type ChairDraftSnapshot = {
  rationale: string;
  comparisonNotes: string;
  savedAt: string | null;
};

function deriveDisplayName(app: {
  preferredFirstName: string | null;
  legalName: string | null;
  applicant: { name: string | null };
}): string {
  return (
    app.preferredFirstName?.trim() ||
    app.legalName?.trim() ||
    app.applicant.name?.trim() ||
    "Applicant"
  );
}

function daysSince(date: Date | string | null): number | null {
  if (!date) return null;
  const ts = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

function toIso(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return typeof date === "string" ? date : date.toISOString();
}

function serializeApplication(
  app: RawChairQueueItem
): SerializedApplicationForReview {
  const reviewerNote = app.applicationReviews[0] ?? null;
  return {
    id: app.id,
    status: app.status,
    motivation: app.motivation,
    teachingExperience: app.teachingExperience,
    availability: app.availability,
    subjectsOfInterest: app.subjectsOfInterest,
    courseIdea: app.courseIdea,
    textbook: app.textbook,
    courseOutline: app.courseOutline,
    firstClassPlan: app.firstClassPlan,
    preferredFirstName: app.preferredFirstName,
    legalName: app.legalName,
    chairQueuedAt: toIso(app.chairQueuedAt),
    materialsReadyAt: toIso(app.materialsReadyAt),
    interviewRound: app.interviewRound,
    applicant: {
      id: app.applicant.id,
      name: app.applicant.name,
      email: app.applicant.email,
      chapterId: app.applicant.chapterId,
      chapter: app.applicant.chapter
        ? { id: app.applicant.chapter.id, name: app.applicant.chapter.name }
        : null,
    },
    reviewerName: app.reviewer?.name ?? null,
    reviewerId: app.reviewer?.id ?? null,
    reviewerNote: reviewerNote
      ? {
          summary: reviewerNote.summary,
          notes: reviewerNote.notes,
          nextStep: reviewerNote.nextStep,
          overallRating: reviewerNote.overallRating,
          categories: reviewerNote.categories.map((c) => ({
            category: c.category,
            rating: c.rating,
            notes: c.notes,
          })),
          editedAt: toIso(reviewerNote.editedAt),
          editedByName: reviewerNote.editedBy?.name ?? null,
        }
      : null,
    interviewReviews: app.interviewReviews.map((review) => ({
      id: review.id,
      reviewerId: review.reviewerId,
      reviewerName: review.reviewer?.name ?? null,
      round: review.round,
      recommendation: review.recommendation,
      overallRating: review.overallRating,
      summary: review.summary,
      categories: review.categories.map((c) => ({
        category: c.category,
        rating: c.rating,
        notes: c.notes,
      })),
    })),
    interviewerAssignments: app.interviewerAssignments.map((a) => ({
      id: a.id,
      round: a.round,
      role: String(a.role),
      interviewerId: a.interviewer.id,
      interviewerName: a.interviewer.name,
    })),
    latestDecision: app.chairDecision
      ? (() => {
          const decision = app.chairDecision as {
            action: ChairDecisionAction;
            decidedAt: Date | string;
          };
          return {
            action: decision.action,
            decidedAt: toIso(decision.decidedAt) ?? "",
          };
        })()
      : null,
    documents: app.documents.map((d) => ({
      id: d.id,
      kind: String(d.kind),
      fileUrl: d.fileUrl,
      originalName: d.originalName,
      uploadedAt: toIso(d.uploadedAt) ?? "",
    })),
    daysInQueue: daysSince(app.chairQueuedAt),
  };
}

export async function getApplicationForFinalReview(
  applicationId: string
): Promise<SerializedApplicationForReview | null> {
  const item = await getChairQueueItem({ scope: "admin", applicationId });
  if (!item) {
    // Outside CHAIR_REVIEW: still show audit-mode by loading directly.
    const decided = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        motivation: true,
        teachingExperience: true,
        availability: true,
        subjectsOfInterest: true,
        courseIdea: true,
        textbook: true,
        courseOutline: true,
        firstClassPlan: true,
        preferredFirstName: true,
        legalName: true,
        chairQueuedAt: true,
        materialsReadyAt: true,
        interviewRound: true,
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            chapterId: true,
            chapter: { select: { id: true, name: true } },
          },
        },
        reviewer: { select: { id: true, name: true } },
        applicationReviews: {
          where: { isLeadReview: true, status: "SUBMITTED" },
          select: {
            summary: true,
            notes: true,
            nextStep: true,
            overallRating: true,
            categories: { select: { category: true, rating: true, notes: true } },
            editedAt: true,
            editedBy: { select: { name: true } },
          },
          take: 1,
        },
        interviewReviews: {
          where: { status: "SUBMITTED" },
          select: {
            id: true,
            reviewerId: true,
            round: true,
            recommendation: true,
            overallRating: true,
            summary: true,
            reviewer: { select: { id: true, name: true } },
            categories: { select: { category: true, rating: true, notes: true } },
          },
        },
        interviewerAssignments: {
          where: { removedAt: null },
          select: {
            id: true,
            round: true,
            role: true,
            interviewer: { select: { id: true, name: true } },
          },
        },
        chairDecisions: {
          where: { supersededAt: null },
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { action: true, decidedAt: true },
        },
        documents: {
          where: { supersededAt: null },
          select: {
            id: true,
            kind: true,
            fileUrl: true,
            originalName: true,
            uploadedAt: true,
          },
        },
      },
    });
    if (!decided) return null;
    const normalized = {
      ...decided,
      interviewReviews: decided.interviewReviews,
      interviewerAssignments: decided.interviewerAssignments,
      chairDecision: decided.chairDecisions[0] ?? null,
    };
    return serializeApplication(normalized as unknown as RawChairQueueItem);
  }
  return serializeApplication(item);
}

export async function getChairQueueNeighbors(
  applicationId: string
): Promise<QueueNeighbors> {
  const queue = await getChairQueue({ scope: "admin" });
  const idx = queue.findIndex((q) => q.id === applicationId);
  const prev = idx > 0 ? queue[idx - 1] : null;
  const next = idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : null;

  const recommendationFor = (q: typeof queue[number]): InstructorInterviewRecommendation | null => {
    const recs = q.interviewReviews
      .map((r) => r.recommendation)
      .filter((r): r is InstructorInterviewRecommendation => Boolean(r));
    if (recs.length === 0) return null;
    if (recs.every((r) => r === "ACCEPT" || r === "ACCEPT_WITH_SUPPORT")) return "ACCEPT";
    if (recs.every((r) => r === "REJECT")) return "REJECT";
    if (recs.includes("HOLD")) return "HOLD";
    return recs[0] ?? null;
  };

  const siblings: QueueSibling[] = queue.slice(0, SIBLINGS_LIMIT).map((q) => ({
    id: q.id,
    displayName: deriveDisplayName(q),
    chapterName: q.applicant.chapter?.name ?? null,
    daysInQueue: daysSince(q.chairQueuedAt),
    recommendation: recommendationFor(q),
  }));

  return {
    position: idx >= 0 ? idx + 1 : 0,
    total: queue.length,
    prevId: prev?.id ?? null,
    nextId: next?.id ?? null,
    siblings,
  };
}

/**
 * Returns the chair's draft for an application. Phase 1 ships without the
 * `InstructorApplicationChairDraft` table; the cockpit's `DraftRationaleField`
 * uses the localStorage warm cache as the source of truth until the table
 * ships in a follow-up migration.
 */
export async function getChairDraft(
  _applicationId: string,
  _chairId: string
): Promise<ChairDraftSnapshot> {
  return { rationale: "", comparisonNotes: "", savedAt: null };
}
