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
 * Returns the chair's draft for an application. Phase 8 wires this to the
 * `InstructorApplicationChairDraft` table introduced in §16. The cockpit's
 * localStorage warm cache still acts as a recovery layer if the chair is
 * mid-edit when the network drops.
 */
export async function getChairDraft(
  applicationId: string,
  chairId: string
): Promise<ChairDraftSnapshot> {
  const row = await prisma.instructorApplicationChairDraft.findUnique({
    where: { applicationId_chairId: { applicationId, chairId } },
    select: { rationale: true, comparisonNotes: true, savedAt: true },
  });
  if (!row) {
    return { rationale: "", comparisonNotes: "", savedAt: null };
  }
  return {
    rationale: row.rationale,
    comparisonNotes: row.comparisonNotes,
    savedAt: row.savedAt.toISOString(),
  };
}

/**
 * Tiny status query used by the cockpit's `NetworkRecoveryBanner`'s
 * "Check status" action. Returns `null` if the application no longer exists
 * (rare but possible during cascading deletes).
 */
export async function getApplicationStatus(
  applicationId: string
): Promise<InstructorApplicationStatus | null> {
  const row = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: { status: true },
  });
  return row?.status ?? null;
}

/**
 * Audit chain for the rescind/audit drawer (Phase 2E §13).
 *
 * Returns every chair decision plus rescind events for an application,
 * newest-first. Bridges the `InstructorApplicationChairDecision` table and
 * the `CHAIR_DECISION_RESCINDED` timeline events into a single chronological
 * stream so the drawer renders one list.
 */
export type AuditDecisionEntry = {
  id: string;
  action: ChairDecisionAction;
  decidedAt: string;
  supersededAt: string | null;
  rationale: string | null;
  comparisonNotes: string | null;
  chairName: string | null;
  chairId: string | null;
};

export type AuditRescindEntry = {
  id: string;
  rescindedAt: string;
  rescindedAction: ChairDecisionAction | null;
  reason: string | null;
  actorName: string | null;
  rescindedDecisionId: string | null;
};

export type AuditChain = {
  decisions: AuditDecisionEntry[];
  rescinds: AuditRescindEntry[];
};

export type ReviewSignalSummary = {
  id: string;
  applicationId: string;
  authorId: string;
  authorName: string | null;
  kind: "COMMENT" | "PIN_NOTE" | "HIGHLIGHT" | "CONCERN" | "CONSENSUS_NOTE";
  sentiment: "STRONG_HIRE" | "HIRE" | "MIXED" | "CONCERN" | "REJECT" | null;
  body: string;
  pinned: boolean;
  pinnedAt: string | null;
  pinnedByName: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  mentions: Array<{
    userId: string;
    userName: string | null;
    acknowledgedAt: string | null;
  }>;
};

export interface ReviewSignalThread {
  root: ReviewSignalSummary;
  replies: ReviewSignalSummary[];
}

export async function getReviewSignalsForApplication(
  applicationId: string
): Promise<ReviewSignalThread[]> {
  const signals = await prisma.reviewSignal.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      applicationId: true,
      authorId: true,
      author: { select: { id: true, name: true } },
      kind: true,
      sentiment: true,
      body: true,
      pinned: true,
      pinnedAt: true,
      pinnedBy: { select: { id: true, name: true } },
      resolvedAt: true,
      resolvedBy: { select: { id: true, name: true } },
      parentId: true,
      createdAt: true,
      updatedAt: true,
      mentions: {
        select: {
          userId: true,
          acknowledgedAt: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  function toSummary(s: (typeof signals)[number]): ReviewSignalSummary {
    return {
      id: s.id,
      applicationId: s.applicationId,
      authorId: s.authorId,
      authorName: s.author?.name ?? null,
      kind: s.kind,
      sentiment: s.sentiment,
      body: s.body,
      pinned: s.pinned,
      pinnedAt: toIso(s.pinnedAt),
      pinnedByName: s.pinnedBy?.name ?? null,
      resolvedAt: toIso(s.resolvedAt),
      resolvedByName: s.resolvedBy?.name ?? null,
      parentId: s.parentId,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      mentions: s.mentions.map((m) => ({
        userId: m.userId,
        userName: m.user?.name ?? null,
        acknowledgedAt: toIso(m.acknowledgedAt),
      })),
    };
  }

  const byParent = new Map<string, ReviewSignalSummary[]>();
  const roots: ReviewSignalSummary[] = [];
  for (const signal of signals) {
    const summary = toSummary(signal);
    if (signal.parentId) {
      const list = byParent.get(signal.parentId) ?? [];
      list.push(summary);
      byParent.set(signal.parentId, list);
    } else {
      roots.push(summary);
    }
  }
  return roots
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map((root) => ({ root, replies: byParent.get(root.id) ?? [] }));
}

export async function getDecisionAuditChain(
  applicationId: string
): Promise<AuditChain> {
  const [decisions, rescinds] = await Promise.all([
    prisma.instructorApplicationChairDecision.findMany({
      where: { applicationId },
      orderBy: { decidedAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        decidedAt: true,
        supersededAt: true,
        rationale: true,
        comparisonNotes: true,
        chair: { select: { id: true, name: true } },
      },
    }),
    prisma.instructorApplicationTimelineEvent.findMany({
      where: { applicationId, kind: "CHAIR_DECISION_RESCINDED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        payload: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  return {
    decisions: decisions.map((d) => ({
      id: d.id,
      action: d.action,
      decidedAt: d.decidedAt.toISOString(),
      supersededAt: toIso(d.supersededAt),
      rationale: d.rationale,
      comparisonNotes: d.comparisonNotes,
      chairName: d.chair?.name ?? null,
      chairId: d.chair?.id ?? null,
    })),
    rescinds: rescinds.map((r) => {
      const payload = (r.payload ?? {}) as {
        rescindedAction?: unknown;
        reason?: unknown;
        rescindedDecisionId?: unknown;
      };
      return {
        id: r.id,
        rescindedAt: r.createdAt.toISOString(),
        rescindedAction:
          typeof payload.rescindedAction === "string"
            ? (payload.rescindedAction as ChairDecisionAction)
            : null,
        reason: typeof payload.reason === "string" ? payload.reason : null,
        actorName: r.actor?.name ?? null,
        rescindedDecisionId:
          typeof payload.rescindedDecisionId === "string"
            ? payload.rescindedDecisionId
            : null,
      };
    }),
  };
}

/**
 * Last 10 NOTIFICATION_FAILED / NOTIFICATION_RESENT timeline events for a
 * given application — drives the cockpit's notification failure banner +
 * diagnostic drawer. (§11.6)
 */
export type NotificationAttempt = {
  kind: "NOTIFICATION_FAILED" | "NOTIFICATION_RESENT";
  at: string;
  emailKind: string | null;
  error: string | null;
};

export async function getNotificationAttempts(
  applicationId: string
): Promise<NotificationAttempt[]> {
  const events = await prisma.instructorApplicationTimelineEvent.findMany({
    where: {
      applicationId,
      kind: { in: ["NOTIFICATION_FAILED", "NOTIFICATION_RESENT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { kind: true, createdAt: true, payload: true },
  });
  return events.map((e) => {
    const payload = (e.payload ?? {}) as { emailKind?: unknown; error?: unknown };
    return {
      kind: e.kind as NotificationAttempt["kind"],
      at: e.createdAt.toISOString(),
      emailKind: typeof payload.emailKind === "string" ? payload.emailKind : null,
      error: typeof payload.error === "string" ? payload.error : null,
    };
  });
}

/**
 * The notification snapshot consumed by the banner — pairs
 * `lastNotificationError` with the recent attempt history.
 */
export interface NotificationSnapshot {
  lastNotificationError: string | null;
  lastNotificationErrorAt: string | null;
  attempts: NotificationAttempt[];
}

export async function getNotificationSnapshot(
  applicationId: string
): Promise<NotificationSnapshot> {
  const [app, attempts] = await Promise.all([
    prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { lastNotificationError: true, lastNotificationErrorAt: true },
    }),
    getNotificationAttempts(applicationId),
  ]);
  return {
    lastNotificationError: app?.lastNotificationError ?? null,
    lastNotificationErrorAt: toIso(app?.lastNotificationErrorAt ?? null),
    attempts,
  };
}
