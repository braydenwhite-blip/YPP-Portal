import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { requireInstructorAssigned, type Session4Actor } from "@/lib/operational-permissions";
import { activeEnrollmentStatuses } from "@/lib/operation-utils";

const attendanceStatuses = new Set(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
export async function recordAttendance(actor: Session4Actor, sessionId: string, records: { studentId: string; status: string; notes?: string }[], finalize = true) {
  const session = await (prisma as any).classSession.findUnique({ where: { id: sessionId }, include: { offering: { include: { enrollments: true } } } });
  if (!session || session.isCancelled) throw new Error("Active session required");
  await requireInstructorAssigned(actor, session.offeringId);
  const admitted = new Set(session.offering.enrollments.filter((e: any) => activeEnrollmentStatuses.includes(e.status)).map((e: any) => e.studentId));
  for (const r of records) {
    if (!attendanceStatuses.has(r.status)) throw new Error("Invalid attendance status");
    if (!admitted.has(r.studentId)) throw new Error("Cannot record attendance for waitlisted or dropped students");
    await (prisma as any).classAttendanceRecord.upsert({ where: { sessionId_studentId: { sessionId, studentId: r.studentId } }, update: { status: r.status, notes: r.notes, checkedInAt: new Date() }, create: { sessionId, studentId: r.studentId, status: r.status, notes: r.notes } });
  }
  await auditOperationalEvent({ actorUserId: actor.userId, action: "ATTENDANCE_RECORDED", sourceType: "CLASS_SESSION", sourceId: sessionId, newState: { records, finalize } });
  return { ok: true };
}
