import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { notifyOperational } from "@/lib/operational-notification-service";
import {
  canPublishAnnouncement,
  requireInstructorAssigned,
  type Session4Actor,
} from "@/lib/operational-permissions";

export async function upsertAnnouncement(
  actor: Session4Actor,
  offeringId: string,
  input: {
    id?: string;
    title: string;
    body: string;
    announcementType: string;
    audience?: string;
    status?: string;
    sessionId?: string | null;
    scheduledPublishAt?: Date | null;
  },
) {
  await requireInstructorAssigned(actor, offeringId);
  const approvalRequired = !canPublishAnnouncement(actor.roles, input.announcementType);
  const data = {
    authorId: actor.userId,
    title: input.title,
    body: input.body,
    announcementType: input.announcementType,
    audience: input.audience ?? "ADMITTED_FAMILIES",
    status: input.status ?? "DRAFT",
    approvalRequired,
    sessionId: input.sessionId ?? undefined,
    scheduledPublishAt: input.scheduledPublishAt ?? null,
  };
  const row = input.id
    ? await (prisma as any).classAnnouncement.update({ where: { id: input.id }, data })
    : await (prisma as any).classAnnouncement.create({ data: { offeringId, ...data } });
  await auditOperationalEvent({
    actorUserId: actor.userId,
    action: "ANNOUNCEMENT_DRAFTED",
    sourceType: "CLASS_ANNOUNCEMENT",
    sourceId: row.id,
    newState: data,
  });
  return row;
}

export async function publishAnnouncement(actor: Session4Actor, announcementId: string) {
  const a = await (prisma as any).classAnnouncement.findUnique({
    where: { id: announcementId },
    include: { offering: { include: { enrollments: true } } },
  });
  if (!a) throw new Error("Announcement not found");
  await requireInstructorAssigned(actor, a.offeringId);
  if (!canPublishAnnouncement(actor.roles, a.announcementType)) {
    throw new Error("Publishing this announcement requires chapter approval");
  }
  const row = await (prisma as any).classAnnouncement.update({
    where: { id: announcementId },
    data: {
      status: "PUBLISHED",
      approvedById: actor.userId,
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });
  for (const e of a.offering.enrollments.filter((en: { status: string }) => en.status === "ENROLLED")) {
    await notifyOperational({
      userId: e.studentId,
      eventType: "CLASS_ANNOUNCEMENT_PUBLISHED",
      title: a.title,
      body: a.body.slice(0, 180),
      link: `/student/classes/${a.offeringId}`,
      relatedEntityType: "CLASS_ANNOUNCEMENT",
      relatedEntityId: a.id,
      dedupeKey: `announcement:${a.id}:${e.studentId}`,
    });
  }
  await auditOperationalEvent({
    actorUserId: actor.userId,
    action: "ANNOUNCEMENT_PUBLISHED",
    sourceType: "CLASS_ANNOUNCEMENT",
    sourceId: announcementId,
  });
  return row;
}

/** Flip due SCHEDULED posts to PUBLISHED and notify families. */
export async function flushDueClassAnnouncements(offeringId: string) {
  const now = new Date();
  const due = await (prisma as any).classAnnouncement.findMany({
    where: {
      offeringId,
      status: "SCHEDULED",
      scheduledPublishAt: { lte: now },
    },
    include: { offering: { include: { enrollments: true } } },
  });

  for (const a of due) {
    await (prisma as any).classAnnouncement.update({
      where: { id: a.id },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        approvedAt: a.approvedAt ?? now,
      },
    });
    for (const e of a.offering.enrollments.filter(
      (en: { status: string }) => en.status === "ENROLLED",
    )) {
      await notifyOperational({
        userId: e.studentId,
        eventType: "CLASS_ANNOUNCEMENT_PUBLISHED",
        title: a.title,
        body: a.body.slice(0, 180),
        link: `/student/classes/${a.offeringId}`,
        relatedEntityType: "CLASS_ANNOUNCEMENT",
        relatedEntityId: a.id,
        dedupeKey: `announcement:${a.id}:${e.studentId}`,
      });
    }
  }
}
