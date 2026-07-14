import { prisma } from "@/lib/prisma";
import { notifyOperational as legacyNotifyOperational, type OperationalNotificationInput } from "@/lib/session-4-notifications";

const EMAIL_EVENT_TYPES = new Set([
  "GUARDIAN_APPROVAL_REQUESTED",
  "ENROLLMENT_CONFIRMED",
  "WAITLIST_OFFER_CREATED",
  "WAITLIST_OFFER_EXPIRING",
  "FORM_REQUIRED",
  "FORM_CORRECTION_REQUESTED",
  "SCHEDULE_CHANGE",
  "CLASS_CANCELLED",
  "SUPPORT_RESPONSE_SENT",
  "INSTRUCTOR_CLASS_ASSIGNED",
  "ATTENDANCE_REMINDER",
  "ACTION_ASSIGNED",
  "MEETING_COMMITMENT_ASSIGNED",
]);

export type OperationalDeliveryResult = { inPortal: boolean; emailQueued: boolean; dedupeKey?: string };

export async function notifyOperational(input: OperationalNotificationInput): Promise<OperationalDeliveryResult> {
  await legacyNotifyOperational(input);
  let emailQueued = false;
  if (input.userId && input.dedupeKey && EMAIL_EVENT_TYPES.has(input.eventType)) {
    const user = await prisma.user?.findUnique?.({ where: { id: input.userId }, select: { id: true, email: true } }).catch(() => null);
    if (user?.email && "actionEmailLog" in prisma) {
      await prisma.actionEmailLog.upsert({
        where: { dedupeKey: `operational:${input.dedupeKey}:email` },
        update: {},
        create: { type: "WEEKLY_DIGEST", recipientId: user.id, dedupeKey: `operational:${input.dedupeKey}:email` },
      });
      emailQueued = true;
    }
  }
  return { inPortal: true, emailQueued, dedupeKey: input.dedupeKey };
}
export type { OperationalNotificationInput };
