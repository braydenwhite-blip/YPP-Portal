import { prisma } from "@/lib/prisma";
export async function auditOperationalEvent(data: { actorUserId?: string | null; action: string; sourceType: string; sourceId: string; relatedEntityType?: string; relatedEntityId?: string; previousState?: any; newState?: any; reason?: string; correlationId?: string }) {
  await (prisma as any).operationalAuditEvent.create({ data }).catch(()=>null);
  if (data.actorUserId) await (prisma as any).auditLog.create({ data: { actorId: data.actorUserId, action: "UPDATE", targetType: data.sourceType, targetId: data.sourceId, description: data.action, metadata: { previousState: data.previousState, newState: data.newState, reason: data.reason, correlationId: data.correlationId } } }).catch(()=>null);
}
