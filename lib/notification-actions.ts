"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import { sendNotificationEmail, isEmailConfigured } from "@/lib/email";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ---------------------------------------------------------------------------
// Helper: Send email notification if user has it enabled
// ---------------------------------------------------------------------------
async function sendEmailNotificationIfEnabled(
  userId: string,
  title: string,
  body: string,
  link?: string
) {
  if (!isEmailConfigured()) return;

  try {
    // Get user and their preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        notificationPreference: {
          select: { emailEnabled: true }
        }
      }
    });

    if (!user) return;

    // Check if email is enabled (default to true if no preferences set)
    const emailEnabled = user.notificationPreference?.emailEnabled ?? true;
    if (!emailEnabled) return;

    // Build full URL for link
    const baseUrl = process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const fullLink = link ? `${baseUrl}${link.startsWith("/") ? link : `/${link}`}` : undefined;

    await sendNotificationEmail({
      to: user.email,
      name: user.name,
      title,
      body,
      link: fullLink
    });
  } catch (error) {
    // Log but don't fail the notification creation
    console.error("[Notification] Failed to send email:", error);
  }
}

// ---------------------------------------------------------------------------
// 1. getNotifications – fetch the current user's last 50 notifications
// ---------------------------------------------------------------------------
export async function getNotifications() {
  const session = await requireAuth();
  const userId = session.user.id;

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications;
}

// ---------------------------------------------------------------------------
// 2. getUnreadCount – count of unread notifications for the current user
// ---------------------------------------------------------------------------
export async function getUnreadCount() {
  const session = await requireAuth();
  const userId = session.user.id;

  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return count;
}

// ---------------------------------------------------------------------------
// 3. markAsRead – mark a single notification as read (by id from FormData)
// ---------------------------------------------------------------------------
export async function markAsRead(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const id = getString(formData, "id");

  // Ensure the notification belongs to the current user
  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification || notification.userId !== userId) {
    throw new Error("Notification not found");
  }

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// 4. markAllAsRead – mark every unread notification as read for current user
// ---------------------------------------------------------------------------
export async function markAllAsRead() {
  const session = await requireAuth();
  const userId = session.user.id;

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// 5. createNotification – requires admin to call directly via server action
// ---------------------------------------------------------------------------
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string
) {
  // Require admin when called as a server action
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      link: link || null,
    },
  });

  // Send email notification (non-blocking)
  sendEmailNotificationIfEnabled(userId, title, body, link || undefined);

  revalidatePath("/notifications");
  revalidatePath("/");

  return notification;
}

// ---------------------------------------------------------------------------
// 6. createBulkNotifications – requires admin to call directly
// ---------------------------------------------------------------------------
export async function createBulkNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  link?: string
) {
  // Require admin when called as a server action
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }

  if (userIds.length === 0) return [];

  const data = userIds.map((userId) => ({
    userId,
    type,
    title,
    body,
    link: link || null,
  }));

  const result = await prisma.notification.createMany({ data });

  // Send email notifications to all users (non-blocking, in background)
  for (const userId of userIds) {
    sendEmailNotificationIfEnabled(userId, title, body, link || undefined);
  }

  revalidatePath("/notifications");
  revalidatePath("/");

  return result;
}

// ---------------------------------------------------------------------------
// 7. getNotificationPreferences – get (or create) the current user's prefs
// ---------------------------------------------------------------------------
export async function getNotificationPreferences() {
  const session = await requireAuth();
  const userId = session.user.id;

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      emailEnabled: true,
      inAppEnabled: true,
      announcements: true,
      mentorUpdates: true,
      goalReminders: true,
      courseUpdates: true,
      reflectionReminders: true,
    },
  });

  return preferences;
}

// ---------------------------------------------------------------------------
// 8. updateNotificationPreferences – update preferences from FormData
// ---------------------------------------------------------------------------
export async function updateNotificationPreferences(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  // Checkboxes: present in FormData only when checked ("on"), absent when off.
  const emailEnabled = formData.get("emailEnabled") === "on";
  const inAppEnabled = formData.get("inAppEnabled") === "on";
  const announcements = formData.get("announcements") === "on";
  const mentorUpdates = formData.get("mentorUpdates") === "on";
  const goalReminders = formData.get("goalReminders") === "on";
  const courseUpdates = formData.get("courseUpdates") === "on";
  const reflectionReminders = formData.get("reflectionReminders") === "on";

  await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      emailEnabled,
      inAppEnabled,
      announcements,
      mentorUpdates,
      goalReminders,
      courseUpdates,
      reflectionReminders,
    },
    create: {
      userId,
      emailEnabled,
      inAppEnabled,
      announcements,
      mentorUpdates,
      goalReminders,
      courseUpdates,
      reflectionReminders,
    },
  });

  revalidatePath("/notifications");
  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// 9. deleteNotification – delete a notification owned by the current user
// ---------------------------------------------------------------------------
export async function deleteNotification(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const id = getString(formData, "id");

  // Ensure the notification belongs to the current user
  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification || notification.userId !== userId) {
    throw new Error("Notification not found");
  }

  await prisma.notification.delete({
    where: { id },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// 10. createSystemNotification – internal use, no auth check (for server-side)
// ---------------------------------------------------------------------------
export async function createSystemNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  sendEmail = true
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      link: link || null,
    },
  });

  // Send email notification if enabled
  if (sendEmail) {
    sendEmailNotificationIfEnabled(userId, title, body, link || undefined);
  }

  return notification;
}

// ---------------------------------------------------------------------------
// 11. createBulkSystemNotifications – internal use, no auth check
// ---------------------------------------------------------------------------
export async function createBulkSystemNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  sendEmail = true
) {
  if (userIds.length === 0) return;

  const data = userIds.map((uid) => ({
    userId: uid,
    type,
    title,
    body,
    link: link || null,
  }));

  await prisma.notification.createMany({ data });

  // Send email notifications
  if (sendEmail) {
    for (const uid of userIds) {
      sendEmailNotificationIfEnabled(uid, title, body, link || undefined);
    }
  }
}
