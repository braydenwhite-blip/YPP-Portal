import "server-only";

import { prisma } from "@/lib/prisma";
import { instructorRequestedFollowUpSourceId } from "@/lib/classes/student-follow-up";

type RequestedFollowUpInput = {
  offeringId: string;
  sessionId: string;
  studentId: string;
  studentName: string | null;
  className: string;
  chapterId: string | null;
  instructorId: string;
  reason: string;
};

/**
 * One session/student pair produces one open follow-up record. Both the
 * during-class flag and the after-class recap call this helper, so entering the
 * same concern twice cannot create two tasks.
 */
export async function upsertInstructorRequestedStudentFollowUp(input: RequestedFollowUpInput) {
  const sourceId = instructorRequestedFollowUpSourceId(
    input.offeringId,
    input.sessionId,
    input.studentId
  );
  const existing = await prisma.actionItem.findFirst({
    where: { sourceId, leadId: input.instructorId },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status !== "COMPLETE") {
      await prisma.actionItem.update({
        where: { id: existing.id },
        data: { description: input.reason },
      });
    }
    return existing.id;
  }

  const created = await prisma.actionItem.create({
    data: {
      title: `Student follow-up: ${input.studentName ?? "Student"}`,
      description: input.reason,
      goalCategory: `Teaching · ${input.className}`,
      leadId: input.instructorId,
      createdById: input.instructorId,
      status: "NOT_STARTED",
      priority: "MEDIUM",
      visibility: "ALL_LEADERSHIP",
      deadlineStart: new Date(),
      chapterId: input.chapterId,
      sourceType: "FOLLOW_UP",
      sourceId,
      relatedEntityType: "USER",
      relatedEntityId: input.studentId,
      assignments: {
        create: [
          { userId: input.instructorId, role: "LEAD" },
          { userId: input.instructorId, role: "EXECUTING" },
        ],
      },
    },
    select: { id: true },
  });
  return created.id;
}
