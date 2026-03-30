"use server";

import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPassionLabBuilderSchema } from "@/lib/schema-compat";
import { assertCanPublishInstructorContent } from "@/lib/instructor-readiness";
import {
  type PassionLabBlueprint,
  normalizePassionLabBlueprint,
  normalizePassionLabSessionTopic,
} from "@/lib/instructor-builder-blueprints";

const PASSION_LAB_SCHEMA_MESSAGE =
  "Passion Lab Builder will be available after the latest passion lab database migration is applied to this deployment.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireInstructor() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (
    !session?.user?.id ||
    (!roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_PRESIDENT"))
  ) {
    throw new Error("Unauthorized – instructor role required");
  }
  return session;
}

async function requirePassionLabBuilderSchema() {
  if (!(await hasPassionLabBuilderSchema())) {
    throw new Error(PASSION_LAB_SCHEMA_MESSAGE);
  }
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getInt(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? fallback : n;
}

function parseLabBlueprint(formData: FormData): PassionLabBlueprint | null {
  const raw = getString(formData, "labBlueprint", false);
  if (!raw) return null;

  try {
    return normalizePassionLabBlueprint(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseSessionTopics(formData: FormData) {
  const raw = getString(formData, "sessionTopics", false);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((topic) => normalizePassionLabSessionTopic(topic));
  } catch {
    return [];
  }
}

// ─── Passion Lab CRUD ─────────────────────────────────────────────────────────

export async function createPassionLab(formData: FormData) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();

  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const interestArea = getString(formData, "interestArea");
  const drivingQuestion = getString(formData, "drivingQuestion", false);
  const targetAgeGroup = getString(formData, "targetAgeGroup", false);
  const difficulty = getString(formData, "difficulty", false);
  const deliveryModeRaw = getString(formData, "deliveryMode", false);
  const finalShowcase = getString(formData, "finalShowcase", false);
  const submissionFormat = getString(formData, "submissionFormat", false);
  const maxParticipants = getInt(formData, "maxParticipants", 25);
  const chapterId = getString(formData, "chapterId", false) || null;
  const labBlueprint = parseLabBlueprint(formData);
  const sessionTopics = parseSessionTopics(formData);

  const validDeliveryModes = ["IN_PERSON", "VIRTUAL", "HYBRID"];
  const deliveryMode = validDeliveryModes.includes(deliveryModeRaw)
    ? (deliveryModeRaw as "IN_PERSON" | "VIRTUAL" | "HYBRID")
    : undefined;

  const program = await prisma.specialProgram.create({
    data: {
      name,
      description: description || null,
      interestArea,
      type: "PASSION_LAB",
      isVirtual: deliveryMode ? deliveryMode !== "IN_PERSON" : true,
      isActive: false, // starts as draft
      leaderId: session.user.id,
      createdById: session.user.id,
      chapterId,
      submissionStatus: "DRAFT",
      drivingQuestion: drivingQuestion || null,
      targetAgeGroup: targetAgeGroup || null,
      difficulty: difficulty || null,
      deliveryMode: deliveryMode ?? null,
      finalShowcase: finalShowcase || null,
      ...(labBlueprint ? { labBlueprint: labBlueprint as Prisma.InputJsonValue } : {}),
      submissionFormat: submissionFormat || null,
      maxParticipants,
      sessionTopics,
    },
  });

  revalidatePath("/instructor/workspace");
  revalidatePath("/instructor/passion-lab-builder");
  return { success: true, programId: program.id };
}

export async function updatePassionLab(id: string, formData: FormData) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();

  const program = await prisma.specialProgram.findUnique({ where: { id } });
  if (!program) throw new Error("Passion Lab not found");
  if (
    program.createdById !== session.user.id &&
    !(session.user.roles ?? []).includes("ADMIN")
  ) {
    throw new Error("Not authorized to edit this Passion Lab");
  }

  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const interestArea = getString(formData, "interestArea");
  const drivingQuestion = getString(formData, "drivingQuestion", false);
  const targetAgeGroup = getString(formData, "targetAgeGroup", false);
  const difficulty = getString(formData, "difficulty", false);
  const deliveryModeRaw = getString(formData, "deliveryMode", false);
  const finalShowcase = getString(formData, "finalShowcase", false);
  const submissionFormat = getString(formData, "submissionFormat", false);
  const maxParticipants = getInt(formData, "maxParticipants", 25);
  const labBlueprint = parseLabBlueprint(formData);
  const sessionTopics = parseSessionTopics(formData);

  // Offering fields
  const startDateRaw = getString(formData, "startDate", false);
  const endDateRaw = getString(formData, "endDate", false);
  const locationName = getString(formData, "locationName", false);
  const locationAddress = getString(formData, "locationAddress", false);
  const zoomLink = getString(formData, "zoomLink", false);

  const validDeliveryModes = ["IN_PERSON", "VIRTUAL", "HYBRID"];
  const deliveryMode = validDeliveryModes.includes(deliveryModeRaw)
    ? (deliveryModeRaw as "IN_PERSON" | "VIRTUAL" | "HYBRID")
    : undefined;

  await prisma.specialProgram.update({
    where: { id },
    data: {
      name,
      description: description || null,
      interestArea,
      drivingQuestion: drivingQuestion || null,
      targetAgeGroup: targetAgeGroup || null,
      difficulty: difficulty || null,
      deliveryMode: deliveryMode ?? undefined,
      finalShowcase: finalShowcase || null,
      ...(labBlueprint ? { labBlueprint: labBlueprint as Prisma.InputJsonValue } : {}),
      submissionFormat: submissionFormat || null,
      maxParticipants,
      sessionTopics,
      startDate: startDateRaw ? new Date(startDateRaw) : undefined,
      endDate: endDateRaw ? new Date(endDateRaw) : undefined,
      isVirtual: deliveryMode ? deliveryMode !== "IN_PERSON" : undefined,
    },
  });

  revalidatePath("/instructor/passion-lab-builder");
  return { success: true };
}

export async function updatePassionLabOffering(id: string, formData: FormData) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();

  const program = await prisma.specialProgram.findUnique({ where: { id } });
  if (!program) throw new Error("Passion Lab not found");
  if (
    program.createdById !== session.user.id &&
    !(session.user.roles ?? []).includes("ADMIN")
  ) {
    throw new Error("Not authorized");
  }

  const startDateRaw = getString(formData, "startDate");
  const endDateRaw = getString(formData, "endDate");
  const maxParticipants = getInt(formData, "maxParticipants", 25);
  const locationName = getString(formData, "locationName", false);
  const locationAddress = getString(formData, "locationAddress", false);
  const zoomLink = getString(formData, "zoomLink", false);
  const deliveryModeRaw = getString(formData, "deliveryMode", false);

  const validDeliveryModes = ["IN_PERSON", "VIRTUAL", "HYBRID"];
  const deliveryMode = validDeliveryModes.includes(deliveryModeRaw)
    ? (deliveryModeRaw as "IN_PERSON" | "VIRTUAL" | "HYBRID")
    : undefined;

  await prisma.specialProgram.update({
    where: { id },
    data: {
      startDate: new Date(startDateRaw),
      endDate: new Date(endDateRaw),
      maxParticipants,
      deliveryMode: deliveryMode ?? undefined,
      isVirtual: deliveryMode ? deliveryMode !== "IN_PERSON" : undefined,
    },
  });

  // Create ProgramSession rows for each session in sessionTopics
  const existing = await prisma.programSession.count({ where: { programId: id } });
  if (existing === 0) {
    const sessionTopics = (program.sessionTopics as Array<{ topic?: string; scheduledAt?: string }>) ?? [];
    for (const topic of sessionTopics) {
      await prisma.programSession.create({
        data: {
          programId: id,
          title: topic.topic ?? "Session",
          scheduledAt: topic.scheduledAt ? new Date(topic.scheduledAt) : new Date(startDateRaw),
          duration: 60,
        },
      });
    }
  }

  revalidatePath("/instructor/passion-lab-builder");
  return { success: true };
}

export async function submitPassionLabForReview(id: string) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();

  const program = await prisma.specialProgram.findUnique({ where: { id } });
  if (!program) throw new Error("Passion Lab not found");
  if (
    program.createdById !== session.user.id &&
    !(session.user.roles ?? []).includes("ADMIN")
  ) {
    throw new Error("Not authorized");
  }

  await prisma.specialProgram.update({
    where: { id },
    data: { submissionStatus: "SUBMITTED" },
  });

  revalidatePath("/instructor/passion-lab-builder");
  return { success: true };
}

export async function publishPassionLab(id: string) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();
  const roles = session.user.roles ?? [];

  const program = await prisma.specialProgram.findUnique({ where: { id } });
  if (!program) throw new Error("Passion Lab not found");

  // Instructors can self-publish (consistent with how class offerings work);
  // admins can always publish
  if (
    program.createdById !== session.user.id &&
    !roles.includes("ADMIN")
  ) {
    throw new Error("Not authorized");
  }

  if (!program.startDate) {
    throw new Error("Please set offering dates before publishing");
  }

  await assertCanPublishInstructorContent(program.createdById ?? session.user.id);

  await prisma.specialProgram.update({
    where: { id },
    data: { isActive: true, submissionStatus: "APPROVED" },
  });

  revalidatePath("/instructor/passion-lab-builder");
  revalidatePath("/programs");
  return { success: true };
}

export async function addPassionLabSession(programId: string, formData: FormData) {
  await requireInstructor();
  await requirePassionLabBuilderSchema();

  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const scheduledAtRaw = getString(formData, "scheduledAt");
  const duration = getInt(formData, "duration", 60);
  const meetingLink = getString(formData, "meetingLink", false);

  const session = await prisma.programSession.create({
    data: {
      programId,
      title,
      description: description || null,
      scheduledAt: new Date(scheduledAtRaw),
      duration,
      meetingLink: meetingLink || null,
    },
  });

  revalidatePath("/instructor/passion-lab-builder");
  return { success: true, sessionId: session.id };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getInstructorPassionLabs() {
  const session = await requireInstructor();
  if (!(await hasPassionLabBuilderSchema())) {
    return [];
  }

  return prisma.specialProgram.findMany({
    where: {
      type: "PASSION_LAB",
      createdById: session.user.id,
    },
    include: {
      sessions: { orderBy: { scheduledAt: "asc" } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPassionLabById(id: string) {
  await requireInstructor();
  if (!(await hasPassionLabBuilderSchema())) {
    return null;
  }

  return prisma.specialProgram.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { scheduledAt: "asc" } },
      participants: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

// ─── Template & Clone ───────────────────────────────────────────────────────

export async function getPassionLabTemplates() {
  try {
    return await prisma.specialProgram.findMany({
      where: { type: "PASSION_LAB", isTemplate: true },
      select: {
        id: true,
        name: true,
        description: true,
        interestArea: true,
        difficulty: true,
        targetAgeGroup: true,
        templateCategory: true,
        sessionTopics: true,
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

export async function clonePassionLab(templateId: string) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();

  const template = await prisma.specialProgram.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new Error("Template not found");

  const clone = await prisma.specialProgram.create({
    data: {
      name: `${template.name} (Copy)`,
      description: template.description,
      interestArea: template.interestArea,
      type: "PASSION_LAB",
      isVirtual: template.isVirtual,
      isActive: false,
      leaderId: session.user.id,
      createdById: session.user.id,
      submissionStatus: "DRAFT",
      drivingQuestion: (template as Record<string, unknown>).drivingQuestion as string ?? null,
      targetAgeGroup: (template as Record<string, unknown>).targetAgeGroup as string ?? null,
      difficulty: (template as Record<string, unknown>).difficulty as string ?? null,
      deliveryMode: template.deliveryMode ?? null,
      finalShowcase: (template as Record<string, unknown>).finalShowcase as string ?? null,
      labBlueprint: (template as Record<string, unknown>).labBlueprint as Prisma.InputJsonValue ?? Prisma.JsonNull,
      submissionFormat: (template as Record<string, unknown>).submissionFormat as string ?? null,
      maxParticipants: template.maxParticipants,
      sessionTopics: template.sessionTopics ?? [],
    },
  });

  revalidatePath("/instructor/passion-lab-builder");
  return { success: true, programId: clone.id };
}

// ─── Review Actions ────────────────────────────────────────────────────────

export async function requestPassionLabRevision(id: string, notes: string) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Only admins and chapter presidents can request revisions");
  }

  await prisma.specialProgram.update({
    where: { id },
    data: {
      submissionStatus: "NEEDS_REVISION",
      reviewNotes: notes,
      reviewedById: session.user.id,
    },
  });

  revalidatePath("/instructor/passion-lab-builder");
  return { success: true };
}

export async function approvePassionLabReview(id: string) {
  const session = await requireInstructor();
  await requirePassionLabBuilderSchema();

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Only admins and chapter presidents can approve passion labs");
  }

  await prisma.specialProgram.update({
    where: { id },
    data: {
      submissionStatus: "APPROVED",
      reviewedById: session.user.id,
      reviewNotes: null,
    },
  });

  revalidatePath("/instructor/passion-lab-builder");
  return { success: true };
}

// Public query for fetching passion areas dropdown
export async function getActivePassionAreas() {
  return prisma.passionArea.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, category: true },
  });
}

// ─── Progress Tracking ──────────────────────────────────────────────────────

export async function getLabProgress(programId: string) {
  await requireInstructor();

  const records = await prisma.passionLabProgress.findMany({
    where: { programId },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ studentId: "asc" }, { sessionIndex: "asc" }],
  });

  return records.map((r) => ({
    id: r.id,
    programId: r.programId,
    studentId: r.studentId,
    studentName: r.student.name,
    studentEmail: r.student.email,
    sessionIndex: r.sessionIndex,
    status: r.status,
    artifactUrl: r.artifactUrl,
    artifactNotes: r.artifactNotes,
    instructorNotes: r.instructorNotes,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function updateStudentProgress(
  programId: string,
  studentId: string,
  sessionIndex: number,
  data: {
    status?: string;
    artifactUrl?: string;
    artifactNotes?: string;
    instructorNotes?: string;
  },
) {
  await requireInstructor();

  const validStatuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
  if (data.status && !validStatuses.includes(data.status)) {
    throw new Error("Invalid status value");
  }

  const record = await prisma.passionLabProgress.upsert({
    where: {
      programId_studentId_sessionIndex: { programId, studentId, sessionIndex },
    },
    update: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.artifactUrl !== undefined ? { artifactUrl: data.artifactUrl } : {}),
      ...(data.artifactNotes !== undefined ? { artifactNotes: data.artifactNotes } : {}),
      ...(data.instructorNotes !== undefined ? { instructorNotes: data.instructorNotes } : {}),
      ...(data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
    create: {
      programId,
      studentId,
      sessionIndex,
      status: data.status ?? "NOT_STARTED",
      artifactUrl: data.artifactUrl ?? null,
      artifactNotes: data.artifactNotes ?? null,
      instructorNotes: data.instructorNotes ?? null,
      ...(data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });

  revalidatePath("/instructor/passion-lab-builder/progress");
  return { success: true, id: record.id };
}

export async function markSessionComplete(
  programId: string,
  studentId: string,
  sessionIndex: number,
) {
  await requireInstructor();

  const record = await prisma.passionLabProgress.upsert({
    where: {
      programId_studentId_sessionIndex: { programId, studentId, sessionIndex },
    },
    update: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
    create: {
      programId,
      studentId,
      sessionIndex,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  revalidatePath("/instructor/passion-lab-builder/progress");
  return { success: true, id: record.id };
}
