"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireLeadership, requireSessionUser } from "@/lib/authorization";
import { createNotification } from "@/lib/notifications";

import {
  canSubmitCycleFeedback,
  canSubmitSelfInput,
  isCycleManager,
} from "./cycle-access";
import { isValidFeedbackTopic } from "./cycle-flow";

/**
 * Leadership Development — review cycle server actions.
 *
 * Every mutation in the review flow: start a cycle, open it for input, request
 * contributor feedback, submit self-input / feedback, write the synthesis,
 * turn it into actions and a follow-up, release the summary, and complete.
 *
 * Pattern per CLAUDE.md: zod-validate first, authorize with the pure
 * predicates in cycle-access.ts (leadership resolved via requireLeadership),
 * write, then revalidate the affected routes. Confidentiality is enforced
 * HERE and in cycle-load.ts — never by the UI alone.
 */

const CYCLE_MANAGER_SELECT = {
  id: true,
  revieweeId: true,
  reviewerId: true,
  createdById: true,
  state: true,
  type: true,
  releasedToRevieweeAt: true,
  synthesisSubmittedAt: true,
  reviewee: { select: { name: true, email: true } },
} as const;

async function getViewerWithLeadership() {
  const sessionUser = await requireSessionUser();
  const leadership = await requireLeadership().catch(() => null);
  return { id: sessionUser.id, isLeadership: leadership != null };
}

/** Load a cycle and require the viewer to be a manager (reviewer/creator/leadership). */
async function requireCycleManager(cycleId: string) {
  const viewer = await getViewerWithLeadership();
  const cycle = await prisma.reviewCycle.findUnique({
    where: { id: cycleId },
    select: CYCLE_MANAGER_SELECT,
  });
  // Same "not found" surface whether missing or not accessible.
  if (!cycle || !isCycleManager(viewer, cycle)) {
    throw new Error("Not found");
  }
  return { viewer, cycle };
}

function revalidateCycleSurfaces(cycleId: string, revieweeId: string) {
  revalidatePath("/mentorship");
  revalidatePath("/people/develop/reviews");
  revalidatePath(`/people/develop/reviews/${cycleId}`);
  revalidatePath(`/people/develop/${revieweeId}`);
}

// ── Start / open ─────────────────────────────────────────────────────────────

const StartCycleSchema = z.object({
  revieweeId: z.string().min(1),
  reviewerId: z.string().min(1),
  type: z.enum(["INSTRUCTOR", "OFFICER"]),
  roleLabel: z.string().trim().max(120).optional(),
  dueDate: z.coerce.date().optional(),
  chapterId: z.string().optional(),
  teamId: z.string().optional(),
  classOfferingId: z.string().optional(),
  /** Open for input immediately (default) or keep as a draft. */
  openNow: z.boolean().default(true),
});

export type StartReviewCycleInput = z.infer<typeof StartCycleSchema>;

/** Starting a review is a leadership act. */
export async function startReviewCycle(
  input: StartReviewCycleInput
): Promise<{ ok: true; cycleId: string }> {
  const data = StartCycleSchema.parse(input);
  const leader = await requireLeadership();

  const [reviewee, reviewer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.revieweeId },
      select: { id: true, name: true, archivedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: data.reviewerId },
      select: { id: true, name: true, archivedAt: true },
    }),
  ]);
  if (!reviewee || reviewee.archivedAt) throw new Error("Reviewee not found");
  if (!reviewer || reviewer.archivedAt) throw new Error("Reviewer not found");
  if (reviewee.id === reviewer.id) {
    throw new Error("The reviewer must be a different person than the reviewee");
  }

  const cycle = await prisma.reviewCycle.create({
    data: {
      revieweeId: data.revieweeId,
      reviewerId: data.reviewerId,
      createdById: leader.id,
      type: data.type,
      roleLabel: data.roleLabel || null,
      dueDate: data.dueDate ?? null,
      chapterId: data.chapterId || null,
      teamId: data.teamId || null,
      classOfferingId: data.classOfferingId || null,
      state: data.openNow ? "COLLECTING" : "DRAFT",
    },
    select: { id: true },
  });

  if (data.openNow) {
    await createNotification({
      userId: data.revieweeId,
      type: "SYSTEM",
      title: "Your review has started",
      body: "Share your self-reflection — what went well, what was hard, and where you need support.",
      link: "/mentorship?view=me",
    });
  }
  if (data.reviewerId !== leader.id) {
    await createNotification({
      userId: data.reviewerId,
      type: "SYSTEM",
      title: `You're the reviewer for ${reviewee.name}`,
      body: "Collect input, then write the synthesis and coaching plan.",
      link: `/people/develop/reviews/${cycle.id}`,
    });
  }

  revalidateCycleSurfaces(cycle.id, data.revieweeId);
  return { ok: true, cycleId: cycle.id };
}

const CycleIdSchema = z.object({ cycleId: z.string().min(1) });

export async function openCycleForInput(
  input: z.infer<typeof CycleIdSchema>
): Promise<{ ok: true }> {
  const { cycleId } = CycleIdSchema.parse(input);
  const { cycle } = await requireCycleManager(cycleId);
  if (cycle.state !== "DRAFT") throw new Error("The cycle is already open");

  await prisma.reviewCycle.update({
    where: { id: cycleId },
    data: { state: "COLLECTING" },
  });
  await createNotification({
    userId: cycle.revieweeId,
    type: "SYSTEM",
    title: "Your review has started",
    body: "Share your self-reflection — what went well, what was hard, and where you need support.",
    link: "/mentorship?view=me",
  });

  revalidateCycleSurfaces(cycleId, cycle.revieweeId);
  return { ok: true };
}

// ── Feedback requests ────────────────────────────────────────────────────────

const RequestFeedbackSchema = z.object({
  cycleId: z.string().min(1),
  contributorIds: z.array(z.string().min(1)).min(1).max(12),
  reason: z.string().trim().max(2_000).optional(),
  dueAt: z.coerce.date().optional(),
});

export async function requestCycleFeedback(
  input: z.infer<typeof RequestFeedbackSchema>
): Promise<{ ok: true; requested: number }> {
  const data = RequestFeedbackSchema.parse(input);
  const { cycle } = await requireCycleManager(data.cycleId);
  if (cycle.state !== "DRAFT" && cycle.state !== "COLLECTING") {
    throw new Error("Input collection is closed for this cycle");
  }

  const contributorIds = [...new Set(data.contributorIds)].filter(
    (id) => id !== cycle.revieweeId
  );
  if (contributorIds.length === 0) {
    throw new Error("Pick at least one contributor other than the reviewee");
  }

  const result = await prisma.reviewCycleFeedback.createMany({
    data: contributorIds.map((contributorId) => ({
      cycleId: data.cycleId,
      contributorId,
      requestedById: cycle.reviewerId,
      reason: data.reason || null,
      dueAt: data.dueAt ?? null,
    })),
    skipDuplicates: true,
  });

  const revieweeName = cycle.reviewee.name || cycle.reviewee.email;
  await Promise.all(
    contributorIds.map((contributorId) =>
      createNotification({
        userId: contributorId,
        type: "SYSTEM",
        title: `Feedback requested: ${revieweeName}`,
        body: "A short, structured form — what they do well, where they need support.",
        link: "/mentorship?view=me",
      })
    )
  );

  revalidateCycleSurfaces(data.cycleId, cycle.revieweeId);
  return { ok: true, requested: result.count };
}

// ── Reviewee self-input ──────────────────────────────────────────────────────

const SelfInputSchema = z.object({
  cycleId: z.string().min(1),
  selfWentWell: z.string().trim().max(10_000).optional(),
  selfWasHard: z.string().trim().max(10_000).optional(),
  selfImproved: z.string().trim().max(10_000).optional(),
  selfSupportNeeded: z.string().trim().max(10_000).optional(),
  selfGoals: z.string().trim().max(10_000).optional(),
  selfNextResponsibility: z.string().trim().max(10_000).optional(),
  selfLeadershipNote: z.string().trim().max(10_000).optional(),
});

export async function submitCycleSelfInput(
  input: z.infer<typeof SelfInputSchema>
): Promise<{ ok: true }> {
  const data = SelfInputSchema.parse(input);
  const sessionUser = await requireSessionUser();

  const cycle = await prisma.reviewCycle.findUnique({
    where: { id: data.cycleId },
    select: { id: true, revieweeId: true, reviewerId: true, state: true },
  });
  if (!cycle || !canSubmitSelfInput(sessionUser.id, cycle)) {
    throw new Error("Not found");
  }

  const answers = {
    selfWentWell: data.selfWentWell || null,
    selfWasHard: data.selfWasHard || null,
    selfImproved: data.selfImproved || null,
    selfSupportNeeded: data.selfSupportNeeded || null,
    selfGoals: data.selfGoals || null,
    selfNextResponsibility: data.selfNextResponsibility || null,
    selfLeadershipNote: data.selfLeadershipNote || null,
  };
  if (!Object.values(answers).some(Boolean)) {
    throw new Error("Write at least one answer before submitting");
  }

  await prisma.reviewCycle.update({
    where: { id: data.cycleId },
    data: { ...answers, selfInputSubmittedAt: new Date() },
  });

  await createNotification({
    userId: cycle.reviewerId,
    type: "SYSTEM",
    title: "Self-reflection submitted",
    body: "The reviewee's self-input is in — one step closer to synthesis.",
    link: `/people/develop/reviews/${cycle.id}`,
  });

  revalidateCycleSurfaces(cycle.id, cycle.revieweeId);
  return { ok: true };
}

// ── Contributor feedback ─────────────────────────────────────────────────────

const SubmitFeedbackSchema = z.object({
  feedbackId: z.string().min(1),
  doingWell: z.string().trim().max(10_000).optional(),
  needsSupport: z.string().trim().max(10_000).optional(),
  concerns: z.string().trim().max(10_000).optional(),
  examples: z.string().trim().max(10_000).optional(),
  suggestedNextStep: z.string().trim().max(10_000).optional(),
  topics: z.array(z.string()).max(10).default([]),
  flagForLeadership: z.boolean().default(false),
});

export async function submitCycleFeedback(
  input: z.infer<typeof SubmitFeedbackSchema>
): Promise<{ ok: true }> {
  const data = SubmitFeedbackSchema.parse(input);
  const sessionUser = await requireSessionUser();

  const feedback = await prisma.reviewCycleFeedback.findUnique({
    where: { id: data.feedbackId },
    select: {
      id: true,
      contributorId: true,
      cycle: {
        select: { id: true, state: true, type: true, revieweeId: true, reviewerId: true },
      },
    },
  });
  if (
    !feedback ||
    !canSubmitCycleFeedback(sessionUser.id, feedback, feedback.cycle.state)
  ) {
    throw new Error("Not found");
  }

  const topics = data.topics.filter((topic) =>
    isValidFeedbackTopic(feedback.cycle.type, topic)
  );

  const answers = {
    doingWell: data.doingWell || null,
    needsSupport: data.needsSupport || null,
    concerns: data.concerns || null,
    examples: data.examples || null,
    suggestedNextStep: data.suggestedNextStep || null,
  };
  if (!Object.values(answers).some(Boolean) && topics.length === 0) {
    throw new Error("Write at least one answer before submitting");
  }

  await prisma.reviewCycleFeedback.update({
    where: { id: data.feedbackId },
    data: {
      ...answers,
      topics,
      flagForLeadership: data.flagForLeadership,
      submittedAt: new Date(),
    },
  });

  await createNotification({
    userId: feedback.cycle.reviewerId,
    type: "SYSTEM",
    title: "Review feedback submitted",
    body: "A contributor's feedback is in.",
    link: `/people/develop/reviews/${feedback.cycle.id}`,
  });

  revalidateCycleSurfaces(feedback.cycle.id, feedback.cycle.revieweeId);
  return { ok: true };
}

// ── Synthesis ────────────────────────────────────────────────────────────────

const SynthesisSchema = z.object({
  cycleId: z.string().min(1),
  strengths: z.string().trim().max(10_000).optional(),
  growthAreas: z.string().trim().max(10_000).optional(),
  concerns: z.string().trim().max(10_000).optional(),
  coachingNotes: z.string().trim().max(10_000).optional(),
  recommendedNextStep: z.string().trim().max(10_000).optional(),
  recognitionFlag: z.boolean().default(false),
  leadershipFlag: z.boolean().default(false),
});

export async function submitCycleSynthesis(
  input: z.infer<typeof SynthesisSchema>
): Promise<{ ok: true }> {
  const data = SynthesisSchema.parse(input);
  const { cycle } = await requireCycleManager(data.cycleId);
  if (cycle.state !== "COLLECTING" && cycle.state !== "ACTION_PLAN") {
    throw new Error("The synthesis can no longer be edited");
  }

  const hasSubstance = Boolean(
    data.strengths || data.growthAreas || data.recommendedNextStep
  );
  if (!hasSubstance) {
    throw new Error(
      "Write at least strengths, growth areas, or a recommended next step"
    );
  }

  await prisma.reviewCycle.update({
    where: { id: data.cycleId },
    data: {
      strengths: data.strengths || null,
      growthAreas: data.growthAreas || null,
      concerns: data.concerns || null,
      coachingNotes: data.coachingNotes || null,
      recommendedNextStep: data.recommendedNextStep || null,
      recognitionFlag: data.recognitionFlag,
      leadershipFlag: data.leadershipFlag,
      synthesisSubmittedAt: new Date(),
      state: "ACTION_PLAN",
    },
  });

  revalidateCycleSurfaces(data.cycleId, cycle.revieweeId);
  return { ok: true };
}

// ── Action plan & follow-up ──────────────────────────────────────────────────

const CreateCycleActionSchema = z.object({
  cycleId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5_000).optional(),
  deadline: z.coerce.date(),
});

/**
 * Create a canonical Action Tracker item from the review — led by the
 * reviewee, provenance REVIEW_CYCLE so it renders as part of the coaching plan.
 */
export async function createCycleAction(
  input: z.infer<typeof CreateCycleActionSchema>
): Promise<{ ok: true; actionId: string }> {
  const data = CreateCycleActionSchema.parse(input);
  const { viewer, cycle } = await requireCycleManager(data.cycleId);
  if (cycle.state !== "ACTION_PLAN" && cycle.state !== "FOLLOW_UP") {
    throw new Error("Write the synthesis before creating actions");
  }

  const action = await prisma.actionItem.create({
    data: {
      title: data.title,
      description: data.description || null,
      leadId: cycle.revieweeId,
      createdById: viewer.id,
      deadlineStart: data.deadline,
      visibility: "ALL_LEADERSHIP",
      relatedEntityType: "USER",
      relatedEntityId: cycle.revieweeId,
      sourceType: "REVIEW_CYCLE",
      sourceId: cycle.id,
      assignments: {
        create: [{ userId: cycle.revieweeId, role: "LEAD" }],
      },
    },
    select: { id: true },
  });

  revalidateCycleSurfaces(data.cycleId, cycle.revieweeId);
  revalidatePath("/actions");
  return { ok: true, actionId: action.id };
}

const ScheduleFollowUpSchema = z.object({
  cycleId: z.string().min(1),
  followUpDueAt: z.coerce.date(),
  note: z.string().trim().max(2_000).optional(),
});

export async function scheduleCycleFollowUp(
  input: z.infer<typeof ScheduleFollowUpSchema>
): Promise<{ ok: true }> {
  const data = ScheduleFollowUpSchema.parse(input);
  const { cycle } = await requireCycleManager(data.cycleId);
  if (cycle.state !== "ACTION_PLAN" && cycle.state !== "FOLLOW_UP") {
    throw new Error("Write the synthesis before scheduling the follow-up");
  }

  await prisma.reviewCycle.update({
    where: { id: data.cycleId },
    data: {
      followUpDueAt: data.followUpDueAt,
      followUpNote: data.note || null,
      state: "FOLLOW_UP",
    },
  });

  revalidateCycleSurfaces(data.cycleId, cycle.revieweeId);
  return { ok: true };
}

// ── Release & complete ───────────────────────────────────────────────────────

export async function releaseCycleSummary(
  input: z.infer<typeof CycleIdSchema>
): Promise<{ ok: true }> {
  const { cycleId } = CycleIdSchema.parse(input);
  const { cycle } = await requireCycleManager(cycleId);
  if (!cycle.synthesisSubmittedAt) {
    throw new Error("Write the synthesis before releasing a summary");
  }
  if (cycle.releasedToRevieweeAt) return { ok: true };

  await prisma.reviewCycle.update({
    where: { id: cycleId },
    data: { releasedToRevieweeAt: new Date() },
  });
  await createNotification({
    userId: cycle.revieweeId,
    type: "SYSTEM",
    title: "Your review summary is ready",
    body: "Strengths, growth areas, and your recommended next step.",
    link: "/mentorship?view=me",
  });

  revalidateCycleSurfaces(cycleId, cycle.revieweeId);
  return { ok: true };
}

const CompleteCycleSchema = z.object({
  cycleId: z.string().min(1),
  release: z.boolean().default(true),
});

export async function completeReviewCycle(
  input: z.infer<typeof CompleteCycleSchema>
): Promise<{ ok: true }> {
  const data = CompleteCycleSchema.parse(input);
  const { cycle } = await requireCycleManager(data.cycleId);
  if (cycle.state === "COMPLETED") return { ok: true };
  if (!cycle.synthesisSubmittedAt) {
    throw new Error("Write the synthesis before completing the review");
  }

  const now = new Date();
  await prisma.reviewCycle.update({
    where: { id: data.cycleId },
    data: {
      state: "COMPLETED",
      completedAt: now,
      ...(data.release && !cycle.releasedToRevieweeAt
        ? { releasedToRevieweeAt: now }
        : {}),
    },
  });

  if (data.release) {
    await createNotification({
      userId: cycle.revieweeId,
      type: "SYSTEM",
      title: "Your review is complete",
      body: "Read your summary — strengths, growth areas, and your next step.",
      link: "/mentorship?view=me",
    });
  }

  revalidateCycleSurfaces(data.cycleId, cycle.revieweeId);
  return { ok: true };
}
