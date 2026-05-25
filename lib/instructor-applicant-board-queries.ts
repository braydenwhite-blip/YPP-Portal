/**
 * Server-side queries for the Instructor Applicant Workflow V1 board surfaces:
 * pipeline kanban, chair queue, archive, and load/candidate helpers.
 *
 * All functions are pure DB reads — no session check here.
 * Callers (server components / actions) must assert permissions before calling.
 */

import { prisma } from "@/lib/prisma";
import {
  InstructorApplicationStatus,
  ApplicationTrack,
  ApplicationSource,
} from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PipelineScope = "admin" | "chapter";

export type PipelineFilters = {
  reviewerId?: string;
  interviewerId?: string;
  materialsMissing?: boolean;
  overdueOnly?: boolean;
  myCasesActorId?: string;
  /**
   * Optional filter on `applicationTrack`. Omit (or pass undefined) to show
   * applicants from both tracks. Used by the new admin board filter chip.
   */
  applicationTrack?: ApplicationTrack;
  /**
   * Optional filter on `source` — PORTAL, GOOGLE_FORMS, CSV_IMPORT, or
   * MANUAL_ADMIN_ENTRY. Lets admins focus on portal-native vs externally-
   * intaked applicants without disturbing the unified pipeline.
   */
  source?: ApplicationSource;
};

export type DerivedColumn =
  | "new"
  | "needs_review"
  | "interview_prep"
  | "ready_for_interview"
  | "post_interview"
  | "chair_review"
  | "on_hold"
  | "waitlisted"
  | "decided"
  | "archive";

// Minimal application select for the board. Extend as UI needs grow.
const PIPELINE_SELECT = {
  id: true,
  status: true,
  subjectsOfInterest: true,
  materialsReadyAt: true,
  interviewScheduledAt: true,
  interviewRound: true,
  archivedAt: true,
  reviewerAssignedAt: true,
  reviewerAssignedById: true,
  chairQueuedAt: true,
  createdAt: true,
  updatedAt: true,
  applicationTrack: true,
  instructorSubtype: true,
  workshopOutline: true,
  isReapplication: true,
  previousApplicationId: true,
  source: true,
  offeredSlots: {
    select: { id: true, scheduledAt: true, confirmedAt: true },
  },
  applicant: {
    select: {
      id: true,
      name: true,
      email: true,
      chapterId: true,
      chapter: { select: { id: true, name: true } },
    },
  },
  reviewer: {
    select: { id: true, name: true, email: true, chapterId: true },
  },
  interviewerAssignments: {
    where: { removedAt: null },
    select: {
      id: true,
      interviewerId: true,
      round: true,
      role: true,
      assignedAt: true,
      interviewer: { select: { id: true, name: true, email: true } },
    },
  },
  chairDecisions: {
    where: { supersededAt: null },
    orderBy: { decidedAt: "desc" },
    take: 1,
    select: { action: true, decidedAt: true, rationale: true },
  },
  applicationReviews: {
    where: { isLeadReview: true, status: "SUBMITTED" },
    select: { summary: true, nextStep: true, overallRating: true },
    take: 1,
  },
} as const;

// ─── Derived column classifier ────────────────────────────────────────────────

const TERMINAL_STATUSES: InstructorApplicationStatus[] = [
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

function getDerivedColumn(app: {
  status: InstructorApplicationStatus;
  interviewScheduledAt: Date | null;
  archivedAt: Date | null;
}): DerivedColumn {
  if (app.archivedAt || app.status === "WITHDRAWN") return "archive";

  switch (app.status) {
    case "SUBMITTED":
      return "new";
    case "UNDER_REVIEW":
    case "INFO_REQUESTED":
      return "needs_review";
    case "PRE_APPROVED":
      return "interview_prep";
    case "INTERVIEW_SCHEDULED":
      return app.interviewScheduledAt ? "ready_for_interview" : "interview_prep";
    case "INTERVIEW_COMPLETED":
      return "post_interview";
    case "CHAIR_REVIEW":
      return "chair_review";
    case "ON_HOLD":
      return "on_hold";
    case "WAITLISTED":
      return "waitlisted";
    case "APPROVED":
    case "REJECTED":
      return "decided";
    default:
      return "decided";
  }
}

const OVERDUE_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const STUCK_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isOverdue(app: {
  status: InstructorApplicationStatus;
  reviewerAssignedAt: Date | null;
}): boolean {
  if (app.status !== "UNDER_REVIEW") return false;
  if (!app.reviewerAssignedAt) return false;
  return Date.now() - app.reviewerAssignedAt.getTime() > OVERDUE_THRESHOLD_MS;
}

/**
 * Risk 3: INTERVIEW_COMPLETED sitting >7 days — likely a second interviewer
 * who has not submitted. Surfaces a "Stuck" chip and enables forceSendToChair.
 */
function isStuck(app: {
  status: InstructorApplicationStatus;
  updatedAt: Date;
}): boolean {
  if (app.status !== "INTERVIEW_COMPLETED") return false;
  return Date.now() - app.updatedAt.getTime() > STUCK_THRESHOLD_MS;
}

/** 5-day threshold for "lead interviewer hasn't offered times yet". */
const NO_SLOTS_OFFERED_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Stuck-scheduling detector: applicant has been moved to INTERVIEW_SCHEDULED
 * but no slots have been offered (and none confirmed) within the threshold.
 * Distinct from `isStuck` (which fires post-interview).
 */
function isAwaitingSlots(app: {
  status: InstructorApplicationStatus;
  interviewScheduledAt: Date | null;
  updatedAt: Date;
  offeredSlots: Array<{ scheduledAt: Date; confirmedAt: Date | null }>;
}): boolean {
  if (app.status !== "INTERVIEW_SCHEDULED") return false;
  if (app.interviewScheduledAt) return false; // applicant already confirmed
  if (app.offeredSlots.length > 0) return false; // slots offered, ball in applicant's court
  return Date.now() - app.updatedAt.getTime() > NO_SLOTS_OFFERED_THRESHOLD_MS;
}

// ─── Pipeline query ───────────────────────────────────────────────────────────

export type PipelineApplication = Awaited<
  ReturnType<typeof getApplicantPipeline>
>["columns"][DerivedColumn][number];

export async function getApplicantPipeline({
  scope,
  chapterId,
  filters = {},
  take,
  includeOrphans = true,
}: {
  scope: PipelineScope;
  chapterId?: string;
  filters?: PipelineFilters;
  take?: number;
  /**
   * When scope === "chapter", also surface orphan applicants (applicantChapterId === null).
   * These are owned by the global admin queue but every CP can view/triage them.
   */
  includeOrphans?: boolean;
}): Promise<{ columns: Record<DerivedColumn, typeof applications[number][]> }> {
  // Defense in depth: chapter scope without a chapter id must not leak across chapters.
  if (scope === "chapter" && !chapterId) {
    const empty: Record<DerivedColumn, never[]> = {
      new: [],
      needs_review: [],
      interview_prep: [],
      ready_for_interview: [],
      post_interview: [],
      chair_review: [],
      decided: [],
      on_hold: [],
      waitlisted: [],
      archive: [],
    };
    return { columns: empty as unknown as Record<DerivedColumn, typeof applications[number][]> };
  }

  const where: Record<string, unknown> = {
    // Exclude already-archived items from the main pipeline
    archivedAt: null,
    status: { not: "WITHDRAWN" as InstructorApplicationStatus },
  };

  if (scope === "chapter" && chapterId) {
    where.applicant = includeOrphans
      ? { OR: [{ chapterId }, { chapterId: null }] }
      : { chapterId };
  }

  if (filters.reviewerId) {
    where.reviewerId = filters.reviewerId;
  }

  if (filters.interviewerId) {
    where.interviewerAssignments = {
      some: { interviewerId: filters.interviewerId, removedAt: null },
    };
  }

  if (filters.materialsMissing) {
    where.materialsReadyAt = null;
    where.AND = [
      ...((where.AND as unknown[]) ?? []),
      {
        status: {
          in: ["INTERVIEW_SCHEDULED", "PRE_APPROVED"] as InstructorApplicationStatus[],
        },
      },
    ];
  }

  if (filters.applicationTrack) {
    where.applicationTrack = filters.applicationTrack;
  }

  if (filters.source) {
    where.source = filters.source;
  }

  if (filters.myCasesActorId) {
    where.OR = [
      { reviewerId: filters.myCasesActorId },
      {
        interviewerAssignments: {
          some: { interviewerId: filters.myCasesActorId, removedAt: null },
        },
      },
    ];
  }

  const applications = await prisma.instructorApplication.findMany({
    where,
    select: PIPELINE_SELECT,
    orderBy: { createdAt: "desc" },
    take,
  });

  const columns: Record<DerivedColumn, typeof applications> = {
    new: [],
    needs_review: [],
    interview_prep: [],
    ready_for_interview: [],
    post_interview: [],
    chair_review: [],
    on_hold: [],
    waitlisted: [],
    decided: [],
    archive: [],
  };

  for (const app of applications) {
    const col = getDerivedColumn(app);
    const enriched = {
      ...app,
      interviewerAssignments: app.interviewerAssignments.filter(
        (assignment) => assignment.round === app.interviewRound
      ),
      chairDecision: app.chairDecisions[0] ?? null,
      overdue: isOverdue(app),
      stuck: isStuck(app),
      awaitingSlots: isAwaitingSlots(app),
    };

    if (filters.overdueOnly && !enriched.overdue) continue;
    columns[col].push(enriched as unknown as typeof applications[number]);
  }

  return { columns: columns as unknown as Record<DerivedColumn, typeof applications[number][]> };
}

// ─── Chair queue ──────────────────────────────────────────────────────────────

const CHAIR_QUEUE_SELECT = {
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
  applicationTrack: true,
  instructorSubtype: true,
  workshopOutline: true,
  promotionEligibility: true,
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
  // Lead reviewer note preview
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
  // Per-interviewer recommendation
  interviewReviews: {
    where: { status: "SUBMITTED" },
    select: {
      id: true,
      reviewerId: true,
      round: true,
      recommendation: true,
      overallRating: true,
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
    select: { id: true, kind: true, fileUrl: true, originalName: true, uploadedAt: true },
  },
} as const;

function buildChairQueueWhere({
  scope,
  chapterId,
  applicationId,
  includeOrphans = true,
}: {
  scope: PipelineScope;
  chapterId?: string;
  applicationId?: string;
  includeOrphans?: boolean;
}) {
  const where: Record<string, unknown> = {
    status: "CHAIR_REVIEW" as InstructorApplicationStatus,
  };

  if (applicationId) {
    where.id = applicationId;
  }

  if (scope === "chapter" && chapterId) {
    where.applicant = includeOrphans
      ? { OR: [{ chapterId }, { chapterId: null }] }
      : { chapterId };
  }

  return where;
}

function normalizeChairQueueApplication<
  TApplication extends {
    interviewRound: number | null;
    interviewReviews: Array<{ round: number | null }>;
    interviewerAssignments: Array<{ round: number | null }>;
    chairDecisions: Array<unknown>;
  },
>(app: TApplication) {
  return {
    ...app,
    interviewReviews: app.interviewReviews.filter((review) => review.round === app.interviewRound),
    interviewerAssignments: app.interviewerAssignments.filter(
      (assignment) => assignment.round === app.interviewRound
    ),
    chairDecision: app.chairDecisions[0] ?? null,
  };
}

export async function getChairQueue({
  scope,
  chapterId,
}: {
  scope: PipelineScope;
  chapterId?: string;
}) {
  if (scope === "chapter" && !chapterId) {
    return [];
  }
  const applications = await prisma.instructorApplication.findMany({
    where: buildChairQueueWhere({ scope, chapterId }),
    select: CHAIR_QUEUE_SELECT,
    orderBy: { chairQueuedAt: "asc" },
  });

  return applications.map((app) => normalizeChairQueueApplication(app));
}

export async function getChairQueueItem({
  scope,
  chapterId,
  applicationId,
}: {
  scope: PipelineScope;
  chapterId?: string;
  applicationId: string;
}) {
  const application = await prisma.instructorApplication.findFirst({
    where: buildChairQueueWhere({ scope, chapterId, applicationId }),
    select: CHAIR_QUEUE_SELECT,
  });

  if (!application) {
    return null;
  }

  return normalizeChairQueueApplication(application);
}

// ─── Archive query ────────────────────────────────────────────────────────────

export async function getArchivedApplications({
  scope,
  chapterId,
  since,
  skip = 0,
  take = 50,
  includeOrphans = true,
}: {
  scope: PipelineScope;
  chapterId?: string;
  since?: Date;
  skip?: number;
  take?: number;
  includeOrphans?: boolean;
}) {
  if (scope === "chapter" && !chapterId) {
    return { items: [], total: 0, skip, take };
  }

  const where: Record<string, unknown> = {
    OR: [
      { archivedAt: { not: null } },
      { status: "WITHDRAWN" as InstructorApplicationStatus },
    ],
  };

  if (scope === "chapter" && chapterId) {
    where.applicant = includeOrphans
      ? { OR: [{ chapterId }, { chapterId: null }] }
      : { chapterId };
  }

  if (since) {
    where.archivedAt = { gte: since };
  }

  const [items, total] = await Promise.all([
    prisma.instructorApplication.findMany({
      where,
      select: {
        id: true,
        status: true,
        archivedAt: true,
        updatedAt: true,
        subjectsOfInterest: true,
        applicationTrack: true,
        instructorSubtype: true,
        workshopOutline: true,
        applicant: {
          select: { id: true, name: true, chapterId: true, chapter: { select: { name: true } } },
        },
        reviewer: { select: { id: true, name: true } },
        chairDecisions: {
          where: { supersededAt: null },
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { action: true, decidedAt: true },
        },
      },
      orderBy: { archivedAt: "desc" },
      skip,
      take,
    }),
    prisma.instructorApplication.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      chairDecision: item.chairDecisions[0] ?? null,
    })),
    total,
    skip,
    take,
  };
}

// ─── Load helpers ─────────────────────────────────────────────────────────────

export async function getInterviewerLoad(userId: string) {
  const activeCount = await prisma.instructorApplicationInterviewer.count({
    where: {
      interviewerId: userId,
      removedAt: null,
      application: {
        status: {
          notIn: TERMINAL_STATUSES,
        },
      },
    },
  });

  const lastAssignment = await prisma.instructorApplicationInterviewer.findFirst({
    where: { interviewerId: userId },
    orderBy: { assignedAt: "desc" },
    select: { assignedAt: true },
  });

  return {
    activeCount,
    lastAssignedAt: lastAssignment?.assignedAt ?? null,
  };
}

export async function getReviewerLoad(userId: string) {
  const ACTIVE_REVIEWER_STATUSES: InstructorApplicationStatus[] = [
    "UNDER_REVIEW",
    "INFO_REQUESTED",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "CHAIR_REVIEW",
  ];

  const activeCount = await prisma.instructorApplication.count({
    where: {
      reviewerId: userId,
      status: { in: ACTIVE_REVIEWER_STATUSES },
    },
  });

  const lastAssigned = await prisma.instructorApplication.findFirst({
    where: { reviewerId: userId, reviewerAssignedAt: { not: null } },
    orderBy: { reviewerAssignedAt: "desc" },
    select: { reviewerAssignedAt: true },
  });

  return {
    activeCount,
    lastAssignedAt: lastAssigned?.reviewerAssignedAt ?? null,
  };
}

// ─── Candidate interviewers ───────────────────────────────────────────────────

export async function getCandidateInterviewers(
  applicationId: string,
  { role }: { role: "LEAD" | "SECOND" }
) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: {
      subjectsOfInterest: true,
      interviewRound: true,
      applicant: { select: { chapterId: true } },
      interviewerAssignments: {
        where: { removedAt: null },
        select: { interviewerId: true, role: true, round: true },
      },
    },
  });

  if (!application) throw new Error("Application not found");

  const chapterId = application.applicant.chapterId;

  // LEAD must be assigned before SECOND; keep render-time candidate loading non-throwing.
  if (role === "SECOND") {
    const hasLead = application.interviewerAssignments.some(
      (a) => a.role === "LEAD" && a.round === application.interviewRound
    );
    if (!hasLead) return [];
  }

  // Already assigned interviewers (active) — exclude from candidates
  const alreadyAssignedIds = application.interviewerAssignments
    .filter((assignment) => assignment.round === application.interviewRound)
    .map((a) => a.interviewerId);

  // Eligible users: ADMIN, CHAPTER_PRESIDENT, or INTERVIEWER feature key holders.
  // For INTERVIEWER feature key we approximate via a FeatureGateRule user-level check.
  // TODO: replace with a proper feature-gate batch query when the gate evaluator supports it.
  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: alreadyAssignedIds },
      OR: [
        { roles: { some: { role: "ADMIN" } } },
        { roles: { some: { role: "CHAPTER_PRESIDENT" } } },
        {
          featureGateRulesTargeted: {
            some: {
              featureKey: "INTERVIEWER",
              enabled: true,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      chapterId: true,
      roles: { select: { role: true } },
    },
    orderBy: { name: "asc" },
  });

  // Enrich with load + chapter match
  const enriched = await Promise.all(
    candidates.map(async (user) => {
      const [interviewerLoad, reviewerLoad] = await Promise.all([
        getInterviewerLoad(user.id),
        getReviewerLoad(user.id),
      ]);

      const chapterMatch = chapterId ? user.chapterId === chapterId : false;

      return {
        ...user,
        interviewerActiveLoad: interviewerLoad.activeCount,
        interviewerLastAssignedAt: interviewerLoad.lastAssignedAt,
        reviewerActiveLoad: reviewerLoad.activeCount,
        chapterMatch,
      };
    })
  );

  // Sort: chapter match first, then load ascending
  return enriched.sort((a, b) => {
    if (a.chapterMatch !== b.chapterMatch) return a.chapterMatch ? -1 : 1;
    return a.interviewerActiveLoad - b.interviewerActiveLoad;
  });
}

// ─── Candidate reviewers ──────────────────────────────────────────────────────

export async function getCandidateReviewers(applicationId: string) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: {
      reviewerId: true,
      applicant: { select: { chapterId: true } },
    },
  });

  if (!application) throw new Error("Application not found");

  const chapterId = application.applicant.chapterId;

  const candidates = await prisma.user.findMany({
    where: {
      id: application.reviewerId ? { not: application.reviewerId } : undefined,
      OR: [
        { roles: { some: { role: "ADMIN" } } },
        { roles: { some: { role: "CHAPTER_PRESIDENT" } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      chapterId: true,
      roles: { select: { role: true } },
    },
    orderBy: { name: "asc" },
  });

  const enriched = await Promise.all(
    candidates.map(async (user) => {
      const load = await getReviewerLoad(user.id);

      const chapterMatch = chapterId ? user.chapterId === chapterId : false;

      return {
        ...user,
        reviewerActiveLoad: load.activeCount,
        reviewerLastAssignedAt: load.lastAssignedAt,
        chapterMatch,
      };
    })
  );

  return enriched.sort((a, b) => {
    if (a.chapterMatch !== b.chapterMatch) return a.chapterMatch ? -1 : 1;
    return a.reviewerActiveLoad - b.reviewerActiveLoad;
  });
}
