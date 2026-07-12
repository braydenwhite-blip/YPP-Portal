import "server-only";

import type {
  RegularInstructorAssignmentRole,
  RegularInstructorAssignmentStatus,
} from "@prisma/client";

import { requireSessionUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { canManageClassAttendance } from "@/lib/classes/attendance";

export const ACCEPTED_TEACHING_ASSIGNMENT_STATUSES: RegularInstructorAssignmentStatus[] = [
  "INSTRUCTOR_CONFIRMED",
  "FULLY_CONFIRMED",
];

export const ACTIVE_TEACHING_ASSIGNMENT_ROLES: RegularInstructorAssignmentRole[] = [
  "LEAD",
  "CO_INSTRUCTOR",
  "ASSISTANT",
];

export class TeachingAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeachingAccessError";
  }
}

/**
 * One server-side authorization boundary for every modern class-session
 * mutation. A role alone is never enough: the viewer must lead the offering,
 * hold an accepted teaching assignment, or manage that offering's chapter.
 */
export async function requireTeachingSessionAccess(sessionId: string, offeringId: string) {
  const viewer = await requireSessionUser();
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      offeringId: true,
      date: true,
      startTime: true,
      endTime: true,
      isCancelled: true,
      offering: {
        select: {
          id: true,
          instructorId: true,
          chapterId: true,
          title: true,
          timezone: true,
          templateId: true,
        },
      },
    },
  });
  if (!classSession || classSession.offeringId !== offeringId) {
    throw new TeachingAccessError("Session not found for this class");
  }

  const [chapterContext, assignment] = await Promise.all([
    getChapterViewerContext(),
    prisma.regularInstructorAssignment.findFirst({
      where: {
        offeringId,
        instructorId: viewer.id,
        status: { in: ACCEPTED_TEACHING_ASSIGNMENT_STATUSES },
        role: { in: ACTIVE_TEACHING_ASSIGNMENT_ROLES },
      },
      select: { id: true, role: true },
    }),
  ]);

  const managesChapter =
    chapterContext.isLeadership ||
    (chapterContext.ledChapterId != null &&
      chapterContext.ledChapterId === classSession.offering.chapterId);
  const allowed = canManageClassAttendance(
    { id: viewer.id, roles: viewer.roles },
    {
      instructorId: classSession.offering.instructorId,
      chapterId: classSession.offering.chapterId,
    },
    {
      isConfirmedCoInstructor: assignment != null,
      managesChapter,
    }
  );
  if (!allowed) throw new TeachingAccessError("You do not have access to this class session");

  return { viewer, classSession, assignment, managesChapter };
}

/** Read boundary for one offering when no session has been selected yet. */
export async function canTeachOffering(viewerId: string, offeringId: string) {
  const offering = await prisma.classOffering.findFirst({
    where: {
      id: offeringId,
      OR: [
        { instructorId: viewerId },
        {
          regularInstructorAssignments: {
            some: {
              instructorId: viewerId,
              status: { in: ACCEPTED_TEACHING_ASSIGNMENT_STATUSES },
              role: { in: ACTIVE_TEACHING_ASSIGNMENT_ROLES },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return offering != null;
}

