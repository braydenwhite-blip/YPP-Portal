"use server";

/**
 * Server actions for the manual email guidance / tracking system.
 *
 * The portal never auto-sends these emails — this module exists so admins
 * can see "what email should be sent" + "mark it sent / not needed / handled
 * externally" alongside the existing review workflow.
 *
 * Used by:
 *   - ManualEmailGuidancePanel  (applicant cockpit)
 *   - ApplicantNextActionBar    (next-step hints)
 *   - lib/external-applicant-intake.ts (default seeding on intake)
 */

import { revalidatePath } from "next/cache";
import { ManualEmailKind, ManualEmailStatus } from "@prisma/client";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { buildManualEmailTemplate } from "@/lib/application-source-config";

// ─── Permissions ─────────────────────────────────────────────────────────────

async function requireAdminOrChapterLead() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT") && !roles.includes("HIRING_CHAIR")) {
    throw new Error("Unauthorized - Admin, Hiring Chair, or Chapter President access required");
  }
  return session;
}

// ─── Read API ────────────────────────────────────────────────────────────────

export interface ManualEmailTaskDTO {
  id: string;
  kind: ManualEmailKind;
  status: ManualEmailStatus;
  suggestedSubject: string | null;
  suggestedBody: string | null;
  notes: string | null;
  markedSentAt: string | null;
  markedSentBy: { id: string; name: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Load all manual email tasks for an instructor application, oldest first.
 * Returns a serialized DTO so the result can be passed directly into a
 * client component without `toISOString`-ing each row.
 */
export async function listManualEmailTasksForInstructorApplication(
  applicationId: string,
): Promise<ManualEmailTaskDTO[]> {
  const tasks = await prisma.manualEmailTask.findMany({
    where: { instructorApplicationId: applicationId },
    include: {
      markedSentBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return tasks.map((task) => ({
    id: task.id,
    kind: task.kind,
    status: task.status,
    suggestedSubject: task.suggestedSubject,
    suggestedBody: task.suggestedBody,
    notes: task.notes,
    markedSentAt: task.markedSentAt?.toISOString() ?? null,
    markedSentBy: task.markedSentBy
      ? { id: task.markedSentBy.id, name: task.markedSentBy.name }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }));
}

// ─── Mutation API ────────────────────────────────────────────────────────────

interface AddTaskInput {
  applicationId: string;
  kind: ManualEmailKind;
  suggestedSubject?: string | null;
  suggestedBody?: string | null;
  notes?: string | null;
}

/**
 * Add a new manual email task to an instructor application. If
 * `suggestedSubject` / `suggestedBody` are omitted, the default template
 * for the requested kind is rendered automatically.
 */
export async function addManualEmailTaskForInstructorApplication(
  input: AddTaskInput,
): Promise<{ id: string }> {
  const session = await requireAdminOrChapterLead();

  const application = await prisma.instructorApplication.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      applicationTrack: true,
      applicant: { select: { name: true } },
    },
  });
  if (!application) throw new Error("Application not found");

  let suggestedSubject = input.suggestedSubject?.trim() || null;
  let suggestedBody = input.suggestedBody?.trim() || null;
  if (!suggestedSubject || !suggestedBody) {
    const template = buildManualEmailTemplate(input.kind, {
      applicantName: application.applicant.name,
      applicationLabel:
        application.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR"
          ? "Summer Workshop Instructor"
          : "Instructor",
    });
    suggestedSubject = suggestedSubject ?? template.subject;
    suggestedBody = suggestedBody ?? template.body;
  }

  const created = await prisma.manualEmailTask.create({
    data: {
      instructorApplicationId: input.applicationId,
      kind: input.kind,
      suggestedSubject,
      suggestedBody,
      notes: input.notes?.trim() || null,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath(`/applications/instructor/${input.applicationId}`);
  return created;
}

interface UpdateStatusInput {
  taskId: string;
  status: ManualEmailStatus;
  notes?: string | null;
}

/**
 * Transition a manual email task to SENT / NOT_NEEDED / HANDLED_EXTERNALLY /
 * PENDING. Records `markedSentAt` + `markedSentById` only on the SENT
 * transition; resetting to PENDING clears those audit fields.
 */
export async function updateManualEmailTaskStatus(
  input: UpdateStatusInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAdminOrChapterLead();

    const task = await prisma.manualEmailTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        instructorApplicationId: true,
        chapterPresidentApplicationId: true,
        genericApplicationId: true,
      },
    });
    if (!task) return { ok: false, error: "Manual email task not found" };

    const now = new Date();
    const isSentTransition = input.status === ManualEmailStatus.SENT;

    await prisma.manualEmailTask.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        notes: input.notes?.trim() ?? undefined,
        markedSentAt: isSentTransition ? now : input.status === ManualEmailStatus.PENDING ? null : undefined,
        markedSentById: isSentTransition ? session.user.id : input.status === ManualEmailStatus.PENDING ? null : undefined,
      },
    });

    if (task.instructorApplicationId) {
      revalidatePath(`/applications/instructor/${task.instructorApplicationId}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

interface UpdateNotesInput {
  taskId: string;
  notes: string | null;
}

export async function updateManualEmailTaskNotes(
  input: UpdateNotesInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdminOrChapterLead();
    const task = await prisma.manualEmailTask.findUnique({
      where: { id: input.taskId },
      select: { id: true, instructorApplicationId: true },
    });
    if (!task) return { ok: false, error: "Manual email task not found" };
    await prisma.manualEmailTask.update({
      where: { id: input.taskId },
      data: { notes: input.notes?.trim() || null },
    });
    if (task.instructorApplicationId) {
      revalidatePath(`/applications/instructor/${task.instructorApplicationId}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Delete a manual email task. Useful when an admin seeded one by mistake.
 * History (already-SENT tasks) is generally kept; this is escape-hatch only.
 */
export async function deleteManualEmailTask(
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdminOrChapterLead();
    const task = await prisma.manualEmailTask.findUnique({
      where: { id: taskId },
      select: { id: true, instructorApplicationId: true },
    });
    if (!task) return { ok: false, error: "Manual email task not found" };
    await prisma.manualEmailTask.delete({ where: { id: taskId } });
    if (task.instructorApplicationId) {
      revalidatePath(`/applications/instructor/${task.instructorApplicationId}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── FormData adapters ──────────────────────────────────────────────────────

export async function addManualEmailTaskFromForm(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const notes = String(formData.get("notes") ?? "") || null;
  if (!applicationId) return { ok: false as const, error: "applicationId is required" };
  if (!kind) return { ok: false as const, error: "kind is required" };
  try {
    const result = await addManualEmailTaskForInstructorApplication({
      applicationId,
      kind: kind as ManualEmailKind,
      notes,
    });
    return { ok: true as const, id: result.id };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateManualEmailTaskStatusFromForm(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  if (!taskId) return { ok: false as const, error: "taskId is required" };
  const status = statusRaw as ManualEmailStatus;
  return updateManualEmailTaskStatus({ taskId, status });
}
