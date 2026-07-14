import { prisma } from "@/lib/prisma";

type NotifyInput = { userId?: string | null; eventType: string; title: string; body: string; link?: string | null; relatedEntityType?: string; relatedEntityId?: string; dedupeKey: string; operational?: boolean };
export async function notifyOperational(input: NotifyInput) {
  if (!input.userId) return null;
  const pref = await (prisma as any).notificationPreference.findUnique({ where: { userId: input.userId } }).catch(()=>null);
  if (pref && pref.inAppEnabled === false && !input.operational) return null;
  return (prisma as any).notification.upsert({
    where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
    update: { title: input.title, body: input.body, link: input.link ?? null, deliveryState: "SENT", eventType: input.eventType, relatedEntityType: input.relatedEntityType, relatedEntityId: input.relatedEntityId },
    create: { userId: input.userId, type: "SYSTEM", title: input.title, body: input.body, link: input.link ?? null, dedupeKey: input.dedupeKey, deliveryState: "SENT", eventType: input.eventType, relatedEntityType: input.relatedEntityType, relatedEntityId: input.relatedEntityId },
  }).catch(async()=> (prisma as any).notification.create({ data: { userId: input.userId!, type: "SYSTEM", title: input.title, body: input.body, link: input.link ?? null, dedupeKey: input.dedupeKey } }).catch(()=>null));
}
