import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { requireOfferingScope, type Session4Actor } from "@/lib/operational-permissions";

export async function updateEnrollmentOperations(actor: Session4Actor, offeringId: string, input: { enrollmentOpen?: boolean; capacity?: number; studentId?: string; removeEnrollmentId?: string; reason: string }) {
  if (!input.reason?.trim()) throw new Error("Reason is required");
  await requireOfferingScope(actor, offeringId);
  return (prisma as any).$transaction(async (tx: any) => {
    const off = await tx.classOffering.findUnique({ where: { id: offeringId }, include: { enrollments: true } });
    if (!off) throw new Error("Class not found");
    const data: any = {};
    if (typeof input.enrollmentOpen === "boolean") data.enrollmentOpen = input.enrollmentOpen;
    if (input.capacity !== undefined) {
      if (!Number.isInteger(input.capacity) || input.capacity < 0) throw new Error("Capacity must be a non-negative integer");
      const current = off.enrollments.filter((e: any) => e.status === "ENROLLED").length;
      if (input.capacity < current) throw new Error("Capacity cannot be below current admitted enrollment");
      data.capacity = input.capacity;
    }
    if (Object.keys(data).length) await tx.classOffering.update({ where: { id: offeringId }, data });
    if (input.studentId) {
      const current = await tx.classEnrollment.count({ where: { offeringId, status: "ENROLLED" } });
      if (current >= (data.capacity ?? off.capacity)) throw new Error("Class is full");
      await tx.classEnrollment.upsert({ where: { studentId_offeringId: { studentId: input.studentId, offeringId } }, update: { status: "ENROLLED", droppedAt: null }, create: { studentId: input.studentId, offeringId, status: "ENROLLED", outcomesAchieved: [] } });
    }
    if (input.removeEnrollmentId) await tx.classEnrollment.update({ where: { id: input.removeEnrollmentId }, data: { status: "DROPPED", droppedAt: new Date() } });
    await tx.classOfferingTimelineEvent.create({ data: { offeringId, actorId: actor.userId, kind: input.capacity !== undefined ? "CAPACITY_CHANGED" : "ENROLLMENT_STATUS_CHANGED", summary: "Enrollment operation", payload: input } });
    await auditOperationalEvent({ actorUserId: actor.userId, action: "ENROLLMENT_OPERATION", sourceType: "CLASS_OFFERING", sourceId: offeringId, newState: input, reason: input.reason });
    return { ok: true };
  });
}
