"use server";

/**
 * Review-cycle server actions (leadership command-center tier).
 *
 * Launching a cycle — for one person or a whole cohort — creates a ReviewCycle
 * plus one participant row per person, snapshotting their active mentorship.
 * Nothing else is written: each participant's stage is derived at read time
 * from the existing review artifacts (see lib/mentorship/cycle-progress.ts),
 * so the mentorship write paths stay untouched.
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { loadDevelopmentPeople } from "@/lib/development/load";
import { getCurrentCycleMonth } from "@/lib/mentorship-cycle";
import { currentQuarterLabel } from "@/lib/people-strategy/people-performance-selectors";

import { requireMentorshipCommandAccess } from "./command-access";
import { CYCLE_KINDS, type CycleKind } from "./cycle-constants";
import { resolveCohortFromFacts, type CohortScope } from "./cohort";
import { CohortScopeSchema, LaunchReviewCycleSchema } from "./cycle-schemas";

type LaunchResult =
  | { ok: true; cycleId: string; participantCount: number }
  | { ok: false; error: string };

function periodLabelFor(kind: CycleKind, now = new Date()): string {
  return kind === "quarterly"
    ? currentQuarterLabel(now)
    : getCurrentCycleMonth(now).cycleMonthKey;
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

/** Resolve a scope to concrete user ids + a human label. */
async function resolveCohort(
  scope: CohortScope
): Promise<{ userIds: string[]; label: string }> {
  if (scope.type === "chapter") {
    const [chapter, users] = await Promise.all([
      prisma.chapter.findUnique({
        where: { id: scope.chapterId },
        select: { name: true },
      }),
      prisma.user.findMany({
        where: {
          chapterId: scope.chapterId,
          archivedAt: null,
          OR: [
            {
              primaryRole: {
                in: ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT", "HIRING_CHAIR"],
              },
            },
            {
              roles: {
                some: { role: { in: ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT"] } },
              },
            },
          ],
        },
        select: { id: true },
      }),
    ]);
    return {
      userIds: unique(users.map((u) => u.id)),
      label: chapter?.name ? `${chapter.name} chapter` : "Chapter",
    };
  }

  if (scope.type === "custom") {
    const users = await prisma.user.findMany({
      where: { id: { in: unique(scope.userIds) }, archivedAt: null },
      select: { id: true, name: true, email: true },
    });
    const label =
      scope.label ??
      (users.length === 1
        ? users[0].name || users[0].email
        : `${users.length} selected people`);
    return { userIds: users.map((u) => u.id), label };
  }

  const people = await loadDevelopmentPeople();
  return resolveCohortFromFacts(scope, people);
}

/** Active non-student mentorships (as mentee), first one per person. */
async function activeMentorshipByMentee(
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const mentorships = await prisma.mentorship.findMany({
    where: {
      menteeId: { in: userIds },
      status: "ACTIVE",
      programGroup: { not: "STUDENT" },
    },
    orderBy: { startDate: "desc" },
    select: { id: true, menteeId: true },
  });
  const byMentee = new Map<string, string>();
  for (const m of mentorships) {
    if (!byMentee.has(m.menteeId)) byMentee.set(m.menteeId, m.id);
  }
  return byMentee;
}

export async function launchReviewCycle(input: unknown): Promise<LaunchResult> {
  const viewer = await requireMentorshipCommandAccess();
  const data = LaunchReviewCycleSchema.parse(input);

  const { userIds, label } = await resolveCohort(data.scope);
  if (userIds.length === 0) {
    return { ok: false, error: "No one matches this cohort — nothing to launch." };
  }

  const periodLabel = periodLabelFor(data.kind);
  const mentorshipByMentee = await activeMentorshipByMentee(userIds);

  let cycle;
  try {
    cycle = await prisma.$transaction(async (tx) => {
      const created = await tx.reviewCycle.create({
        data: {
          name: data.name ?? `${label} — ${periodLabel}`,
          kind: data.kind,
          periodLabel,
          scopeType: data.scope.type,
          scopeLabel: label,
          scopeJson: JSON.parse(JSON.stringify(data.scope)),
          dueDate: data.dueDate ?? null,
          createdById: viewer.id,
        },
      });
      await tx.reviewCycleParticipant.createMany({
        data: userIds.map((userId) => ({
          cycleId: created.id,
          userId,
          mentorshipId: mentorshipByMentee.get(userId) ?? null,
        })),
        skipDuplicates: true,
      });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[launchReviewCycle] Prisma error creating cycle.", error);
      return {
        ok: false,
        error:
          "Couldn't launch this review cycle — something went wrong saving it. Try again, and let support know if it keeps happening.",
      };
    }
    throw error;
  }

  revalidatePath("/mentorship");
  revalidatePath("/mentorship/cycles");
  return { ok: true, cycleId: cycle.id, participantCount: userIds.length };
}

/** Read-only cohort preview for the launcher. */
export async function previewReviewCycleCohort(input: unknown): Promise<
  | { ok: true; count: number; label: string; sampleNames: string[] }
  | { ok: false; error: string }
> {
  await requireMentorshipCommandAccess();
  const scope = CohortScopeSchema.parse(input);

  const { userIds, label } = await resolveCohort(scope);
  if (userIds.length === 0) {
    return { ok: false, error: "No one matches this cohort yet." };
  }
  const sample = await prisma.user.findMany({
    where: { id: { in: userIds.slice(0, 8) } },
    select: { name: true, email: true },
    orderBy: { name: "asc" },
  });
  return {
    ok: true,
    count: userIds.length,
    label,
    sampleNames: sample.map((u) => u.name || u.email),
  };
}

/** "Start a review" for exactly one person — a single-participant cycle. */
export async function startReviewForPerson(input: unknown): Promise<LaunchResult> {
  await requireMentorshipCommandAccess();
  const { userId, kind } = z
    .object({
      userId: z.string().trim().min(1),
      kind: z.enum(CYCLE_KINDS).default("monthly"),
    })
    .parse(input);

  // Idempotent: if they already sit in an active cycle of this kind, land on
  // that cycle instead of stacking a duplicate concurrent one.
  const existing = await prisma.reviewCycleParticipant.findFirst({
    where: { userId, cycle: { status: "active", kind } },
    orderBy: { addedAt: "desc" },
    select: {
      cycleId: true,
      cycle: { select: { _count: { select: { participants: true } } } },
    },
  });
  if (existing) {
    return {
      ok: true,
      cycleId: existing.cycleId,
      participantCount: existing.cycle._count.participants,
    };
  }

  return launchReviewCycle({
    kind,
    scope: { type: "custom", userIds: [userId] },
  });
}

export async function closeReviewCycle(input: unknown) {
  await requireMentorshipCommandAccess();
  const { cycleId } = z.object({ cycleId: z.string().trim().min(1) }).parse(input);

  await prisma.reviewCycle.update({
    where: { id: cycleId },
    data: { status: "closed", closedAt: new Date() },
  });
  revalidatePath("/mentorship");
  revalidatePath("/mentorship/cycles");
  revalidatePath(`/mentorship/cycles/${cycleId}`);
  return { ok: true };
}

export async function setParticipantOverride(input: unknown) {
  await requireMentorshipCommandAccess();
  const { participantId, override } = z
    .object({
      participantId: z.string().trim().min(1),
      override: z.enum(["waived"]).nullable(),
    })
    .parse(input);

  const participant = await prisma.reviewCycleParticipant.update({
    where: { id: participantId },
    data: { stageOverride: override },
    select: { cycleId: true },
  });
  revalidatePath(`/mentorship/cycles/${participant.cycleId}`);
  revalidatePath("/mentorship/cycles");
  return { ok: true };
}
