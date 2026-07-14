import { prisma } from "@/lib/prisma";
import { type Session4Actor } from "@/lib/operational-permissions";
import { syncOperationalActionsForClass } from "@/lib/operational-action-sync-service";

export async function persistBiweeklyActionPacket(actor: Session4Actor, chapterId: string, periodStart: Date, periodEnd: Date) {
  const packet = await (prisma as any).biweeklyActionPacket.upsert({ where: { chapterId_periodStart_periodEnd: { chapterId, periodStart, periodEnd } }, update: { state: "REFRESHED", generatedById: actor.userId, generatedAt: new Date() }, create: { chapterId, periodStart, periodEnd, generatedById: actor.userId } });
  const pipeline = await (prisma as any).classOffering.findMany({ where: { chapterId }, select: { id: true } });
  for (const o of pipeline) { const action = await syncOperationalActionsForClass(o.id, actor.userId); if (action) await (prisma as any).biweeklyActionPacketItem.upsert({ where: { packetId_sourceKey: { packetId: packet.id, sourceKey: action.operationalSourceKey } }, update: { actionItemId: action.id, state: action.status === "COMPLETE" ? "COMPLETE" : "OPEN" }, create: { packetId: packet.id, actionItemId: action.id, sourceKey: action.operationalSourceKey, ownerId: action.leadId, dueAt: action.deadlineStart } }); }
  return packet;
}
