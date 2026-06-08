import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

/**
 * Notify a student that they've been promoted off a class waitlist into a seat.
 *
 * The `ClassOffering` waitlist promotes silently inside a serializable
 * transaction (lib/class-seat-allocation.ts) — a student could be moved into a
 * class without ever knowing. This sends the in-app notification after the
 * transaction commits. Best-effort: a notification failure must never roll back
 * or block the enrollment change, so everything is wrapped and swallowed.
 *
 * Mirrors the legacy course waitlist's COURSE_UPDATE notification type so the
 * two systems read consistently in the notification center.
 */
export async function notifyWaitlistPromotion(enrollmentId: string): Promise<void> {
  try {
    const enrollment = await prisma.classEnrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        studentId: true,
        offering: { select: { id: true, title: true } },
      },
    });
    if (!enrollment) return;

    await createNotification({
      userId: enrollment.studentId,
      type: "COURSE_UPDATE",
      title: "A seat opened — you're enrolled!",
      body: `A spot opened up in "${enrollment.offering.title}" and you've been moved off the waitlist into the class. Check My Classes for the schedule and joining details.`,
      link: `/curriculum/${enrollment.offering.id}`,
    });
  } catch (error) {
    console.error("Failed to send waitlist promotion notification", error);
  }
}
