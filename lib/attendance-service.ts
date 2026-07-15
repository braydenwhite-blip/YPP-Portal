import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { requireInstructorAssigned, canOverrideAttendanceFinalization, type Session4Actor } from "@/lib/operational-permissions";
import { activeEnrollmentStatuses } from "@/lib/operation-utils";

const attendanceStatuses = new Set(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);

export type AttendanceRecordInput = { studentId: string; status: string; notes?: string };

export type RecordAttendanceResult =
  | { ok: true; finalized: boolean }
  | { ok: false; error: "MISSING_STUDENTS"; missingStudents: { studentId: string; name: string | null }[] }
  | { ok: false; error: "STALE_STATE"; conflictingStudentIds: string[] }
  | { ok: false; error: "FINALIZED_LOCKED"; lockedStudentIds: string[] };

/**
 * Save (draft) or finalize attendance for a session.
 *
 * - Draft saves (finalize=false): upserts the given records. Any record that
 *   is already finalized is rejected unless the actor can override
 *   (canOverrideAttendanceFinalization) — returns a typed FINALIZED_LOCKED
 *   result rather than throwing, since this is a recoverable UI state.
 * - Finalize (finalize=true): every enrolled/active student must have a
 *   status in `records` (or already have a saved record) or the call fails
 *   with a typed MISSING_STUDENTS result listing who's missing. On success,
 *   all of the session's records are stamped finalizedAt/finalizedById.
 * - Stale-state guard: pass `loadedAt` (the timestamp the UI loaded the
 *   roster at). If any existing record for a student being written was
 *   updated after `loadedAt`, the whole save is rejected as a conflict
 *   rather than silently overwritten.
 */
export async function recordAttendance(
  actor: Session4Actor,
  sessionId: string,
  records: AttendanceRecordInput[],
  finalize = false,
  loadedAt?: Date,
): Promise<RecordAttendanceResult> {
  const session = await (prisma as any).classSession.findUnique({ where: { id: sessionId }, include: { offering: { include: { enrollments: { include: { student: { select: { id: true, name: true } } } } } }, attendance: true } });
  if (!session || session.isCancelled) throw new Error("Active session required");
  await requireInstructorAssigned(actor, session.offeringId);

  const admittedEnrollments = session.offering.enrollments.filter((e: any) => activeEnrollmentStatuses.includes(e.status));
  const admitted = new Set(admittedEnrollments.map((e: any) => e.studentId));
  const existingByStudent = new Map<string, any>(session.attendance.map((r: any) => [r.studentId, r]));
  const canOverride = canOverrideAttendanceFinalization(actor.roles);

  for (const r of records) {
    if (!attendanceStatuses.has(r.status)) throw new Error("Invalid attendance status");
    if (!admitted.has(r.studentId)) throw new Error("Cannot record attendance for waitlisted or dropped students");
  }

  // Stale-state guard.
  if (loadedAt) {
    const conflicting = records
      .map((r) => existingByStudent.get(r.studentId))
      .filter((existing) => existing && new Date(existing.updatedAt).getTime() > loadedAt.getTime())
      .map((existing) => existing.studentId);
    if (conflicting.length) {
      return { ok: false, error: "STALE_STATE", conflictingStudentIds: conflicting };
    }
  }

  // Finalized-record lock: block edits to already-finalized records unless override.
  if (!canOverride) {
    const locked = records
      .map((r) => existingByStudent.get(r.studentId))
      .filter((existing) => existing?.finalizedAt)
      .map((existing) => existing.studentId);
    if (locked.length) {
      return { ok: false, error: "FINALIZED_LOCKED", lockedStudentIds: locked };
    }
  }

  if (finalize) {
    const providedIds = new Set(records.map((r) => r.studentId));
    const missing = admittedEnrollments
      .filter((e: any) => !providedIds.has(e.studentId) && !existingByStudent.get(e.studentId)?.status)
      .map((e: any) => ({ studentId: e.studentId, name: e.student?.name ?? null }));
    if (missing.length) {
      return { ok: false, error: "MISSING_STUDENTS", missingStudents: missing };
    }
  }

  const now = new Date();
  for (const r of records) {
    await (prisma as any).classAttendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId, studentId: r.studentId } },
      update: {
        status: r.status,
        notes: r.notes,
        checkedInAt: now,
        ...(finalize ? { finalizedAt: now, finalizedById: actor.userId } : {}),
      },
      create: {
        sessionId,
        studentId: r.studentId,
        status: r.status,
        notes: r.notes,
        ...(finalize ? { finalizedAt: now, finalizedById: actor.userId } : {}),
      },
    });
  }

  if (finalize) {
    // Stamp finalization on any other already-saved records for this session
    // that weren't part of this submission (e.g. saved in an earlier draft).
    const submittedIds = new Set(records.map((r) => r.studentId));
    const toStamp = admittedEnrollments
      .map((e: any) => e.studentId)
      .filter((id: string) => !submittedIds.has(id) && existingByStudent.has(id));
    for (const studentId of toStamp) {
      await (prisma as any).classAttendanceRecord.update({
        where: { sessionId_studentId: { sessionId, studentId } },
        data: { finalizedAt: now, finalizedById: actor.userId },
      });
    }
  }

  await auditOperationalEvent({
    actorUserId: actor.userId,
    action: finalize ? "ATTENDANCE_FINALIZED" : "ATTENDANCE_RECORDED",
    sourceType: "CLASS_SESSION",
    sourceId: sessionId,
    newState: { records, finalize },
  });

  return { ok: true, finalized: finalize };
}
