import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { requireOfferingScope, type Session4Actor } from "@/lib/operational-permissions";

export async function decideGuardianApproval(actor: Session4Actor, requestId: string, decision: "APPROVED" | "DECLINED", note?: string) {
  if (!["APPROVED", "DECLINED"].includes(decision)) throw new Error("Invalid guardian approval decision");
  const req = await (prisma as any).guardianApprovalRequest.findUnique({ where: { id: requestId }, include: { offering: true } });
  if (!req || req.status !== "PENDING") throw new Error("Pending request required");
  await requireOfferingScope(actor, req.offeringId);
  return (prisma as any).$transaction(async (tx: any) => { await tx.guardianApprovalRequest.update({ where: { id: requestId }, data: { status: decision, decisionById: actor.userId, decisionNote: note, decidedAt: new Date() } }); if (decision === "APPROVED") { const count = await tx.classEnrollment.count({ where: { offeringId: req.offeringId, status: "ENROLLED" } }); const status = count < req.offering.capacity ? "ENROLLED" : "WAITLISTED"; await tx.classEnrollment.upsert({ where: { studentId_offeringId: { studentId: req.studentUserId, offeringId: req.offeringId } }, update: { status }, create: { studentId: req.studentUserId, offeringId: req.offeringId, status, outcomesAchieved: [] } }); } await auditOperationalEvent({ actorUserId: actor.userId, action: `GUARDIAN_APPROVAL_${decision}`, sourceType: "GUARDIAN_APPROVAL_REQUEST", sourceId: requestId, reason: note }); return { ok: true }; });
}
