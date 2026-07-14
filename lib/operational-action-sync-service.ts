import { prisma } from "@/lib/prisma";
import { deriveClassLifecycle } from "@/lib/class-lifecycle-service";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { actionLead, nowPlus } from "@/lib/operation-utils";

export async function syncOperationalActionsForClass(offeringId: string, actorUserId = "system") {
  const ops = await (prisma as any).classOffering.findUnique({ where: { id: offeringId }, include: { template: true, sessions: { include: { attendance: true } }, enrollments: true, guardianApprovalRequests: true, familyFormRequirements: true, familySupportRequests: true } });
  if (!ops) return null;
  const lifecycle = deriveClassLifecycle(ops);
  if (!lifecycle.blocker) return null;
  const key = `CLASS:${offeringId}:${lifecycle.blocker.code}`;
  const lead = await actionLead(ops.chapterId);
  return (prisma as any).actionItem.upsert({ where: { chapterId_operationalSourceKey: { chapterId: ops.chapterId, operationalSourceKey: key } }, update: { status: "NOT_STARTED", title: lifecycle.blocker.label, leadId: lead, operationalIssueType: lifecycle.blocker.code }, create: { title: lifecycle.blocker.label, description: `Synchronized blocker for ${ops.title}`, deadlineStart: nowPlus(3), leadId: lead, createdById: actorUserId, chapterId: ops.chapterId, relatedEntityType: "CLASS_OFFERING", relatedEntityId: offeringId, operationalSourceKey: key, operationalSourceType: "CLASS", operationalIssueType: lifecycle.blocker.code } }).catch(() => null);
}

export async function resolveOperationalAction(offeringId: string, issueType: string, actorUserId: string) {
  await (prisma as any).actionItem.updateMany({ where: { relatedEntityType: "CLASS_OFFERING", relatedEntityId: offeringId, operationalIssueType: issueType, status: { not: "COMPLETE" } }, data: { status: "COMPLETE", completedAt: new Date(), completionOutcome: "DELIVERED", completionNote: "Resolved by source mutation" } }).catch(() => null);
  await auditOperationalEvent({ actorUserId, action: "ACTION_SYNCHRONIZED_RESOLVED", sourceType: "CLASS_OFFERING", sourceId: offeringId, newState: { issueType } });
}
