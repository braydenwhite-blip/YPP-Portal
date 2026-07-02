import "server-only";

import type { ReviewCycleState, ReviewCycleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireLeadership, requireSessionUser } from "@/lib/authorization";
import { formatDueDate } from "@/lib/leadership-action-center/dates";

import {
  isCycleManager,
  revieweeReleasedSummary,
  type RevieweeReleasedSummary,
} from "./cycle-access";
import {
  buildCycleSteps,
  deriveCycleDisplayState,
  deriveCycleNextStep,
  CYCLE_DISPLAY_META,
  CYCLE_TYPE_META,
  type CycleDisplayState,
  type CycleFlowFacts,
  type CycleStep,
} from "./cycle-flow";
import { loadDevelopmentFactsForReview } from "./load";
import {
  deriveDevelopmentSignals,
  type DevelopmentPersonFacts,
  type DevelopmentSignal,
} from "./signals";

/**
 * Leadership Development — review cycle loaders.
 *
 * Read-side of the review flow. Confidentiality mirrors cycle-access.ts:
 * managers get everything; the reviewee-facing loader (`loadMyReviewInput`)
 * only ever returns their own self-input, their own feedback requests, and the
 * released summary projection — feedback bodies, contributor identities,
 * concerns, and coaching notes are structurally absent from its return type.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function displayName(user: { name: string | null; email: string }): string {
  return user.name || user.email;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

async function getViewerWithLeadership() {
  const sessionUser = await requireSessionUser();
  const leadership = await requireLeadership().catch(() => null);
  return { id: sessionUser.id, isLeadership: leadership != null };
}

function toFlowFacts(cycle: {
  state: ReviewCycleState;
  dueDate: Date | null;
  selfInputSubmittedAt: Date | null;
  synthesisSubmittedAt: Date | null;
  followUpDueAt: Date | null;
  releasedToRevieweeAt: Date | null;
  completedAt: Date | null;
  feedback: Array<{ submittedAt: Date | null }>;
}): CycleFlowFacts {
  return {
    state: cycle.state,
    dueDate: cycle.dueDate,
    selfInputSubmittedAt: cycle.selfInputSubmittedAt,
    synthesisSubmittedAt: cycle.synthesisSubmittedAt,
    followUpDueAt: cycle.followUpDueAt,
    releasedToRevieweeAt: cycle.releasedToRevieweeAt,
    completedAt: cycle.completedAt,
    feedbackRequested: cycle.feedback.length,
    feedbackSubmitted: cycle.feedback.filter((f) => f.submittedAt).length,
  };
}

// ── Workspace list ───────────────────────────────────────────────────────────

export type ReviewCycleRow = {
  id: string;
  revieweeId: string;
  revieweeName: string;
  contextLabel: string | null;
  typeLabel: string;
  displayState: CycleDisplayState;
  stateLabel: string;
  stateTone: (typeof CYCLE_DISPLAY_META)[CycleDisplayState]["tone"];
  dueLabel: string | null;
  nextStepLabel: string;
  feedbackSummary: string | null;
  selfInputIn: boolean;
};

export type ReviewCycleWorkspace = {
  active: ReviewCycleRow[];
  completed: ReviewCycleRow[];
  /** Viewer may start new cycles (leadership). */
  canStart: boolean;
};

const WORKSPACE_CYCLE_SELECT = {
  id: true,
  revieweeId: true,
  reviewerId: true,
  createdById: true,
  type: true,
  roleLabel: true,
  state: true,
  dueDate: true,
  selfInputSubmittedAt: true,
  synthesisSubmittedAt: true,
  followUpDueAt: true,
  releasedToRevieweeAt: true,
  completedAt: true,
  reviewee: { select: { name: true, email: true } },
  chapter: { select: { name: true } },
  feedback: { select: { submittedAt: true } },
} as const;

function toWorkspaceRow(
  cycle: {
    id: string;
    revieweeId: string;
    type: ReviewCycleType;
    roleLabel: string | null;
    reviewee: { name: string | null; email: string };
    chapter: { name: string } | null;
  } & Parameters<typeof toFlowFacts>[0],
  now: Date
): ReviewCycleRow {
  const facts = toFlowFacts(cycle);
  const displayState = deriveCycleDisplayState(facts, now);
  const meta = CYCLE_DISPLAY_META[displayState];
  const context = [
    cycle.roleLabel ?? CYCLE_TYPE_META[cycle.type].label,
    cycle.chapter?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: cycle.id,
    revieweeId: cycle.revieweeId,
    revieweeName: displayName(cycle.reviewee),
    contextLabel: context || null,
    typeLabel: CYCLE_TYPE_META[cycle.type].label,
    displayState,
    stateLabel: meta.label,
    stateTone: meta.tone,
    dueLabel: cycle.dueDate ? formatDueDate(cycle.dueDate) : null,
    nextStepLabel: deriveCycleNextStep(facts, now).label,
    feedbackSummary:
      facts.feedbackRequested > 0
        ? `${facts.feedbackSubmitted} of ${facts.feedbackRequested} feedback in`
        : null,
    selfInputIn: Boolean(cycle.selfInputSubmittedAt),
  };
}

/** Rank for the active list: most actionable first. */
const DISPLAY_STATE_RANK: Record<CycleDisplayState, number> = {
  "follow-up-overdue": 0,
  "ready-for-synthesis": 1,
  "action-plan-needed": 2,
  "waiting-input": 3,
  "waiting-self-input": 4,
  "waiting-feedback": 5,
  draft: 6,
  "follow-up-scheduled": 7,
  completed: 8,
};

const COMPLETED_LIST_CAP = 8;

export async function loadReviewCycleWorkspace(
  now: Date = new Date()
): Promise<ReviewCycleWorkspace> {
  const viewer = await getViewerWithLeadership();

  const cycles = await prisma.reviewCycle.findMany({
    where: viewer.isLeadership
      ? {}
      : { OR: [{ reviewerId: viewer.id }, { createdById: viewer.id }] },
    select: WORKSPACE_CYCLE_SELECT,
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });
  if (!viewer.isLeadership && cycles.length === 0) {
    // Not a reviewer on anything and not leadership — nothing to show.
    return { active: [], completed: [], canStart: false };
  }

  const rows = cycles.map((cycle) => toWorkspaceRow(cycle, now));
  const active = rows
    .filter((row) => row.displayState !== "completed")
    .sort(
      (a, b) =>
        DISPLAY_STATE_RANK[a.displayState] - DISPLAY_STATE_RANK[b.displayState] ||
        a.revieweeName.localeCompare(b.revieweeName)
    );
  const completed = rows
    .filter((row) => row.displayState === "completed")
    .slice(0, COMPLETED_LIST_CAP);

  return { active, completed, canStart: viewer.isLeadership };
}

// ── Cycle detail (managers only) ─────────────────────────────────────────────

export type CycleFeedbackView = {
  id: string;
  contributorId: string;
  contributorName: string;
  submittedAt: Date | null;
  requestedDaysAgo: number;
  doingWell: string | null;
  needsSupport: string | null;
  concerns: string | null;
  examples: string | null;
  suggestedNextStep: string | null;
  topics: string[];
  flagForLeadership: boolean;
};

export type CycleLinkedAction = {
  id: string;
  title: string;
  status: string;
  dueLabel: string;
  href: string;
};

export type ReviewCycleDetail = {
  id: string;
  revieweeId: string;
  revieweeName: string;
  reviewerId: string;
  reviewerName: string;
  typeLabel: string;
  type: ReviewCycleType;
  roleLabel: string | null;
  contextLabel: string | null;
  state: ReviewCycleState;
  displayState: CycleDisplayState;
  stateLabel: string;
  stateTone: (typeof CYCLE_DISPLAY_META)[CycleDisplayState]["tone"];
  dueLabel: string | null;
  steps: CycleStep[];
  nextStepLabel: string;
  nextStepWho: string;
  // Self-input (manager view)
  selfInputSubmittedAt: Date | null;
  selfInput: Record<string, string | null>;
  // Feedback (manager view — bodies + contributor identity)
  feedback: CycleFeedbackView[];
  // Synthesis
  synthesisSubmittedAt: Date | null;
  strengths: string | null;
  growthAreas: string | null;
  concerns: string | null;
  coachingNotes: string | null;
  recommendedNextStep: string | null;
  recognitionFlag: boolean;
  leadershipFlag: boolean;
  followUpDueAt: Date | null;
  followUpDueLabel: string | null;
  followUpNote: string | null;
  releasedToRevieweeAt: Date | null;
  completedAt: Date | null;
  // Context for synthesis
  revieweeFacts: DevelopmentPersonFacts | null;
  revieweeSignals: DevelopmentSignal[];
  priorCycle: {
    completedAt: Date | null;
    strengths: string | null;
    growthAreas: string | null;
    recommendedNextStep: string | null;
  } | null;
  linkedActions: CycleLinkedAction[];
  contributorOptions: Array<{ id: string; name: string }>;
};

export async function loadReviewCycleDetail(
  cycleId: string,
  now: Date = new Date()
): Promise<ReviewCycleDetail | null> {
  const viewer = await getViewerWithLeadership();

  const cycle = await prisma.reviewCycle.findUnique({
    where: { id: cycleId },
    include: {
      reviewee: { select: { name: true, email: true } },
      reviewer: { select: { name: true, email: true } },
      chapter: { select: { name: true } },
      team: { select: { name: true } },
      classOffering: { select: { title: true } },
      feedback: {
        include: { contributor: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!cycle || !isCycleManager(viewer, cycle)) return null;

  const facts = toFlowFacts(cycle);
  const displayState = deriveCycleDisplayState(facts, now);
  const meta = CYCLE_DISPLAY_META[displayState];
  const nextStep = deriveCycleNextStep(facts, now);

  const [revieweeFacts, priorCycle, linkedActions, contributorOptions] =
    await Promise.all([
      loadDevelopmentFactsForReview(cycle.revieweeId, now),
      prisma.reviewCycle.findFirst({
        where: {
          revieweeId: cycle.revieweeId,
          state: "COMPLETED",
          id: { not: cycle.id },
        },
        orderBy: { completedAt: "desc" },
        select: {
          completedAt: true,
          strengths: true,
          growthAreas: true,
          recommendedNextStep: true,
        },
      }),
      prisma.actionItem.findMany({
        where: { sourceType: "REVIEW_CYCLE", sourceId: cycle.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          deadlineStart: true,
          deadlineEnd: true,
        },
      }),
      prisma.user.findMany({
        where: {
          archivedAt: null,
          id: { notIn: [cycle.revieweeId] },
          OR: [
            { primaryRole: { in: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR", "INSTRUCTOR", "MENTOR"] } },
            { roles: { some: { role: { in: ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT"] } } } },
          ],
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 300,
      }),
    ]);

  const context = [
    cycle.roleLabel,
    cycle.chapter?.name,
    cycle.team?.name,
    cycle.classOffering?.title,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: cycle.id,
    revieweeId: cycle.revieweeId,
    revieweeName: displayName(cycle.reviewee),
    reviewerId: cycle.reviewerId,
    reviewerName: displayName(cycle.reviewer),
    typeLabel: CYCLE_TYPE_META[cycle.type].label,
    type: cycle.type,
    roleLabel: cycle.roleLabel,
    contextLabel: context || null,
    state: cycle.state,
    displayState,
    stateLabel: meta.label,
    stateTone: meta.tone,
    dueLabel: cycle.dueDate ? formatDueDate(cycle.dueDate) : null,
    steps: buildCycleSteps(facts, now),
    nextStepLabel: nextStep.label,
    nextStepWho: nextStep.who,
    selfInputSubmittedAt: cycle.selfInputSubmittedAt,
    selfInput: {
      selfWentWell: cycle.selfWentWell,
      selfWasHard: cycle.selfWasHard,
      selfImproved: cycle.selfImproved,
      selfSupportNeeded: cycle.selfSupportNeeded,
      selfGoals: cycle.selfGoals,
      selfNextResponsibility: cycle.selfNextResponsibility,
      selfLeadershipNote: cycle.selfLeadershipNote,
    },
    feedback: cycle.feedback.map((f) => ({
      id: f.id,
      contributorId: f.contributorId,
      contributorName: displayName(f.contributor),
      submittedAt: f.submittedAt,
      requestedDaysAgo: daysBetween(f.createdAt, now),
      doingWell: f.doingWell,
      needsSupport: f.needsSupport,
      concerns: f.concerns,
      examples: f.examples,
      suggestedNextStep: f.suggestedNextStep,
      topics: f.topics,
      flagForLeadership: f.flagForLeadership,
    })),
    synthesisSubmittedAt: cycle.synthesisSubmittedAt,
    strengths: cycle.strengths,
    growthAreas: cycle.growthAreas,
    concerns: cycle.concerns,
    coachingNotes: cycle.coachingNotes,
    recommendedNextStep: cycle.recommendedNextStep,
    recognitionFlag: cycle.recognitionFlag,
    leadershipFlag: cycle.leadershipFlag,
    followUpDueAt: cycle.followUpDueAt,
    followUpDueLabel: cycle.followUpDueAt
      ? formatDueDate(cycle.followUpDueAt)
      : null,
    followUpNote: cycle.followUpNote,
    releasedToRevieweeAt: cycle.releasedToRevieweeAt,
    completedAt: cycle.completedAt,
    revieweeFacts,
    revieweeSignals: revieweeFacts ? deriveDevelopmentSignals(revieweeFacts) : [],
    priorCycle,
    linkedActions: linkedActions.map((action) => ({
      id: action.id,
      title: action.title,
      status: action.status,
      dueLabel: formatDueDate(action.deadlineEnd ?? action.deadlineStart),
      href: `/actions/${action.id}`,
    })),
    contributorOptions: contributorOptions.map((user) => ({
      id: user.id,
      name: displayName(user),
    })),
  };
}

// ── Start-review options (leadership only) ───────────────────────────────────

export type StartReviewOptions = {
  reviewees: Array<{ id: string; name: string; roleLabel: string; population: "instructor" | "officer" }>;
  reviewers: Array<{ id: string; name: string }>;
};

const OFFICER_ROLES = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as const;

export async function loadStartReviewOptions(): Promise<StartReviewOptions> {
  await requireLeadership();

  const users = await prisma.user.findMany({
    where: {
      archivedAt: null,
      OR: [
        { primaryRole: { in: [...OFFICER_ROLES, "INSTRUCTOR", "MENTOR"] } },
        { roles: { some: { role: { in: ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT"] } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      chapter: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const reviewees = users.map((user) => {
    const officer = (OFFICER_ROLES as readonly string[]).includes(user.primaryRole);
    return {
      id: user.id,
      name: displayName(user),
      roleLabel: [user.primaryRole, user.chapter?.name].filter(Boolean).join(" · "),
      population: officer ? ("officer" as const) : ("instructor" as const),
    };
  });

  const reviewers = users
    .filter(
      (user) =>
        (OFFICER_ROLES as readonly string[]).includes(user.primaryRole) ||
        user.primaryRole === "MENTOR"
    )
    .map((user) => ({ id: user.id, name: displayName(user) }));

  return { reviewees, reviewers };
}

// ── My input (reviewee + contributor view) ───────────────────────────────────

export type MySelfInputItem = {
  cycleId: string;
  typeLabel: string;
  dueLabel: string | null;
  submitted: boolean;
  /** Current answers, for editing while collection is open. */
  answers: Record<string, string | null>;
};

export type MyFeedbackRequestItem = {
  feedbackId: string;
  aboutName: string;
  reason: string | null;
  dueLabel: string | null;
  submitted: boolean;
  cycleType: ReviewCycleType;
  answers: {
    doingWell: string | null;
    needsSupport: string | null;
    concerns: string | null;
    examples: string | null;
    suggestedNextStep: string | null;
    topics: string[];
    flagForLeadership: boolean;
  };
};

export type MyReleasedSummary = RevieweeReleasedSummary & {
  cycleId: string;
  typeLabel: string;
};

export type MyReviewInput = {
  selfInputs: MySelfInputItem[];
  feedbackRequests: MyFeedbackRequestItem[];
  releasedSummaries: MyReleasedSummary[];
};

/**
 * Everything the signed-in person owes or may read in the review flow —
 * strictly scoped to them. Feedback bodies of others, contributor identities,
 * concerns, and coaching notes never appear here.
 */
export async function loadMyReviewInput(): Promise<MyReviewInput> {
  const sessionUser = await requireSessionUser();

  const [myCycles, myFeedback, released] = await Promise.all([
    prisma.reviewCycle.findMany({
      where: { revieweeId: sessionUser.id, state: "COLLECTING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        dueDate: true,
        selfInputSubmittedAt: true,
        selfWentWell: true,
        selfWasHard: true,
        selfImproved: true,
        selfSupportNeeded: true,
        selfGoals: true,
        selfNextResponsibility: true,
        selfLeadershipNote: true,
      },
    }),
    prisma.reviewCycleFeedback.findMany({
      where: {
        contributorId: sessionUser.id,
        // Only cycles actively collecting — a request created while the cycle
        // is still a draft becomes visible when the cycle opens.
        cycle: { state: "COLLECTING" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reason: true,
        dueAt: true,
        submittedAt: true,
        doingWell: true,
        needsSupport: true,
        concerns: true,
        examples: true,
        suggestedNextStep: true,
        topics: true,
        flagForLeadership: true,
        cycle: {
          select: {
            type: true,
            reviewee: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.reviewCycle.findMany({
      where: {
        revieweeId: sessionUser.id,
        releasedToRevieweeAt: { not: null },
      },
      orderBy: { releasedToRevieweeAt: "desc" },
      take: 6,
      select: {
        id: true,
        type: true,
        revieweeId: true,
        releasedToRevieweeAt: true,
        strengths: true,
        growthAreas: true,
        recommendedNextStep: true,
        followUpDueAt: true,
      },
    }),
  ]);

  return {
    selfInputs: myCycles.map((cycle) => ({
      cycleId: cycle.id,
      typeLabel: CYCLE_TYPE_META[cycle.type].label,
      dueLabel: cycle.dueDate ? formatDueDate(cycle.dueDate) : null,
      submitted: Boolean(cycle.selfInputSubmittedAt),
      answers: {
        selfWentWell: cycle.selfWentWell,
        selfWasHard: cycle.selfWasHard,
        selfImproved: cycle.selfImproved,
        selfSupportNeeded: cycle.selfSupportNeeded,
        selfGoals: cycle.selfGoals,
        selfNextResponsibility: cycle.selfNextResponsibility,
        selfLeadershipNote: cycle.selfLeadershipNote,
      },
    })),
    feedbackRequests: myFeedback.map((feedback) => ({
      feedbackId: feedback.id,
      aboutName: displayName(feedback.cycle.reviewee),
      reason: feedback.reason,
      dueLabel: feedback.dueAt ? formatDueDate(feedback.dueAt) : null,
      submitted: Boolean(feedback.submittedAt),
      cycleType: feedback.cycle.type,
      answers: {
        doingWell: feedback.doingWell,
        needsSupport: feedback.needsSupport,
        concerns: feedback.concerns,
        examples: feedback.examples,
        suggestedNextStep: feedback.suggestedNextStep,
        topics: feedback.topics,
        flagForLeadership: feedback.flagForLeadership,
      },
    })),
    releasedSummaries: released
      .map((cycle) => {
        const summary = revieweeReleasedSummary(cycle);
        return summary
          ? {
              ...summary,
              cycleId: cycle.id,
              typeLabel: CYCLE_TYPE_META[cycle.type].label,
            }
          : null;
      })
      .filter((item): item is MyReleasedSummary => item != null),
  };
}
