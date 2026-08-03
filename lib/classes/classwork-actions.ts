"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { requireInstructorAssigned, type Session4Actor } from "@/lib/operational-permissions";

const CreateClassworkSchema = z.object({
  offeringId: z.string().min(1),
  kind: z.enum(["assignment", "material", "question", "note"]),
  title: z.string().min(1).max(200),
  body: z.string().max(8000).optional(),
  linkUrl: z.string().max(2000).optional(),
  dueAtLocal: z.string().optional(),
  sessionId: z.string().optional(),
});

const KIND_TO_TYPE = {
  assignment: "PROJECT",
  material: "EXPLORATION",
  question: "REFLECTION",
  note: "PRACTICE",
} as const;

async function actorFor(user: { id: string; roles: string[] }): Promise<Session4Actor> {
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { chapterId: true },
  });
  return {
    userId: user.id,
    roles: user.roles,
    chapterIds: full?.chapterId ? [full.chapterId] : [],
  };
}

/**
 * Freeform classwork create — assignment, material, question, or note.
 * Stored as ClassAssignment so students can submit against assignments/questions.
 */
export async function createClassworkItem(formData: FormData) {
  const user = await requireSessionUser();
  const input = CreateClassworkSchema.parse({
    offeringId: String(formData.get("offeringId") ?? ""),
    kind: String(formData.get("kind") ?? "assignment"),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? "") || undefined,
    linkUrl: String(formData.get("linkUrl") ?? "") || undefined,
    dueAtLocal: String(formData.get("dueAtLocal") ?? "") || undefined,
    sessionId: String(formData.get("sessionId") ?? "") || undefined,
  });

  const actor = await actorFor(user);
  await requireInstructorAssigned(actor, input.offeringId);

  const dueAt = input.dueAtLocal ? new Date(input.dueAtLocal) : null;
  const description =
    input.body?.trim() ||
    (input.kind === "material"
      ? "Class material"
      : input.kind === "note"
        ? "Class note"
        : "Classwork");

  const row = await prisma.classAssignment.create({
    data: {
      offeringId: input.offeringId,
      createdById: user.id,
      title: input.title.trim(),
      description,
      type: KIND_TO_TYPE[input.kind],
      feedbackStyle: input.kind === "question" ? "NARRATIVE" : "NARRATIVE",
      gradingStyle: input.kind === "assignment" ? "FEEDBACK_ONLY" : "COMPLETION",
      instructions: input.body?.trim() || null,
      attachmentUrl: input.linkUrl?.trim() || null,
      referenceLinks: input.linkUrl?.trim() ? [input.linkUrl.trim()] : [],
      suggestedDueDate: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      sessionId: input.sessionId || null,
      isPublished: true,
      encouragementNote:
        input.kind === "note"
          ? "Instructor note for the class"
          : null,
    },
  });

  revalidatePath(`/instructor/classes/${input.offeringId}`);
  revalidatePath(`/instructor/classes/${input.offeringId}`, "page");
  revalidatePath(`/curriculum/${input.offeringId}/assignments`);

  return { ok: true as const, id: row.id, kind: input.kind };
}
