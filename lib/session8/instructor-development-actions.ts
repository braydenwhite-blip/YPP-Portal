"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { ONBOARDING_STEPS } from "@/lib/session8/instructor-development";
import { SUPPORT_CATEGORIES } from "@/lib/session8/instructor-development-shared";

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

const SaveAvailabilitySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    available: z.boolean(),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1439),
    note: z.string().max(500).optional(),
  })
  .refine((v) => !v.available || v.startMinute < v.endMinute, {
    message: "Start time must be before end time.",
    path: ["endMinute"],
  });

/**
 * Saves one weekday's availability window. Upserts by userId+weekday so the
 * form can submit a single day at a time (one row per weekday, always
 * present with an explicit `available` flag — see schema doc comment).
 * Does NOT reassign or touch any existing class assignment; the page copy
 * makes this explicit.
 */
export async function saveInstructorAvailability(formData: FormData) {
  const user = await requireSessionUser();
  const input = SaveAvailabilitySchema.parse({
    weekday: Number(formData.get("weekday")),
    available: formData.get("available") === "on",
    startMinute: Number(formData.get("startMinute") ?? 0),
    endMinute: Number(formData.get("endMinute") ?? 0),
    note: String(formData.get("note") ?? "").slice(0, 500) || undefined,
  });

  await prisma.instructorAvailability.upsert({
    where: { userId_weekday: { userId: user.id, weekday: input.weekday } },
    create: {
      userId: user.id,
      weekday: input.weekday,
      available: input.available,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      note: input.note ?? null,
    },
    update: {
      available: input.available,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      note: input.note ?? null,
    },
  });

  // Availability rows existing at all is the derived onboarding signal, but
  // record a self-attest-style completion timestamp too so the onboarding
  // page can show an accurate "set on" date even though the step is derived.
  await prisma.instructorOnboardingTask.upsert({
    where: { userId_stepKey: { userId: user.id, stepKey: "availability-set" } },
    create: { userId: user.id, stepKey: "availability-set", completedAt: new Date() },
    update: { completedAt: new Date() },
  });

  revalidatePath("/instructor/availability");
  revalidatePath("/instructor/onboarding");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

const ONBOARDING_STEP_KEYS = ONBOARDING_STEPS.map((s) => s.key) as [string, ...string[]];

const StepKeySchema = z.object({
  stepKey: z.enum(ONBOARDING_STEP_KEYS),
  note: z.string().max(500).optional(),
});

/** Self-attest completion for a code-defined onboarding step. */
export async function completeOnboardingStep(formData: FormData) {
  const user = await requireSessionUser();
  const input = StepKeySchema.parse({
    stepKey: String(formData.get("stepKey") ?? ""),
    note: String(formData.get("note") ?? "").slice(0, 500) || undefined,
  });
  const def = ONBOARDING_STEPS.find((s) => s.key === input.stepKey);
  if (!def || def.kind !== "self-attest") {
    throw new Error("This step cannot be self-attested.");
  }

  await prisma.instructorOnboardingTask.upsert({
    where: { userId_stepKey: { userId: user.id, stepKey: input.stepKey } },
    create: { userId: user.id, stepKey: input.stepKey, completedAt: new Date(), note: input.note ?? null },
    update: { completedAt: new Date(), note: input.note ?? null },
  });

  revalidatePath("/instructor/onboarding");
  return { ok: true };
}

/** Undo a self-attested onboarding step. */
export async function undoOnboardingStep(formData: FormData) {
  const user = await requireSessionUser();
  const input = StepKeySchema.pick({ stepKey: true }).parse({
    stepKey: String(formData.get("stepKey") ?? ""),
  });
  const def = ONBOARDING_STEPS.find((s) => s.key === input.stepKey);
  if (!def || def.kind !== "self-attest") {
    throw new Error("This step cannot be self-attested.");
  }

  await prisma.instructorOnboardingTask.updateMany({
    where: { userId: user.id, stepKey: input.stepKey },
    data: { completedAt: null },
  });

  revalidatePath("/instructor/onboarding");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

const SUPPORT_CATEGORY_KEYS = SUPPORT_CATEGORIES as unknown as [string, ...string[]];

const RequestSupportSchema = z.object({
  category: z.enum(SUPPORT_CATEGORY_KEYS),
  description: z.string().min(1).max(2000),
});

/**
 * Creates an ActionItem for an instructor support request. Ownership
 * routing: the instructor's chapter president (`Chapter.presidentId`) when
 * one is resolvable, else the instructor themself — there is no dedicated
 * support-request routing table for instructors, and ActionItem.leadId is
 * required, so this picks the closest real accountable owner rather than
 * inventing a queue.
 */
export async function requestInstructorSupport(formData: FormData) {
  const user = await requireSessionUser();
  const input = RequestSupportSchema.parse({
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? "").slice(0, 2000),
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { chapterId: true },
  });
  let leadId = user.id;
  if (dbUser?.chapterId) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: dbUser.chapterId },
      select: { presidentId: true },
    });
    if (chapter?.presidentId) leadId = chapter.presidentId;
  }

  const titleBody = input.description.slice(0, 80);
  await prisma.actionItem.create({
    data: {
      title: `[Instructor support] ${input.category}: ${titleBody}`,
      description: input.description,
      actionType: "INSTRUCTOR_SUPPORT",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      deadlineStart: new Date(),
      leadId,
      createdById: user.id,
      sourceType: "MANUAL",
    },
  });

  revalidatePath("/instructor/support");
  return { ok: true };
}
