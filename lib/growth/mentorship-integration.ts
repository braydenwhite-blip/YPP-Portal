/**
 * Student Operating System / Growth Engine (Phase N1) — mentorship integration.
 *
 * Wires the M2 mentorship lifecycle into the Growth hierarchy WITHOUT a duplicate
 * system: on an approved match we reuse the existing Action Tracker bridge
 * (createMentorshipActionSeed) to seed GrowthGoal/GrowthMilestone/GrowthAction
 * rows, then emit MENTOR_MATCHED. All work is flag-gated and best-effort, so a
 * growth-tracking hiccup never breaks the mentorship flow. Idempotent: every
 * seeded node is keyed by (userId, source="mentorship", sourceRef).
 */

import { prisma } from "@/lib/prisma";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { createMentorshipActionSeed } from "@/lib/action-tracker-3/mentorship-bridge";
import { buildMentorshipGrowthPlan } from "./mentorship-plan";
import { emitGrowthEvent } from "./emit";

const SOURCE = "mentorship";

/**
 * Create the Growth hierarchy for a newly matched mentorship from the bridge
 * seed. Idempotent + best-effort. Returns the number of nodes created.
 */
export async function seedGrowthFromMentorship(
  menteeUserId: string,
  mentorshipId: string
): Promise<{ created: number }> {
  if (!isGrowthOsEnabled()) return { created: 0 };

  try {
    const [mentorship, application, profile] = await Promise.all([
      prisma.mentorship.findUnique({
        where: { id: mentorshipId },
        select: {
          id: true,
          mentor: {
            select: {
              name: true,
              mentorExpertise: {
                select: {
                  expertiseArea: { select: { slug: true, name: true, isActive: true } },
                },
              },
            },
          },
        },
      }),
      prisma.mentorshipApplication.findFirst({
        where: { applicantId: menteeUserId },
        orderBy: { createdAt: "desc" },
        select: { goals: true, interests: true },
      }),
      prisma.userProfile.findUnique({
        where: { userId: menteeUserId },
        select: { careerGoal: true, leadershipGoal: true },
      }),
    ]);
    if (!mentorship) return { created: 0 };

    const mentorExpertise = (mentorship.mentor?.mentorExpertise ?? [])
      .filter((e) => e.expertiseArea.isActive)
      .map((e) => ({ slug: e.expertiseArea.slug, name: e.expertiseArea.name }));

    const seed = createMentorshipActionSeed({
      application: {
        goals: application?.goals ?? null,
        interests: application?.interests ?? [],
        careerGoal: profile?.careerGoal ?? null,
        leadershipGoal: profile?.leadershipGoal ?? null,
      },
      mentorExpertise,
      mentorName: mentorship.mentor?.name ?? null,
    });

    const plan = buildMentorshipGrowthPlan(seed, mentorshipId);
    let created = 0;

    for (const [goalIndex, planGoal] of plan.goals.entries()) {
      const goalId = await ensureGoal(menteeUserId, {
        title: planGoal.title,
        description: planGoal.description ?? null,
        sourceRef: planGoal.sourceRef,
        order: goalIndex,
      });
      if (goalId.created) created += 1;

      for (const [mIndex, m] of planGoal.milestones.entries()) {
        const milestoneId = await ensureMilestone(menteeUserId, goalId.id, {
          title: m.title,
          description: m.description ?? null,
          sourceRef: m.sourceRef,
          order: mIndex,
        });
        if (milestoneId.created) created += 1;
      }

      for (const [aIndex, a] of planGoal.actions.entries()) {
        const actionCreated = await ensureAction(menteeUserId, goalId.id, {
          title: a.title,
          sourceRef: a.sourceRef,
          order: aIndex,
        });
        if (actionCreated) created += 1;
      }
    }

    return { created };
  } catch (error) {
    console.error("[seedGrowthFromMentorship] error:", error);
    return { created: 0 };
  }
}

/**
 * Full match hook: seed the hierarchy, then emit MENTOR_MATCHED (which recomputes
 * achievements + opportunities, now seeing the seeded open actions). Best-effort.
 */
export async function onMentorMatched(
  menteeUserId: string,
  mentorshipId: string
): Promise<void> {
  if (!isGrowthOsEnabled()) return;
  try {
    await seedGrowthFromMentorship(menteeUserId, mentorshipId);
    await emitGrowthEvent({
      userId: menteeUserId,
      type: "MENTOR_MATCHED",
      sourceType: "mentorship",
      sourceId: mentorshipId,
    });
  } catch (error) {
    console.error("[onMentorMatched] error:", error);
  }
}

/* ------------------------- idempotent upsert helpers ----------------------- */

async function ensureGoal(
  userId: string,
  input: { title: string; description: string | null; sourceRef: string; order: number }
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.growthGoal.findFirst({
    where: { userId, source: SOURCE, sourceRef: input.sourceRef },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const goal = await prisma.growthGoal.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      track: "MENTORSHIP",
      source: SOURCE,
      sourceRef: input.sourceRef,
      order: input.order,
    },
    select: { id: true },
  });
  return { id: goal.id, created: true };
}

async function ensureMilestone(
  userId: string,
  goalId: string,
  input: { title: string; description: string | null; sourceRef: string; order: number }
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.growthMilestone.findFirst({
    where: { userId, source: SOURCE, sourceRef: input.sourceRef },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const milestone = await prisma.growthMilestone.create({
    data: {
      userId,
      goalId,
      title: input.title,
      description: input.description,
      source: SOURCE,
      sourceRef: input.sourceRef,
      order: input.order,
    },
    select: { id: true },
  });
  return { id: milestone.id, created: true };
}

async function ensureAction(
  userId: string,
  goalId: string,
  input: { title: string; sourceRef: string; order: number }
): Promise<boolean> {
  const existing = await prisma.growthAction.findFirst({
    where: { userId, source: SOURCE, sourceRef: input.sourceRef },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.growthAction.create({
    data: {
      userId,
      goalId,
      title: input.title,
      source: SOURCE,
      sourceRef: input.sourceRef,
      order: input.order,
    },
  });
  return true;
}
