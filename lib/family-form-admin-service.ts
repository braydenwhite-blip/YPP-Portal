import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { notifyOperational } from "@/lib/operational-notification-service";
import { requireOfferingScope, type Session4Actor } from "@/lib/operational-permissions";

export async function publishFamilyFormVersion(actor: Session4Actor, templateId: string, content: unknown) {
  const latest = await (prisma as any).familyFormVersion.findFirst({ where: { templateId }, orderBy: { version: "desc" } });
  const v = (latest?.version ?? 0) + 1;
  const row = await (prisma as any).familyFormVersion.create({ data: { templateId, version: v, content } });
  await auditOperationalEvent({ actorUserId: actor.userId, action: "FORM_VERSION_PUBLISHED", sourceType: "FAMILY_FORM_TEMPLATE", sourceId: templateId, newState: { version: v } });
  return row;
}

export async function assignFamilyFormRequirement(actor: Session4Actor, input: { versionId: string; studentUserId: string; offeringId: string; dueAt?: Date; reason: string; blocksEnrollment?: boolean; blocksAttendance?: boolean; staffReviewRequired?: boolean }) {
  await requireOfferingScope(actor, input.offeringId);
  if (!input.reason?.trim()) throw new Error("Assignment reason is required");
  const row = await (prisma as any).familyFormRequirement.create({ data: { versionId: input.versionId, studentUserId: input.studentUserId, offeringId: input.offeringId, dueAt: input.dueAt, reason: input.reason, blocksEnrollment: !!input.blocksEnrollment, blocksAttendance: !!input.blocksAttendance, staffReviewRequired: !!input.staffReviewRequired } });
  await notifyOperational({ userId: input.studentUserId, eventType: "FORM_REQUIRED", title: "A family form is required", body: input.reason, link: "/parent/forms", relatedEntityType: "FAMILY_FORM_REQUIREMENT", relatedEntityId: row.id, dedupeKey: `form-required:${row.id}` });
  return row;
}
export async function reviewFamilyFormSubmission(actor: Session4Actor, submissionId: string, decision: "APPROVED" | "CORRECTION_REQUESTED" | "WAIVED", note: string) { if (!["APPROVED", "CORRECTION_REQUESTED", "WAIVED"].includes(decision)) throw new Error("Invalid form review decision"); const sub = await (prisma as any).familyFormSubmission.update({ where: { id: submissionId }, data: { staffReviewState: decision, reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: note } }); await (prisma as any).familyFormRequirement.update({ where: { id: sub.requirementId }, data: { status: decision === "APPROVED" ? "COMPLETED" : decision === "WAIVED" ? "WAIVED" : "IN_PROGRESS", completedAt: decision === "APPROVED" ? new Date() : undefined } }); await auditOperationalEvent({ actorUserId: actor.userId, action: `FORM_${decision}`, sourceType: "FAMILY_FORM_SUBMISSION", sourceId: submissionId, reason: note }); return sub; }
