import { prisma } from "@/lib/prisma";
import { NotificationScenarioKey, NotificationType } from "@prisma/client";
import { deliverNotification } from "@/lib/notification-delivery";

/**
 * Creates a notification for a user
 */
export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
  scenarioKey,
}: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  scenarioKey?: NotificationScenarioKey;
}) {
  try {
    return await deliverNotification({
      userId,
      type: type as NotificationType,
      title,
      body,
      link: link ?? null,
      scenarioKey,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

/**
 * Process waitlist when a spot opens in a course
 */
export async function processWaitlist(courseId: string) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          where: { status: "ENROLLED" }
        },
        waitlistEntries: {
          where: { status: "WAITING" },
          orderBy: { createdAt: "asc" },
          take: 1,
          include: { user: true }
        }
      }
    });

    if (!course) return;

    // Check if there's space and someone waiting
    if (
      course.maxEnrollment &&
      course.enrollments.length < course.maxEnrollment &&
      course.waitlistEntries.length > 0
    ) {
      const nextInLine = course.waitlistEntries[0];

      // Update waitlist entry status
      await prisma.waitlistEntry.update({
        where: { id: nextInLine.id },
        data: {
          status: "OFFERED",
          notifiedAt: new Date(),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours to accept
        }
      });

      // Send notification
      await createNotification({
        userId: nextInLine.userId,
        type: "COURSE_UPDATE",
        title: "Spot Available in Course!",
        body: `A spot has opened up in "${course.title}". You have 48 hours to enroll.`,
        link: "/my-classes?notice=legacy-course-notification",
        scenarioKey: "STUDENT_WAITLIST_OFFER_AVAILABLE",
      });

      return nextInLine;
    }

    return null;
  } catch (error) {
    console.error("Error processing waitlist:", error);
    return null;
  }
}

/**
 * Notify waitlist when enrollment deadline approaches
 */
export async function sendWaitlistExpiryReminders() {
  try {
    const expiringOffers = await prisma.waitlistEntry.findMany({
      where: {
        status: "OFFERED",
        expiresAt: {
          lte: new Date(Date.now() + 6 * 60 * 60 * 1000), // Expires in 6 hours
          gte: new Date()
        }
      },
      include: {
        user: true,
        course: true
      }
    });

    for (const entry of expiringOffers) {
      await createNotification({
        userId: entry.userId,
        type: "COURSE_UPDATE",
        title: "Course Enrollment Expiring Soon",
        body: `Your spot in "${entry.course.title}" expires in a few hours. Enroll now or you'll lose your spot!`,
        link: "/my-classes?notice=legacy-course-notification",
        scenarioKey: "STUDENT_WAITLIST_OFFER_EXPIRING_6H",
      });
    }

    return expiringOffers.length;
  } catch (error) {
    console.error("Error sending expiry reminders:", error);
    return 0;
  }
}
