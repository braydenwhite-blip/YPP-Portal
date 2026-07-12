import { z } from "zod";

export const INSTRUCTOR_FOLLOW_UP_SOURCE_PREFIX = "instructor-student-follow-up:";
export const INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX = "instructor-requested-student-follow-up:";

export function instructorFollowUpSourceId(attentionKey: string) {
  return `${INSTRUCTOR_FOLLOW_UP_SOURCE_PREFIX}${attentionKey}`.slice(0, 300);
}

export function instructorRequestedFollowUpSourceId(
  offeringId: string,
  sessionId: string,
  studentId: string
) {
  return `${INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX}${offeringId}:${sessionId}:${studentId}`.slice(0, 300);
}

export function parseInstructorRequestedFollowUpSourceId(sourceId: string | null) {
  if (!sourceId?.startsWith(INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX)) return null;
  const [offeringId, sessionId, studentId] = sourceId
    .slice(INSTRUCTOR_REQUESTED_FOLLOW_UP_SOURCE_PREFIX.length)
    .split(":");
  return offeringId && sessionId && studentId
    ? { offeringId, sessionId, studentId }
    : null;
}

export const FlagInstructorStudentFollowUpSchema = z.object({
  offeringId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(2000),
});

export const CompleteInstructorFollowUpSchema = z.object({
  offeringId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  actionId: z.string().trim().min(1).optional(),
  attentionKey: z.string().trim().min(1).max(260),
  reason: z.string().trim().min(1).max(2000),
  note: z.string().trim().min(3).max(4000),
});
