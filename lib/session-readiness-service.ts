import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { requireInstructorAssigned, type Session4Actor } from "@/lib/operational-permissions";

export async function updateSessionReadiness(actor: Session4Actor, sessionId: string, input: any) {
  const s = await (prisma as any).classSession.findUnique({ where: { id: sessionId }, include: { offering: true } });
  if (!s) throw new Error("Session not found");
  await requireInstructorAssigned(actor, s.offeringId);
  const prep = await (prisma as any).instructorSessionPreparation.upsert({ where: { sessionId_instructorId: { sessionId, instructorId: s.offering.instructorId } }, update: { note: input.note, lessonReviewedAt: input.lessonReviewed ? new Date() : undefined, materialsReviewedAt: input.materialsReviewed ? new Date() : undefined, studentContextReviewedAt: input.studentContextReviewed ? new Date() : undefined, completedAt: input.confirmReady ? new Date() : undefined }, create: { sessionId, instructorId: s.offering.instructorId, note: input.note, lessonReviewedAt: input.lessonReviewed ? new Date() : undefined, materialsReviewedAt: input.materialsReviewed ? new Date() : undefined, studentContextReviewedAt: input.studentContextReviewed ? new Date() : undefined, completedAt: input.confirmReady ? new Date() : undefined } });
  await auditOperationalEvent({ actorUserId: actor.userId, action: "SESSION_READINESS_UPDATED", sourceType: "CLASS_SESSION", sourceId: sessionId, newState: input });
  return prep;
}
