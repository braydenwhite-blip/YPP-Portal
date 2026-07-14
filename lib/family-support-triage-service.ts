import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { type Session4Actor } from "@/lib/operational-permissions";

export async function triageSupportRequest(actor: Session4Actor, requestId: string, input: any) {
  const row = await (prisma as any).familySupportRequest.update({ where: { id: requestId }, data: { internalOwnerId: input.ownerId, internalRoutingTeam: input.team, internalCategory: input.category, internalSeverity: input.severity, externalStatus: input.status, internalActionItemId: input.actionItemId, resolvedAt: ["RESOLVED", "CLOSED"].includes(input.status) ? new Date() : undefined, histories: { create: { status: input.status, actorUserId: actor.userId, note: input.note } } } });
  if (input.internalComment) await (prisma as any).familySupportResponse.create({ data: { requestId, authorUserId: actor.userId, body: input.internalComment, familyVisible: false, responseType: input.safety ? "SAFEGUARDING_RESTRICTED" : "INTERNAL_NOTE" } });
  if (input.familyResponse) await (prisma as any).familySupportResponse.create({ data: { requestId, authorUserId: actor.userId, body: input.familyResponse, familyVisible: true, responseType: "FAMILY_VISIBLE" } });
  await auditOperationalEvent({ actorUserId: actor.userId, action: "SUPPORT_TRIAGED", sourceType: "FAMILY_SUPPORT_REQUEST", sourceId: requestId, newState: input });
  return row;
}
