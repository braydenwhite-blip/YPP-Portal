/**
 * Server-side queries for the Instructor Applicant Workflow V1 board surfaces:
 * pipeline kanban, chair queue, archive, and load/candidate helpers.
 *
 * All functions are pure DB reads — no session check here.
 * Callers (server components / actions) must assert permissions before calling.
 */

import { prisma } from "@/lib/prisma";
import { InstructorApplicationStatus } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PipelineScope = "admin" | "chapter";

export type PipelineFilters = {
  reviewerId?: string;
  interviewerId?: string;
  materialsMissing?: boolean;
  overdueOnly?: boolean;
  myCasesActorId?: string;
};

export type DerivedColumn =
  | "new"
  | "needs_review"
  | "interview_prep"
  | "ready_for_interview"
  | "post_interview"
  | "chair_review"
  | "decided"
  | "archive";

// Minimal application select for the board. Extend as UI needs grow.
const PIPELINE_SELECT = {
  id: true,
  status: true,
  subjectsOfInterest: true,
  materialsReadyAt: true,
  archivedAt: true,
  reviewerAssignedAt: true,
  reviewerAssignedById: true,
  chairQueuedAt: true,
  createdAt: true,
  updatedAt: true,
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
      role: true,
      assignedAt: true,
      interviewer: { select: { id: true, name: true, email: true } },
    },
  },
  chairDecision: {
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
  materialsReadyAt: Date | null;
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
      return app.materialsReadyAt ? "ready_for_interview" : "interview_prep";
    case "INTERVIEW_COMPLETED":
      return "post_interview";
    case "CHAIR_REVIEW":
      return "chair_review";
    case "APPROVED":
    case "REJECTED":
    case "ON_HOLD":
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

// ─── Pipeline query ───────────────────────────────────────────────────────────

export type PipelineApplication = Awaited<
  ReturnType<typeof getApplicantPipeline>
>["columns"][DerivedColumn][number];

export async function getApplicantPipeline({
  scope,
  chapterId,
  filters = {},
  take,
}: {
  scope: PipelineScope;
  chapterId?: string;
  filters?: PipelineFilters;
  take?: number;
}): Promise<{ columns: Record<DerivedColumn, typeof applications[number][]> }> {
  const where: Record<string, unknown> = {
    // Exclude already-archived items from the main pipeline
    archivedAt: null,
    status: { not: "WITHDRAWN" as InstructorApplicationStatus },
  };

  if (scope === "chapter" && chapterId) {
    where.applicant = { chapterId };
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
    where.status = {
      in: ["INTERVIEW_SCHEDULED", "PRE_APPROVED"] as InstructorApplicationStatus[],
    };
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
    decided: [],
    archive: [],
  };

  for (const app of applications) {
    const col = getDerivedColumn(app);
    const enriched = { ...app, overdue: isOverdue(app), stuck: isStuck(app) };

    if (filters.overdueOnly && !enriched.overdue) continue;
    columns[col].push(enriched as unknown as typeof applications[number]);
  }

  return { columns: columns as unknown as Record<DerivedColumn, typeof applications[number][]> };
}

// ─── Chair queue ──────────────────────────────────────────────────────────────

export async function getChairQueue({
  scope,
  chapterId,
}: {
  scope: PipelineScope;
  chapterId?: string;
}) {
  const where: Record<string, unknown> = {
    status: "CHAIR_REVIEW" as InstructorApplicationStatus,
  };

  if (scope === "chapter" && chapterId) {
    where.applicant = { chapterId };
  }

  return prisma.instructorApplication.findMany({
    where,
    select: {
      id: true,
      status: true,
      subjectsOfInterest: true,
      preferredFirstName: true,
      legalName: true,
      chairQueuedAt: true,
      materialsReadyAt: true,
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
        select: { summary: true, notes: true, nextStep: true, overallRating: true },
        take: 1,
      },
      // Per-interviewer recommendation
      interviewReviews: {
        where: { status: "SUBMITTED" },
        select: {
          id: true,
          reviewerId: true,
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
          role: true,
          interviewer: { select: { id: true, name: true } },
        },
      },
      chairDecision: {
        select: { action: true, decidedAt: true },
      },
      documents: {
        where: { supersededAt: null },
        select: { id: true, kind: true, fileUrl: true, originalName: true, uploadedAt: true },
      },
    },
    orderBy: { chairQueuedAt: "asc" },
  });
}

// ─── Archive query ────────────────────────────────────────────────────────────

export async function getArchivedApplications({
  scope,
  chapterId,
  since,
  skip = 0,
  take = 50,
}: {
  scope: PipelineScope;
  chapterId?: string;
  since?: Date;
  skip?: number;
  take?: number;
}) {
  const where: Record<string, unknown> = {
    OR: [
      { archivedAt: { not: null } },
      { status: "WITHDRAWN" as InstructorApplicationStatus },
    ],
  };

  if (scope === "chapter" && chapterId) {
    where.applicant = { chapterId };
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
        applicant: {
          select: { id: true, name: true, chapterId: true, chapter: { select: { name: true } } },
        },
        reviewer: { select: { id: true, name: true } },
        chairDecision: { select: { action: true, decidedAt: true } },
      },
      orderBy: { archivedAt: "desc" },
      skip,
      take,
    }),
    prisma.instructorApplication.count({ where }),
  ]);

  return { items, total, skip, take };
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
      applicant: { select: { chapterId: true } },
      interviewerAssignments: {
        where: { removedAt: null },
        select: { interviewerId: true, role: true },
      },
    },
  });

  if (!application) throw new Error("Application not found");

  const chapterId = application.applicant.chapterId;

  // LEAD must be assigned before SECOND; keep render-time candidate loading non-throwing.
  if (role === "SECOND") {
    const hasLead = application.interviewerAssignments.some((a) => a.role === "LEAD");
    if (!hasLead) return [];
  }

  // Already assigned interviewers (active) — exclude from candidates
  const alreadyAssignedIds = application.interviewerAssignments.map((a) => a.interviewerId);

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
        { roles: { some: { role: "HIRING_CHAIR" } } },
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
