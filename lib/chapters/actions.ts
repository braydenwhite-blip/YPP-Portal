"use server";

// Server actions for the chapter operating system. Every mutation: validate with
// zod, authorize with a chapter guard (lib/chapters/access.ts), write, then
// revalidate the affected surfaces. Chapter "next steps" flow into the Action
// Tracker; chapter meetings are real Meeting rows in the existing runner.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChapterLifecycleStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { slugifyChapterName } from "@/lib/chapter-calendar";
import {
  requireChapterManager,
  requireChapterLeadership,
} from "@/lib/chapters/access";
import {
  createChapterActionItem,
  createChapterActionFromMeetingFollowUp,
  completeChapterActionItem,
  reopenChapterActionItem,
} from "@/lib/chapters/action-bridge";
import { readChecklistMeta } from "@/lib/chapters/provisioning";
import { isValidChapterLifecycleStatus } from "@/lib/chapters/lifecycle";

const DAY_MS = 24 * 60 * 60 * 1000;

const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  CURRICULUM: "Curriculum help",
  INSTRUCTOR: "Instructor help",
  PARTNER: "Partner help",
  RECRUITMENT: "Recruitment help",
  EVENT_PLANNING: "Event planning help",
  SCHOOL_APPROVAL: "School approval help",
  GENERAL: "General leadership help",
};

type Db = Prisma.TransactionClient;

function revalidateChapterSurfaces(chapterId: string) {
  revalidatePath("/chapter");
  revalidatePath("/chapter/launch");
  revalidatePath("/chapter/workspace");
  revalidatePath("/admin/chapters");
  revalidatePath("/admin/chapters/map");
  revalidatePath(`/admin/chapters/${chapterId}`);
  revalidatePath("/");
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Flip the LaunchTask matching a checklist key, syncing its linked action. */
async function markChecklistByKey(
  db: Db,
  chapterId: string,
  key: string,
  done: boolean
): Promise<void> {
  const tasks = await db.launchTask.findMany({
    where: { chapterId, scope: "CHAPTER" },
    select: { id: true, metadata: true },
  });
  const match = tasks.find((t) => readChecklistMeta(t.metadata).key === key);
  if (!match) return;
  const meta = readChecklistMeta(match.metadata);
  await db.launchTask.update({
    where: { id: match.id },
    data: { status: done ? "COMPLETE" : "NOT_STARTED" },
  });
  if (meta.actionItemId) {
    if (done) await completeChapterActionItem(db, meta.actionItemId);
    else await reopenChapterActionItem(db, meta.actionItemId);
  }
}

// --- Chapter setup -----------------------------------------------------------

const ChapterSetupSchema = z.object({
  chapterId: z.string().min(1),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  schoolType: z
    .enum(["PUBLIC", "PRIVATE", "CHARTER", "HOMESCHOOL", "COLLEGE", "OTHER"])
    .nullable()
    .optional(),
  partnerSchool: z.string().max(160).optional(),
  facultyAdvisorName: z.string().max(160).optional(),
  facultyAdvisorEmail: z.string().max(200).optional(),
  foundingTeamNotes: z.string().max(4000).optional(),
  recruitmentGoal: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  supportNeeded: z.string().max(4000).optional(),
  launchTargetDate: z.string().nullable().optional(),
  expectedFirstMeetingAt: z.string().nullable().optional(),
});

export async function updateChapterSetup(input: unknown) {
  const data = ChapterSetupSchema.parse(input);
  await requireChapterManager(data.chapterId);

  const patch: Prisma.ChapterUncheckedUpdateInput = {};
  if (data.city !== undefined) patch.city = data.city.trim() || null;
  if (data.state !== undefined) patch.state = data.state.trim() || null;
  if (data.schoolType !== undefined) patch.schoolType = data.schoolType ?? null;
  if (data.partnerSchool !== undefined) patch.partnerSchool = data.partnerSchool.trim() || null;
  if (data.facultyAdvisorName !== undefined)
    patch.facultyAdvisorName = data.facultyAdvisorName.trim() || null;
  if (data.facultyAdvisorEmail !== undefined)
    patch.facultyAdvisorEmail = data.facultyAdvisorEmail.trim() || null;
  if (data.foundingTeamNotes !== undefined)
    patch.foundingTeamNotes = data.foundingTeamNotes.trim() || null;
  if (data.recruitmentGoal !== undefined) patch.recruitmentGoal = data.recruitmentGoal ?? null;
  if (data.supportNeeded !== undefined) patch.supportNeeded = data.supportNeeded.trim() || null;
  if (data.launchTargetDate !== undefined)
    patch.launchTargetDate = parseOptionalDate(data.launchTargetDate);
  if (data.expectedFirstMeetingAt !== undefined)
    patch.expectedFirstMeetingAt = parseOptionalDate(data.expectedFirstMeetingAt);

  await prisma.chapter.update({ where: { id: data.chapterId }, data: patch });
  revalidateChapterSurfaces(data.chapterId);
  return { ok: true as const };
}

// --- Lifecycle (leadership) --------------------------------------------------

const LifecycleSchema = z.object({
  chapterId: z.string().min(1),
  status: z.string().min(1),
  note: z.string().max(2000).optional(),
});

export async function setChapterLifecycleStatus(input: unknown) {
  const data = LifecycleSchema.parse(input);
  await requireChapterLeadership();
  if (!isValidChapterLifecycleStatus(data.status)) {
    throw new Error("Invalid chapter status");
  }
  const patch: Prisma.ChapterUncheckedUpdateInput = {
    lifecycleStatus: data.status as ChapterLifecycleStatus,
    lifecycleUpdatedAt: new Date(),
  };
  if (data.note !== undefined) patch.lifecycleNote = data.note.trim() || null;
  if (data.status === "ACTIVE") {
    const existing = await prisma.chapter.findUnique({
      where: { id: data.chapterId },
      select: { launchedAt: true },
    });
    if (existing && !existing.launchedAt) patch.launchedAt = new Date();
  }
  await prisma.chapter.update({ where: { id: data.chapterId }, data: patch });
  revalidateChapterSurfaces(data.chapterId);
  return { ok: true as const };
}

// --- Launch checklist --------------------------------------------------------

const ToggleChecklistSchema = z.object({
  chapterId: z.string().min(1),
  launchTaskId: z.string().min(1),
  done: z.boolean(),
});

export async function toggleLaunchChecklistItem(input: unknown) {
  const data = ToggleChecklistSchema.parse(input);
  const { user, isLeadership } = await requireChapterManager(data.chapterId);

  const task = await prisma.launchTask.findUnique({
    where: { id: data.launchTaskId },
    select: { id: true, chapterId: true, metadata: true },
  });
  if (!task || task.chapterId !== data.chapterId) {
    throw new Error("Checklist item not found");
  }
  const meta = readChecklistMeta(task.metadata);
  const leadershipOnly = meta.key === "approve_launch_plan" || meta.key === "mark_active";
  if (leadershipOnly && !isLeadership) {
    throw new Error("Only national leadership can complete this step");
  }

  await prisma.$transaction(async (tx) => {
    await tx.launchTask.update({
      where: { id: task.id },
      data: { status: data.done ? "COMPLETE" : "NOT_STARTED" },
    });
    if (meta.actionItemId) {
      if (data.done) await completeChapterActionItem(tx, meta.actionItemId);
      else await reopenChapterActionItem(tx, meta.actionItemId);
    }
    if (meta.key === "submit_launch_plan") {
      await tx.chapter.update({
        where: { id: data.chapterId },
        data: { launchPlanSubmittedAt: data.done ? new Date() : null },
      });
    }
    if (meta.key === "approve_launch_plan") {
      await tx.chapter.update({
        where: { id: data.chapterId },
        data: {
          launchPlanApprovedAt: data.done ? new Date() : null,
          launchPlanApprovedById: data.done ? user.id : null,
        },
      });
    }
    if (meta.key === "mark_active" && data.done) {
      await tx.chapter.update({
        where: { id: data.chapterId },
        data: { lifecycleStatus: "ACTIVE", launchedAt: new Date(), lifecycleUpdatedAt: new Date() },
      });
    }
  });

  revalidateChapterSurfaces(data.chapterId);
  return { ok: true as const };
}

const LaunchPlanSchema = z.object({
  chapterId: z.string().min(1),
  launchPlanText: z.string().min(1).max(20000),
});

export async function submitLaunchPlan(input: unknown) {
  const data = LaunchPlanSchema.parse(input);
  await requireChapterManager(data.chapterId);
  await prisma.$transaction(async (tx) => {
    await tx.chapter.update({
      where: { id: data.chapterId },
      data: { launchPlanText: data.launchPlanText, launchPlanSubmittedAt: new Date() },
    });
    await markChecklistByKey(tx, data.chapterId, "submit_launch_plan", true);
  });
  revalidateChapterSurfaces(data.chapterId);
  return { ok: true as const };
}

export async function approveLaunchPlan(input: unknown) {
  const data = z.object({ chapterId: z.string().min(1) }).parse(input);
  const user = await requireChapterLeadership();
  await prisma.$transaction(async (tx) => {
    await tx.chapter.update({
      where: { id: data.chapterId },
      data: { launchPlanApprovedAt: new Date(), launchPlanApprovedById: user.id },
    });
    await markChecklistByKey(tx, data.chapterId, "approve_launch_plan", true);
  });
  revalidateChapterSurfaces(data.chapterId);
  return { ok: true as const };
}

export async function markChapterActive(input: unknown) {
  const data = z.object({ chapterId: z.string().min(1) }).parse(input);
  await requireChapterLeadership();
  await prisma.$transaction(async (tx) => {
    await tx.chapter.update({
      where: { id: data.chapterId },
      data: { lifecycleStatus: "ACTIVE", launchedAt: new Date(), lifecycleUpdatedAt: new Date() },
    });
    await markChecklistByKey(tx, data.chapterId, "mark_active", true);
  });
  revalidateChapterSurfaces(data.chapterId);
  return { ok: true as const };
}

// --- Support requests --------------------------------------------------------

const SupportRequestSchema = z.object({
  chapterId: z.string().min(1),
  category: z.enum([
    "CURRICULUM",
    "INSTRUCTOR",
    "PARTNER",
    "RECRUITMENT",
    "EVENT_PLANNING",
    "SCHOOL_APPROVAL",
    "GENERAL",
  ]),
  title: z.string().min(3).max(160),
  details: z.string().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

export async function createChapterSupportRequest(input: unknown) {
  const data = SupportRequestSchema.parse(input);
  const { user } = await requireChapterManager(data.chapterId);

  const created = await prisma.$transaction(async (tx) => {
    const action = await createChapterActionItem(tx, {
      chapterId: data.chapterId,
      title: `Support: ${SUPPORT_CATEGORY_LABELS[data.category]} — ${data.title}`,
      description: data.details ?? null,
      leadId: user.id,
      createdById: user.id,
      deadlineStart: new Date(Date.now() + 5 * DAY_MS),
      priority: data.priority ?? "MEDIUM",
      visibility: "ALL_LEADERSHIP",
      goalCategory: "Chapter support",
    });
    return tx.chapterSupportRequest.create({
      data: {
        chapterId: data.chapterId,
        requestedById: user.id,
        category: data.category,
        title: data.title,
        details: data.details ?? null,
        priority: data.priority ?? "MEDIUM",
        actionItemId: action.id,
      },
      select: { id: true },
    });
  });

  revalidateChapterSurfaces(data.chapterId);
  revalidatePath("/actions");
  return { ok: true as const, id: created.id };
}

const ResolveSupportSchema = z.object({
  requestId: z.string().min(1),
  resolutionNote: z.string().max(4000).optional(),
});

export async function resolveChapterSupportRequest(input: unknown) {
  const data = ResolveSupportSchema.parse(input);
  const user = await requireChapterLeadership();
  const request = await prisma.chapterSupportRequest.findUnique({
    where: { id: data.requestId },
    select: { id: true, chapterId: true, actionItemId: true },
  });
  if (!request) throw new Error("Support request not found");

  await prisma.$transaction(async (tx) => {
    await tx.chapterSupportRequest.update({
      where: { id: request.id },
      data: {
        status: "RESOLVED",
        resolutionNote: data.resolutionNote?.trim() || null,
        resolvedAt: new Date(),
        resolvedById: user.id,
      },
    });
    if (request.actionItemId) await completeChapterActionItem(tx, request.actionItemId);
  });

  revalidateChapterSurfaces(request.chapterId);
  return { ok: true as const };
}

const AssignSupportSchema = z.object({
  requestId: z.string().min(1),
  assignedToId: z.string().min(1).nullable(),
});

export async function assignChapterSupportRequest(input: unknown) {
  const data = AssignSupportSchema.parse(input);
  await requireChapterLeadership();
  const request = await prisma.chapterSupportRequest.update({
    where: { id: data.requestId },
    data: {
      assignedToId: data.assignedToId,
      status: data.assignedToId ? "IN_PROGRESS" : "OPEN",
    },
    select: { chapterId: true },
  });
  revalidateChapterSurfaces(request.chapterId);
  return { ok: true as const };
}

// --- Chapter notes (leadership) ---------------------------------------------

const ChapterNoteSchema = z.object({
  chapterId: z.string().min(1),
  body: z.string().min(1).max(8000),
  audience: z.enum(["LEADERSHIP", "CHAPTER"]).optional(),
  aboutUserId: z.string().min(1).nullable().optional(),
  pinned: z.boolean().optional(),
});

export async function addChapterNote(input: unknown) {
  const data = ChapterNoteSchema.parse(input);
  const user = await requireChapterLeadership();
  await prisma.chapterNote.create({
    data: {
      chapterId: data.chapterId,
      authorId: user.id,
      body: data.body,
      audience: data.audience ?? "LEADERSHIP",
      aboutUserId: data.aboutUserId ?? null,
      pinned: data.pinned ?? false,
    },
  });
  revalidateChapterSurfaces(data.chapterId);
  return { ok: true as const };
}

// --- Chapter meetings (reuse the existing Meeting runner) --------------------

const ChapterMeetingSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().min(1).max(300),
  scheduledAt: z.string().min(1),
  purpose: z.string().max(20000).optional(),
});

export async function scheduleChapterMeeting(input: unknown) {
  const data = ChapterMeetingSchema.parse(input);
  const { user } = await requireChapterManager(data.chapterId);
  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid date/time");

  const chapter = await prisma.chapter.findUnique({
    where: { id: data.chapterId },
    select: { presidentId: true },
  });
  const facilitatorId = chapter?.presidentId ?? user.id;

  const meeting = await prisma.meeting.create({
    data: {
      type: "GENERIC",
      title: data.title,
      purpose: data.purpose ?? null,
      scheduledAt,
      chapterId: data.chapterId,
      facilitatorId,
      createdById: user.id,
    },
    select: { id: true },
  });

  revalidateChapterSurfaces(data.chapterId);
  revalidatePath("/meetings");
  return { ok: true as const, id: meeting.id };
}

// --- Chapter check-in --------------------------------------------------------
// A lightweight check-in, not a health dashboard. It captures what happened /
// what's next / what's blocked, optionally moves the chapter's lifecycle, and —
// crucially — turns blockers and asks into real chapter actions. The narrative
// is stored as a chapter note so it shows in the existing notes timeline. One
// check-in flows into notes + actions + lifecycle; no new silo.

const CHECK_IN_STATUS = ["ACTIVE", "NEEDS_SUPPORT", "AT_RISK", "PAUSED"] as const;

const ChapterCheckInSchema = z.object({
  chapterId: z.string().min(1),
  since: z.string().max(20000).optional(),
  planned: z.string().max(20000).optional(),
  blocked: z.string().max(20000).optional(),
  needsHelp: z.string().max(20000).optional(),
  status: z.enum(CHECK_IN_STATUS).optional(),
  /** Turn the blocker / "needs help" lines into tracked chapter actions. */
  createActions: z.boolean().optional(),
  audience: z.enum(["LEADERSHIP", "CHAPTER"]).optional(),
});

function trimToNull(value: string | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export async function submitChapterCheckIn(input: unknown) {
  const data = ChapterCheckInSchema.parse(input);
  const { user, isLeadership } = await requireChapterManager(data.chapterId);

  const since = trimToNull(data.since);
  const planned = trimToNull(data.planned);
  const blocked = trimToNull(data.blocked);
  const needsHelp = trimToNull(data.needsHelp);

  if (!since && !planned && !blocked && !needsHelp && !data.status) {
    throw new Error("Add at least one note or a status before submitting a check-in.");
  }

  // Compose the durable narrative for the chapter notes timeline.
  const sections: string[] = ["Chapter check-in"];
  if (since) sections.push(`Since last check-in:\n${since}`);
  if (planned) sections.push(`Planned next:\n${planned}`);
  if (blocked) sections.push(`Blocked:\n${blocked}`);
  if (needsHelp) sections.push(`Needs help:\n${needsHelp}`);
  const body = sections.join("\n\n");

  const chapter = await prisma.chapter.findUnique({
    where: { id: data.chapterId },
    select: { presidentId: true, lifecycleStatus: true },
  });
  const leadId = chapter?.presidentId ?? user.id;
  const createdActionIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.chapterNote.create({
      data: {
        chapterId: data.chapterId,
        authorId: user.id,
        body,
        // Default to a CP-visible note unless an explicit leadership-only audience.
        audience: data.audience ?? "CHAPTER",
      },
    });

    // A lifecycle move is the honest "active / needs support / at risk / paused"
    // signal — only leadership may change it; a CP self-check-in records it as a
    // note ask instead of silently flipping the official status.
    if (data.status && isLeadership && data.status !== chapter?.lifecycleStatus) {
      if (isValidChapterLifecycleStatus(data.status)) {
        await tx.chapter.update({
          where: { id: data.chapterId },
          data: {
            lifecycleStatus: data.status as ChapterLifecycleStatus,
            lifecycleNote: "Set via chapter check-in",
            lifecycleUpdatedAt: new Date(),
          },
        });
      }
    }

    if (data.createActions) {
      const deadlineStart = new Date(Date.now() + 7 * DAY_MS);
      if (blocked) {
        const created = await createChapterActionItem(tx, {
          chapterId: data.chapterId,
          title: `Resolve blocker: ${firstLine(blocked)}`,
          description: blocked,
          leadId,
          createdById: user.id,
          deadlineStart,
          priority: "HIGH",
          goalCategory: "Chapter check-in",
        });
        createdActionIds.push(created.id);
      }
      if (needsHelp) {
        const created = await createChapterActionItem(tx, {
          chapterId: data.chapterId,
          title: `Follow up: ${firstLine(needsHelp)}`,
          description: needsHelp,
          leadId,
          createdById: user.id,
          deadlineStart,
          priority: "MEDIUM",
          goalCategory: "Chapter check-in",
        });
        createdActionIds.push(created.id);
      }
    }
  });

  revalidateChapterSurfaces(data.chapterId);
  revalidatePath("/actions");
  return { ok: true as const, createdActionIds };
}

function firstLine(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? text.trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

// --- Turn a chapter meeting follow-up into a tracked chapter action ----------

const FollowUpActionSchema = z.object({
  followUpId: z.string().min(1),
  /** Optional explicit owner; defaults to the follow-up owner / CP / facilitator. */
  leadId: z.string().min(1).optional(),
});

export async function createActionFromMeetingFollowUp(input: unknown) {
  const data = FollowUpActionSchema.parse(input);

  const followUp = await prisma.meetingFollowUp.findUnique({
    where: { id: data.followUpId },
    select: {
      id: true,
      title: true,
      detail: true,
      dueDate: true,
      ownerId: true,
      meeting: {
        select: { id: true, chapterId: true, facilitatorId: true },
      },
    },
  });
  if (!followUp) throw new Error("Follow-up not found");
  const chapterId = followUp.meeting.chapterId;
  if (!chapterId) throw new Error("This follow-up is not on a chapter meeting");

  const { user } = await requireChapterManager(chapterId);

  // Don't create a second action for a follow-up that already has one.
  const existing = await prisma.actionItem.findFirst({
    where: { sourceType: "MEETING_FOLLOW_UP", sourceId: followUp.id },
    select: { id: true },
  });
  if (existing) return { ok: true as const, id: existing.id, existing: true as const };

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { presidentId: true },
  });

  const leadId =
    data.leadId ??
    followUp.ownerId ??
    chapter?.presidentId ??
    followUp.meeting.facilitatorId ??
    user.id;

  const deadlineStart = followUp.dueDate ?? new Date(Date.now() + 7 * DAY_MS);

  const created = await createChapterActionFromMeetingFollowUp(prisma, {
    chapterId,
    meetingId: followUp.meeting.id,
    followUpId: followUp.id,
    title: followUp.title,
    description: followUp.detail,
    leadId,
    createdById: user.id,
    deadlineStart,
  });

  revalidateChapterSurfaces(chapterId);
  revalidatePath(`/meetings/${followUp.meeting.id}`);
  revalidatePath("/actions");
  return { ok: true as const, id: created.id };
}

// --- Create a chapter straight from an application (leadership) ---------------

async function ensureUniqueChapterSlug(baseSlug: string): Promise<string> {
  const cleaned = slugifyChapterName(baseSlug) || "chapter";
  let candidate = cleaned;
  let suffix = 2;
  // Bounded loop; chapter counts are small.
  while (await prisma.chapter.findFirst({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${cleaned}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createChapterFromApplication(input: unknown) {
  const data = z.object({ applicationId: z.string().min(1) }).parse(input);
  await requireChapterLeadership();

  const app = await prisma.chapterPresidentApplication.findUnique({
    where: { id: data.applicationId },
    select: {
      id: true,
      chapterId: true,
      city: true,
      stateProvince: true,
      partnerSchool: true,
      schoolName: true,
      potentialChapterLocation: true,
      launchPlan: true,
    },
  });
  if (!app) throw new Error("Application not found");
  if (app.chapterId) {
    return { ok: true as const, id: app.chapterId, existing: true as const };
  }

  const locationName =
    app.partnerSchool ||
    app.schoolName ||
    app.potentialChapterLocation ||
    [app.city, app.stateProvince].filter(Boolean).join(", ") ||
    "New";
  const name = `${locationName} Chapter`.slice(0, 80);

  const chapter = await prisma.chapter.create({
    data: {
      name,
      slug: await ensureUniqueChapterSlug(name),
      city: app.city,
      state: app.stateProvince,
      region: app.stateProvince,
      partnerSchool: app.partnerSchool || app.schoolName || null,
      launchPlanText: app.launchPlan,
      lifecycleStatus: "PROSPECT",
      isPublic: false,
    },
    select: { id: true },
  });

  await prisma.chapterPresidentApplication.update({
    where: { id: app.id },
    data: { chapterId: chapter.id },
  });

  revalidateChapterSurfaces(chapter.id);
  revalidatePath(`/admin/chapter-president-applicants/${app.id}`);
  return { ok: true as const, id: chapter.id };
}
