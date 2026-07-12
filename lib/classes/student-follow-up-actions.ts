"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { canTeachOffering } from "@/lib/classes/instructor-access";
import {
  CompleteInstructorFollowUpSchema,
  FlagInstructorStudentFollowUpSchema,
  INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX,
  instructorFollowUpSourceId,
} from "@/lib/classes/student-follow-up";
import { requireTeachingSessionAccess } from "@/lib/classes/instructor-access";
import { upsertInstructorRequestedStudentFollowUp } from "@/lib/classes/student-follow-up-records";

export type StudentFollowUpResult =
  | { ok: true }
  | { ok: false; error: string };

export async function flagInstructorStudentFollowUp(
  input: unknown
): Promise<StudentFollowUpResult> {
  const parsed = FlagInstructorStudentFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid follow-up" };
  }
  const data = parsed.data;

  let access;
  try {
    access = await requireTeachingSessionAccess(data.sessionId, data.offeringId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unauthorized" };
  }
  if (!(await canTeachOffering(access.viewer.id, data.offeringId))) {
    return { ok: false, error: "Only an assigned instructor can flag a student follow-up" };
  }

  const enrollment = await prisma.classEnrollment.findUnique({
    where: {
      studentId_offeringId: {
        studentId: data.studentId,
        offeringId: data.offeringId,
      },
    },
    select: { student: { select: { name: true } } },
  });
  if (!enrollment) {
    return { ok: false, error: "That student is not connected to this class" };
  }

  try {
    await upsertInstructorRequestedStudentFollowUp({
      offeringId: data.offeringId,
      sessionId: data.sessionId,
      studentId: data.studentId,
      studentName: enrollment.student.name,
      className: access.classSession.offering.title,
      chapterId: access.classSession.offering.chapterId,
      instructorId: access.viewer.id,
      reason: data.reason,
    });
  } catch {
    return { ok: false, error: "Could not flag the follow-up" };
  }

  revalidatePath("/");
  revalidatePath("/instructor/students");
  revalidatePath("/instructor/classes");
  revalidatePath(`/instructor/classes/${data.offeringId}`);
  return { ok: true };
}

export async function completeInstructorStudentFollowUp(
  input: unknown
): Promise<StudentFollowUpResult> {
  const parsed = CompleteInstructorFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid follow-up" };
  }
  const data = parsed.data;

  let viewer;
  try {
    viewer = await requireSessionUser();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!(await canTeachOffering(viewer.id, data.offeringId))) {
    return { ok: false, error: "You do not teach this class" };
  }

  const [offering, enrollment] = await Promise.all([
    prisma.classOffering.findUnique({
      where: { id: data.offeringId },
      select: { title: true, chapterId: true },
    }),
    prisma.classEnrollment.findUnique({
      where: {
        studentId_offeringId: {
          studentId: data.studentId,
          offeringId: data.offeringId,
        },
      },
      select: { student: { select: { name: true } } },
    }),
  ]);
  if (!offering || !enrollment) {
    return { ok: false, error: "That student is not connected to this class" };
  }

  const sourceId = instructorFollowUpSourceId(data.attentionKey);
  const now = new Date();
  const nextFollowUpAt = data.attentionKey.includes(":assignment:")
    ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  try {
    if (data.actionId) {
      const requested = await prisma.actionItem.findFirst({
        where: {
          id: data.actionId,
          leadId: viewer.id,
          relatedEntityType: "USER",
          relatedEntityId: data.studentId,
          sourceId: {
            startsWith: `${INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX}${data.offeringId}:`,
          },
        },
        select: { id: true },
      });
      if (!requested) return { ok: false, error: "That follow-up is not assigned to you" };
      await prisma.actionItem.update({
        where: { id: requested.id },
        data: {
          status: "COMPLETE",
          completedAt: now,
          completionNote: data.note,
        },
      });
      await prisma.actionComment.create({
        data: {
          actionItemId: requested.id,
          authorId: viewer.id,
          type: "NOTE",
          body: `Follow-up completed: ${data.note}`,
        },
      });
      revalidatePath("/");
      revalidatePath("/instructor/students");
      revalidatePath("/instructor/classes");
      revalidatePath(`/instructor/classes/${data.offeringId}`);
      return { ok: true };
    }
    const existing = await prisma.actionItem.findFirst({
      where: {
        sourceId,
        leadId: viewer.id,
        relatedEntityType: "USER",
        relatedEntityId: data.studentId,
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.actionItem.update({
        where: { id: existing.id },
        data: {
          status: "COMPLETE",
          completedAt: now,
          completionNote: data.note,
          description: data.reason,
          nextFollowUpAt,
        },
      });
    } else {
      await prisma.actionItem.create({
        data: {
          title: `Student follow-up: ${enrollment.student.name ?? "Student"}`,
          description: data.reason,
          goalCategory: `Teaching · ${offering.title}`,
          leadId: viewer.id,
          createdById: viewer.id,
          status: "COMPLETE",
          priority: "MEDIUM",
          visibility: "ALL_LEADERSHIP",
          deadlineStart: now,
          completedAt: now,
          completionNote: data.note,
          nextFollowUpAt,
          chapterId: offering.chapterId,
          sourceType: "FOLLOW_UP",
          sourceId,
          relatedEntityType: "USER",
          relatedEntityId: data.studentId,
          assignments: {
            create: [
              { userId: viewer.id, role: "LEAD" },
              { userId: viewer.id, role: "EXECUTING" },
            ],
          },
          comments: {
            create: {
              authorId: viewer.id,
              type: "NOTE",
              body: `Follow-up completed: ${data.note}`,
            },
          },
        },
      });
    }
  } catch {
    return { ok: false, error: "Could not record the follow-up" };
  }

  revalidatePath("/");
  revalidatePath("/instructor/students");
  revalidatePath("/instructor/classes");
  revalidatePath(`/instructor/classes/${data.offeringId}`);
  return { ok: true };
}
