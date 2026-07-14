import { prisma } from "@/lib/prisma";
import { acceptWaitlistOffer as familyAcceptWaitlistOffer } from "@/lib/family-enrollment-service";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { notifyOperational } from "@/lib/operational-notification-service";
import { requireOfferingScope, type Session4Actor } from "@/lib/operational-permissions";

export async function createWaitlistOffer(actor: Session4Actor, waitlistId: string, expiresAt: Date, note?: string) {
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error("Offer expiration must be in the future");
  const entry = await (prisma as any).familyWaitlistEntry.findUnique({ where: { id: waitlistId }, include: { offering: { include: { enrollments: true } }, studentUser: true } });
  if (!entry || entry.status !== "ACTIVE") throw new Error("Active waitlist entry required");
  await requireOfferingScope(actor, entry.offeringId);
  if (!entry.offering.enrollmentOpen) throw new Error("Enrollment is closed");
  if (entry.offering.enrollments.filter((e: any) => e.status === "ENROLLED").length >= entry.offering.capacity) throw new Error("No capacity available");
  return (prisma as any).familyWaitlistEntry.update({ where: { id: waitlistId }, data: { status: "OFFERED", offerExpiresAt: expiresAt, decidedById: actor.userId, audits: { create: { actorUserId: actor.userId, action: "OFFERED", note } } } }).then(async (r: any) => {
    await notifyOperational({ userId: entry.studentUserId, eventType: "WAITLIST_OFFER_CREATED", title: "A seat is available", body: `A seat opened for ${entry.offering.title}.`, link: `/student/classes/${entry.offeringId}`, relatedEntityType: "FAMILY_WAITLIST_ENTRY", relatedEntityId: waitlistId, dedupeKey: `waitlist-offer:${waitlistId}` });
    await auditOperationalEvent({ actorUserId: actor.userId, action: "WAITLIST_OFFER_CREATED", sourceType: "FAMILY_WAITLIST_ENTRY", sourceId: waitlistId, newState: { expiresAt }, reason: note });
    return r;
  });
}
export async function acceptStaffWaitlistOffer(actor: Session4Actor, waitlistId: string) { const e = await (prisma as any).familyWaitlistEntry.findUnique({ where: { id: waitlistId } }); if (!e) throw new Error("Offer not found"); await requireOfferingScope(actor, e.offeringId); return familyAcceptWaitlistOffer(e.studentUserId, e.offeringId, ({ userId: actor.userId, role: "GUARDIAN" } as any)); }
export async function declineWaitlistOffer(actor: Session4Actor, waitlistId: string, note?: string) { const e = await (prisma as any).familyWaitlistEntry.findUnique({ where: { id: waitlistId } }); if (!e) throw new Error("Offer not found"); await requireOfferingScope(actor, e.offeringId); const row = await (prisma as any).familyWaitlistEntry.update({ where: { id: waitlistId }, data: { status: "DECLINED", decidedById: actor.userId, audits: { create: { actorUserId: actor.userId, action: "DECLINED", note } } } }); await auditOperationalEvent({ actorUserId: actor.userId, action: "WAITLIST_DECLINED", sourceType: "FAMILY_WAITLIST_ENTRY", sourceId: waitlistId, reason: note }); return row; }
export async function expireWaitlistOffers() { const rows = await (prisma as any).familyWaitlistEntry.findMany({ where: { status: "OFFERED", offerExpiresAt: { lt: new Date() } } }); for (const r of rows) await (prisma as any).familyWaitlistEntry.update({ where: { id: r.id }, data: { status: "EXPIRED", audits: { create: { action: "EXPIRED", note: "Deterministic Session 6 expiration" } } } }); return rows.length; }
