"use server";

// Class Runtime OS (Phase 5) — attendance as a first-class workflow. The
// instructor opens a session, the roster appears, and the whole roll is
// submitted in ONE call (submitClassAttendance); single corrections go through
// updateClassAttendance. Both are permission-safe (admin / lead instructor /
// confirmed co-instructor / Chapter President of the offering's chapter),
// idempotent (upsert by session+student), and reject students who aren't
// enrolled. Recording attendance refreshes each student's sessionsAttended and
// feeds Student Community, retention, the class runtime, and Recent Activity.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  SubmitAttendanceSchema,
  UpdateAttendanceSchema,
} from "@/lib/classes/attendance";
import { requireTeachingSessionAccess } from "@/lib/classes/instructor-access";
import { sessionDateTime } from "@/lib/classes/instructor-state";

export type AttendanceResult = { ok: true; recorded: number } | { ok: false; error: string };

type AuthorizedSession = {
  viewerId: string;
  offeringId: string;
  enrolledIds: Set<string>;
};

/** Load + authorize a session for attendance, returning the active roster ids. */
async function authorizeAttendanceSession(
  sessionId: string,
  offeringId: string
): Promise<{ ok: true; ctx: AuthorizedSession } | { ok: false; error: string }> {
  const { viewer, classSession } = await requireTeachingSessionAccess(sessionId, offeringId);
  if (classSession.isCancelled) return { ok: false, error: "Attendance is not recorded for a cancelled session" };
  const startsAt = sessionDateTime(
    classSession.date,
    classSession.startTime,
    classSession.offering.timezone
  );
  if (Date.now() < startsAt.getTime()) {
    return { ok: false, error: "Attendance opens when the session starts" };
  }
  const rawEnd = sessionDateTime(
    classSession.date,
    classSession.endTime,
    classSession.offering.timezone
  );
  const endsAt = rawEnd.getTime() > startsAt.getTime()
    ? rawEnd
    : new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000);

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      offeringId,
      status: { not: "WAITLISTED" },
      enrolledAt: { lte: endsAt },
      OR: [{ droppedAt: null }, { droppedAt: { gt: startsAt } }],
    },
    select: { studentId: true },
  });

  return {
    ok: true,
    ctx: { viewerId: viewer.id, offeringId, enrolledIds: new Set(enrollments.map((e) => e.studentId)) },
  };
}

/** Recompute sessionsAttended (PRESENT count across the offering) for students. */
async function recomputeSessionsAttended(offeringId: string, studentIds: string[]): Promise<void> {
  await Promise.all(
    [...new Set(studentIds)].map(async (studentId) => {
      const attendedCount = await prisma.classAttendanceRecord.count({
        where: { studentId, status: "PRESENT", session: { offeringId } },
      });
      await prisma.classEnrollment.updateMany({
        where: { studentId, offeringId },
        data: { sessionsAttended: attendedCount },
      });
    })
  );
}

function revalidateAttendanceSurfaces(offeringId: string): void {
  revalidatePath(`/instructor/classes/${offeringId}`);
  revalidatePath(`/instructor/classes`);
  revalidatePath(`/curriculum/${offeringId}`);
  revalidatePath(`/admin/classes/${offeringId}`);
  revalidatePath("/chapter");
}

/** Submit the full roster for a session in one call. Idempotent. */
export async function submitClassAttendance(input: unknown): Promise<AttendanceResult> {
  const parsed = SubmitAttendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { offeringId, sessionId, marks } = parsed.data;

  let auth;
  try {
    auth = await authorizeAttendanceSession(sessionId, offeringId);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!auth.ok) return auth;

  const invalid = marks.filter((m) => !auth.ctx.enrolledIds.has(m.studentId));
  if (invalid.length > 0) {
    return { ok: false, error: "One or more students are not enrolled in this class" };
  }

  try {
    await prisma.$transaction(
      marks.map((m) =>
        prisma.classAttendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId, studentId: m.studentId } },
          create: { sessionId, studentId: m.studentId, status: m.status, notes: m.note?.trim() || null },
          update: {
            status: m.status,
            ...(m.note !== undefined ? { notes: m.note.trim() || null } : {}),
          },
        })
      )
    );
    await recomputeSessionsAttended(offeringId, marks.map((m) => m.studentId));
  } catch {
    return { ok: false, error: "Could not save attendance" };
  }

  revalidateAttendanceSurfaces(offeringId);
  return { ok: true, recorded: marks.length };
}

/** Correct a single student's attendance after submission. Idempotent. */
export async function updateClassAttendance(input: unknown): Promise<AttendanceResult> {
  const parsed = UpdateAttendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { offeringId, sessionId, studentId, status, note } = parsed.data;

  let auth;
  try {
    auth = await authorizeAttendanceSession(sessionId, offeringId);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!auth.ok) return auth;
  if (!auth.ctx.enrolledIds.has(studentId)) {
    return { ok: false, error: "That student is not enrolled in this class" };
  }

  try {
    await prisma.classAttendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: { sessionId, studentId, status, notes: note?.trim() || null },
      update: {
        status,
        ...(note !== undefined ? { notes: note.trim() || null } : {}),
      },
    });
    await recomputeSessionsAttended(offeringId, [studentId]);
  } catch {
    return { ok: false, error: "Could not update attendance" };
  }

  revalidateAttendanceSurfaces(offeringId);
  return { ok: true, recorded: 1 };
}
