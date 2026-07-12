"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { canTeachOffering } from "@/lib/classes/instructor-access";

const CompleteInstructorRequestSchema = z.object({
  actionId: z.string().trim().min(1),
  note: z.string().trim().min(3).max(4000),
});

export async function completeAssignedInstructorRequest(input: unknown) {
  const parsed = CompleteInstructorRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Add a completion note" };
  }

  let viewer;
  try {
    viewer = await requireSessionUser();
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }

  const action = await prisma.actionItem.findUnique({
    where: { id: parsed.data.actionId },
    select: {
      id: true,
      status: true,
      leadId: true,
      visibility: true,
      relatedEntityType: true,
      relatedEntityId: true,
      assignments: { select: { userId: true } },
    },
  });
  const assigned =
    action?.leadId === viewer.id || action?.assignments.some((assignment) => assignment.userId === viewer.id);
  if (
    !action ||
    !assigned ||
    !["NOT_STARTED", "IN_PROGRESS", "OVERDUE", "BLOCKED"].includes(action.status) ||
    action.visibility !== "ALL_LEADERSHIP" ||
    (action.relatedEntityType === "CLASS_OFFERING" && !action.relatedEntityId)
  ) {
    return { ok: false as const, error: "You do not have access to complete this request" };
  }
  if (
    action.relatedEntityType === "CLASS_OFFERING" &&
    action.relatedEntityId &&
    !(await canTeachOffering(viewer.id, action.relatedEntityId))
  ) {
    return { ok: false as const, error: "This request is not connected to a class you teach" };
  }

  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.actionItem.update({
        where: { id: action.id },
        data: {
          status: "COMPLETE",
          completedAt: now,
          completionNote: parsed.data.note,
        },
      }),
      prisma.actionComment.create({
        data: {
          actionItemId: action.id,
          authorId: viewer.id,
          type: "NOTE",
          body: `Completed from Instructor Home: ${parsed.data.note}`,
        },
      }),
    ]);
  } catch {
    return { ok: false as const, error: "Could not complete the YPP request" };
  }

  revalidatePath("/");
  revalidatePath("/instructor/classes");
  if (action.relatedEntityType === "CLASS_OFFERING" && action.relatedEntityId) {
    revalidatePath(`/instructor/classes/${action.relatedEntityId}`);
  }
  return { ok: true as const };
}
