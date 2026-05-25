"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InstructorLifecycleStage, InstructorTaskKind, TagNamespace, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const OPS_PATHS = [
  "/admin/instructors",
  "/admin/instructor-assignments",
  "/admin/instructor-mentor-matching",
];

function revalidateOps() {
  for (const p of OPS_PATHS) revalidatePath(p);
}

// ─────────────────────────────────────────────────────────────────────────────
// InstructorProfile — upsert + lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertInstructorProfile(data: {
  userId: string;
  lifecycleStage?: InstructorLifecycleStage;
  weeklyHoursAvail?: number | null;
  maxConcurrent?: number;
  isLeadershipTrack?: boolean;
  isOnHold?: boolean;
}) {
  await requireAdmin();
  const { userId, lifecycleStage, ...rest } = data;

  const profile = await prisma.instructorProfile.upsert({
    where: { userId },
    create: {
      userId,
      lifecycleStage: lifecycleStage ?? "ACTIVE",
      stageEnteredAt: new Date(),
      ...rest,
    },
    update: {
      ...(lifecycleStage ? { lifecycleStage, stageEnteredAt: new Date() } : {}),
      ...rest,
    },
  });
  revalidateOps();
  return { success: true, profile };
}

export async function updateInstructorLifecycleStage(
  userId: string,
  newStage: InstructorLifecycleStage,
) {
  await requireAdmin();

  await prisma.instructorProfile.upsert({
    where: { userId },
    create: {
      userId,
      lifecycleStage: newStage,
      stageEnteredAt: new Date(),
    },
    update: {
      lifecycleStage: newStage,
      stageEnteredAt: new Date(),
    },
  });
  revalidateOps();
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────────────────

const tagUpsertSchema = z.object({
  namespace: z.nativeEnum(TagNamespace),
  slug: z.string().min(1).max(64).toLowerCase().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(80),
  color: z.string().optional(),
});

export async function ensureTag(input: z.infer<typeof tagUpsertSchema>) {
  await requireAdmin();
  const data = tagUpsertSchema.parse(input);
  return prisma.tag.upsert({
    where: { namespace_slug: { namespace: data.namespace, slug: data.slug } },
    create: data,
    update: { label: data.label, color: data.color },
  });
}

export async function addTagToInstructor(userId: string, tagId: string, source = "manual") {
  await requireAdmin();
  const profile = await getOrCreateProfile(userId);
  await prisma.instructorTag.upsert({
    where: { profileId_tagId: { profileId: profile.id, tagId } },
    create: { profileId: profile.id, tagId, source },
    update: {},
  });
  revalidateOps();
  return { success: true };
}

export async function removeTagFromInstructor(userId: string, tagId: string) {
  await requireAdmin();
  const profile = await prisma.instructorProfile.findUnique({ where: { userId } });
  if (!profile) return { success: true };
  await prisma.instructorTag.deleteMany({
    where: { profileId: profile.id, tagId },
  });
  revalidateOps();
  return { success: true };
}

export async function listAllTags() {
  return prisma.tag.findMany({
    where: { isSystem: false },
    orderBy: [{ namespace: "asc" }, { label: "asc" }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────────────────────

const noteSchema = z.object({
  userId: z.string().min(1),
  body: z.string().min(1).max(4000),
  isPinned: z.boolean().optional(),
  visibility: z.enum(["global", "chapter", "private"]).optional(),
});

export async function createInstructorNote(input: z.infer<typeof noteSchema>) {
  const admin = await requireAdmin();
  const data = noteSchema.parse(input);
  const profile = await getOrCreateProfile(data.userId);

  const note = await prisma.instructorNote.create({
    data: {
      profileId: profile.id,
      authorId: admin.id,
      body: data.body,
      isPinned: data.isPinned ?? false,
      visibility: data.visibility ?? "global",
    },
    include: { author: { select: { name: true } } },
  });
  revalidateOps();
  return { success: true, note };
}

export async function updateInstructorNote(
  noteId: string,
  patch: { body?: string; isPinned?: boolean },
) {
  await requireAdmin();
  const note = await prisma.instructorNote.update({
    where: { id: noteId },
    data: patch,
  });
  revalidateOps();
  return { success: true, note };
}

export async function deleteInstructorNote(noteId: string) {
  await requireAdmin();
  await prisma.instructorNote.delete({ where: { id: noteId } });
  revalidateOps();
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────────────────────────────────

const taskSchema = z.object({
  userId: z.string().min(1),
  kind: z.nativeEnum(InstructorTaskKind).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
  assigneeId: z.string().optional(),
});

export async function createInstructorTask(input: z.infer<typeof taskSchema>) {
  await requireAdmin();
  const data = taskSchema.parse(input);
  const profile = await getOrCreateProfile(data.userId);

  const task = await prisma.instructorTask.create({
    data: {
      profileId: profile.id,
      kind: data.kind ?? "MANUAL",
      title: data.title,
      description: data.description,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      assigneeId: data.assigneeId,
    },
    include: { assignee: { select: { name: true } } },
  });
  revalidateOps();
  return { success: true, task };
}

export async function resolveInstructorTask(taskId: string) {
  const admin = await requireAdmin();
  await prisma.instructorTask.update({
    where: { id: taskId },
    data: { resolvedAt: new Date(), resolvedById: admin.id },
  });
  revalidateOps();
  return { success: true };
}

export async function deleteInstructorTask(taskId: string) {
  await requireAdmin();
  await prisma.instructorTask.delete({ where: { id: taskId } });
  revalidateOps();
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved Views
// ─────────────────────────────────────────────────────────────────────────────

export async function createSavedView(input: {
  name: string;
  filters: Record<string, unknown>;
  isShared?: boolean;
  scope?: string;
}) {
  const admin = await requireAdmin();
  const view = await prisma.instructorSavedView.create({
    data: {
      ownerId: admin.id,
      name: input.name,
      filters: input.filters as Prisma.InputJsonValue,
      isShared: input.isShared ?? false,
      scope: input.scope ?? "personal",
    },
  });
  revalidateOps();
  return { success: true, view };
}

export async function deleteSavedView(viewId: string) {
  await requireAdmin();
  await prisma.instructorSavedView.delete({ where: { id: viewId } });
  revalidateOps();
  return { success: true };
}

export async function listSavedViews() {
  const admin = await requireAdmin();
  return prisma.instructorSavedView.findMany({
    where: {
      OR: [
        { ownerId: admin.id },
        { isShared: true },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Snapshots
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertMetricSnapshot(input: {
  userId: string;
  weekStart: Date;
  classesTaught?: number;
  hoursTaught?: number;
  noShows?: number;
  ratingAvg?: number | null;
  studentsServed?: number;
}) {
  await requireAdmin();
  const profile = await getOrCreateProfile(input.userId);

  const snap = await prisma.instructorMetricSnapshot.upsert({
    where: { profileId_weekStart: { profileId: profile.id, weekStart: input.weekStart } },
    create: {
      profileId: profile.id,
      weekStart: input.weekStart,
      classesTaught: input.classesTaught ?? 0,
      hoursTaught: input.hoursTaught ?? 0,
      noShows: input.noShows ?? 0,
      ratingAvg: input.ratingAvg ?? null,
      studentsServed: input.studentsServed ?? 0,
    },
    update: {
      classesTaught: input.classesTaught ?? 0,
      hoursTaught: input.hoursTaught ?? 0,
      noShows: input.noShows ?? 0,
      ratingAvg: input.ratingAvg ?? null,
      studentsServed: input.studentsServed ?? 0,
    },
  });
  return { success: true, snap };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function bulkUpdateLifecycleStage(
  userIds: string[],
  stage: InstructorLifecycleStage,
) {
  await requireAdmin();
  const ids = z.array(z.string().min(1)).min(1).max(200).parse(userIds);

  await Promise.all(
    ids.map((uid) =>
      prisma.instructorProfile.upsert({
        where: { userId: uid },
        create: { userId: uid, lifecycleStage: stage, stageEnteredAt: new Date() },
        update: { lifecycleStage: stage, stageEnteredAt: new Date() },
      }),
    ),
  );
  revalidateOps();
  return { success: true, updated: ids.length };
}

export async function bulkAddTag(userIds: string[], tagId: string) {
  await requireAdmin();
  const ids = z.array(z.string().min(1)).min(1).max(200).parse(userIds);

  await Promise.all(
    ids.map(async (uid) => {
      const profile = await getOrCreateProfile(uid);
      await prisma.instructorTag.upsert({
        where: { profileId_tagId: { profileId: profile.id, tagId } },
        create: { profileId: profile.id, tagId, source: "manual" },
        update: {},
      });
    }),
  );
  revalidateOps();
  return { success: true, updated: ids.length };
}

export async function bulkSetOnHold(userIds: string[], onHold: boolean) {
  await requireAdmin();
  const ids = z.array(z.string().min(1)).min(1).max(200).parse(userIds);

  await Promise.all(
    ids.map((uid) =>
      prisma.instructorProfile.upsert({
        where: { userId: uid },
        create: { userId: uid, isOnHold: onHold },
        update: { isOnHold: onHold },
      }),
    ),
  );
  revalidateOps();
  return { success: true, updated: ids.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ops Hub data loader
// ─────────────────────────────────────────────────────────────────────────────

export type InstructorOpsRow = {
  id: string;
  name: string;
  email: string;
  chapterId: string | null;
  chapterName: string | null;
  lifecycleStage: InstructorLifecycleStage;
  stageEnteredAt: string;
  isLeadershipTrack: boolean;
  isOnHold: boolean;
  readinessScore: number | null;
  reliabilityScore: number | null;
  lastActiveAt: string | null;
  weeklyHoursAvail: number | null;
  maxConcurrent: number;
  profileId: string | null;
  tags: { tagId: string; namespace: string; slug: string; label: string; color: string | null }[];
  openTaskCount: number;
  mentorName: string | null;
  trainingPct: number;
  approvalStatus: string;
  createdAt: string;
};

export async function loadInstructorOpsData(): Promise<InstructorOpsRow[]> {
  const users = await prisma.user.findMany({
    where: { roles: { some: { role: "INSTRUCTOR" } } },
    include: {
      chapter: { select: { id: true, name: true } },
      instructorProfile: {
        include: {
          tags: { include: { tag: true } },
          tasks: { where: { resolvedAt: null }, select: { id: true } },
        },
      },
      menteePairs: {
        where: { type: "INSTRUCTOR" },
        include: { mentor: { select: { name: true } } },
      },
      trainings: { select: { status: true } },
      interviewGate: { select: { status: true } },
      classOfferingsInstructed: {
        select: {
          grandfatheredTrainingExemption: true,
          approval: { select: { status: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((u): InstructorOpsRow => {
    const profile = u.instructorProfile;
    const completedTrainings = u.trainings.filter((t) => t.status === "COMPLETE").length;
    const totalTrainings = u.trainings.length;
    const trainingPct = totalTrainings > 0 ? Math.round((completedTrainings / totalTrainings) * 100) : 0;
    const interviewPassed =
      u.interviewGate?.status === "PASSED" || u.interviewGate?.status === "WAIVED";
    const pendingApprovals = u.classOfferingsInstructed.filter((o) =>
      ["REQUESTED", "UNDER_REVIEW"].includes(o.approval?.status ?? ""),
    ).length;
    const approvedOfferings = u.classOfferingsInstructed.filter(
      (o) => o.grandfatheredTrainingExemption || o.approval?.status === "APPROVED",
    ).length;

    const approvalStatus =
      pendingApprovals > 0
        ? "APPROVAL_IN_REVIEW"
        : !interviewPassed
          ? "INTERVIEW_PENDING"
          : approvedOfferings > 0
            ? "APPROVED"
            : "APPROVAL_READY";

    const mentor = u.menteePairs.find((m) => m.type === "INSTRUCTOR")?.mentor;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      chapterId: u.chapterId,
      chapterName: u.chapter?.name ?? null,
      lifecycleStage: profile?.lifecycleStage ?? "ACTIVE",
      stageEnteredAt: (profile?.stageEnteredAt ?? u.createdAt).toISOString(),
      isLeadershipTrack: profile?.isLeadershipTrack ?? false,
      isOnHold: profile?.isOnHold ?? false,
      readinessScore: profile?.readinessScore ?? null,
      reliabilityScore: profile?.reliabilityScore ?? null,
      lastActiveAt: profile?.lastActiveAt?.toISOString() ?? null,
      weeklyHoursAvail: profile?.weeklyHoursAvail ?? null,
      maxConcurrent: profile?.maxConcurrent ?? 2,
      profileId: profile?.id ?? null,
      tags: (profile?.tags ?? []).map((t) => ({
        tagId: t.tagId,
        namespace: t.tag.namespace,
        slug: t.tag.slug,
        label: t.tag.label,
        color: t.tag.color,
      })),
      openTaskCount: profile?.tasks?.length ?? 0,
      mentorName: mentor?.name ?? null,
      trainingPct,
      approvalStatus,
      createdAt: u.createdAt.toISOString(),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mentor matching data loader
// ─────────────────────────────────────────────────────────────────────────────

export type MentorSlot = {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  chapterName: string | null;
  currentMenteeCount: number;
  maxMentees: number; // derived: maxConcurrent on profile or 3 default
  availableSlots: number;
};

export type UnmatchedMentee = {
  userId: string;
  name: string;
  email: string;
  chapterName: string | null;
  stageEnteredAt: string;
  daysSinceStage: number;
};

export async function loadMentorMatchingData(): Promise<{
  mentors: MentorSlot[];
  unmatched: UnmatchedMentee[];
}> {
  const [mentorUsers, instructors] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: "MENTOR" } } },
      include: {
        chapter: { select: { name: true } },
        instructorProfile: { select: { maxConcurrent: true } },
        mentorPairs: {
          where: { status: "ACTIVE", type: "INSTRUCTOR" },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: "INSTRUCTOR" } } },
      include: {
        chapter: { select: { name: true } },
        instructorProfile: { select: { lifecycleStage: true, stageEnteredAt: true } },
        menteePairs: {
          where: { status: "ACTIVE", type: "INSTRUCTOR" },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const mentors: MentorSlot[] = mentorUsers.map((m) => {
    const maxMentees = m.instructorProfile?.maxConcurrent ?? 3;
    const currentMenteeCount = m.mentorPairs.length;
    return {
      mentorId: m.id,
      mentorName: m.name,
      mentorEmail: m.email,
      chapterName: m.chapter?.name ?? null,
      currentMenteeCount,
      maxMentees,
      availableSlots: Math.max(0, maxMentees - currentMenteeCount),
    };
  });

  const now = new Date();
  const unmatched: UnmatchedMentee[] = instructors
    .filter(
      (i) =>
        i.menteePairs.length === 0 &&
        (i.instructorProfile?.lifecycleStage === "ACTIVE" ||
          i.instructorProfile?.lifecycleStage === "ONBOARDING" ||
          !i.instructorProfile),
    )
    .map((i) => {
      const stageEnteredAt = i.instructorProfile?.stageEnteredAt ?? i.createdAt;
      const daysSinceStage = Math.floor(
        (now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        userId: i.id,
        name: i.name,
        email: i.email,
        chapterName: i.chapter?.name ?? null,
        stageEnteredAt: stageEnteredAt.toISOString(),
        daysSinceStage,
      };
    })
    .sort((a, b) => b.daysSinceStage - a.daysSinceStage);

  return { mentors, unmatched };
}

export async function assignMentorToInstructor(menteeId: string, mentorId: string) {
  await requireAdmin();

  const existing = await prisma.mentorship.findFirst({
    where: { menteeId, type: "INSTRUCTOR", status: "ACTIVE" },
  });
  if (existing) {
    await prisma.mentorship.update({
      where: { id: existing.id },
      data: { mentorId },
    });
  } else {
    await prisma.mentorship.create({
      data: {
        menteeId,
        mentorId,
        type: "INSTRUCTOR",
        status: "ACTIVE",
        programGroup: "INSTRUCTOR",
      },
    });
  }
  revalidateOps();
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual profile loader — returns plain serializable data to avoid
// TypeScript inference issues across the "use server" boundary.
// ─────────────────────────────────────────────────────────────────────────────

export type InstructorProfileDetail = {
  userId: string;
  name: string;
  email: string;
  chapterName: string | null;
  growthTier: string | null;
  interviewStatus: string | null;
  mentorName: string | null;
  completedTrainings: number;
  totalTrainings: number;
  profile: {
    id: string;
    lifecycleStage: InstructorLifecycleStage;
    isLeadershipTrack: boolean;
    isOnHold: boolean;
    weeklyHoursAvail: number | null;
    maxConcurrent: number;
    readinessScore: number | null;
    reliabilityScore: number | null;
  } | null;
  notes: {
    id: string;
    body: string;
    isPinned: boolean;
    visibility: string;
    authorName: string;
    createdAt: string;
    updatedAt: string;
  }[];
  tasks: {
    id: string;
    kind: InstructorTaskKind;
    title: string;
    description: string | null;
    dueAt: string | null;
    assigneeName: string | null;
    resolvedAt: string | null;
    createdAt: string;
  }[];
  tags: {
    tagId: string;
    namespace: string;
    slug: string;
    label: string;
    color: string | null;
  }[];
  metrics: {
    weekStart: string;
    classesTaught: number;
    hoursTaught: number;
    noShows: number;
    ratingAvg: number | null;
    studentsServed: number;
  }[];
};

export async function loadInstructorProfileDetail(userId: string): Promise<InstructorProfileDetail> {
  const [user, opsProfile] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        chapter: { select: { name: true } },
        menteePairs: {
          where: { type: "INSTRUCTOR" },
          include: { mentor: { select: { name: true } } },
        },
        trainings: { select: { status: true } },
        interviewGate: { select: { status: true } },
        instructorGrowthProfile: { select: { currentTier: true } },
      },
    }),
    prisma.instructorProfile.findUnique({
      where: { userId },
      include: {
        tags: { include: { tag: true } },
        notes: {
          include: { author: { select: { name: true } } },
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        },
        tasks: {
          include: { assignee: { select: { name: true } } },
          orderBy: [{ resolvedAt: "asc" }, { dueAt: "asc" }],
        },
        metrics: {
          orderBy: { weekStart: "desc" },
          take: 12,
        },
      },
    }),
  ]);

  const mentor = user.menteePairs.find((m) => m.type === "INSTRUCTOR")?.mentor ?? null;
  const completedTrainings = user.trainings.filter((t) => t.status === "COMPLETE").length;

  return {
    userId,
    name: user.name,
    email: user.email,
    chapterName: user.chapter?.name ?? null,
    growthTier: user.instructorGrowthProfile?.currentTier ?? null,
    interviewStatus: user.interviewGate?.status ?? null,
    mentorName: mentor?.name ?? null,
    completedTrainings,
    totalTrainings: user.trainings.length,
    profile: opsProfile
      ? {
          id: opsProfile.id,
          lifecycleStage: opsProfile.lifecycleStage,
          isLeadershipTrack: opsProfile.isLeadershipTrack,
          isOnHold: opsProfile.isOnHold,
          weeklyHoursAvail: opsProfile.weeklyHoursAvail,
          maxConcurrent: opsProfile.maxConcurrent,
          readinessScore: opsProfile.readinessScore,
          reliabilityScore: opsProfile.reliabilityScore,
        }
      : null,
    notes: (opsProfile?.notes ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      isPinned: n.isPinned,
      visibility: n.visibility,
      authorName: n.author.name,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
    tasks: (opsProfile?.tasks ?? []).map((t) => ({
      id: t.id,
      kind: t.kind,
      title: t.title,
      description: t.description ?? null,
      dueAt: t.dueAt?.toISOString() ?? null,
      assigneeName: t.assignee?.name ?? null,
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    tags: (opsProfile?.tags ?? []).map((t) => ({
      tagId: t.tagId,
      namespace: t.tag.namespace,
      slug: t.tag.slug,
      label: t.tag.label,
      color: t.tag.color,
    })),
    metrics: (opsProfile?.metrics ?? []).map((m) => ({
      weekStart: m.weekStart.toISOString(),
      classesTaught: m.classesTaught,
      hoursTaught: m.hoursTaught,
      noShows: m.noShows,
      ratingAvg: m.ratingAvg,
      studentsServed: m.studentsServed,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getOrCreateProfile(userId: string) {
  return prisma.instructorProfile.upsert({
    where: { userId },
    create: { userId, lifecycleStage: "ACTIVE" },
    update: {},
  });
}
