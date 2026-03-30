"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import { deliverNotification, deliverBulkNotifications } from "@/lib/notification-delivery";

async function requireAuth() {
  const session = await getSession();
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

  const delivered = await deliverNotification({
    userId,
    type,
    title,
    body,
    link: link || null,
  });

  revalidatePath("/notifications");
  revalidatePath("/");

  return delivered;
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

  await deliverBulkNotifications(
    userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      link: link || null,
    }))
  );

  revalidatePath("/notifications");
  revalidatePath("/");

  return { count: userIds.length };
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
      eventUpdates: true,
      eventReminders: true,
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
  const eventUpdates = formData.get("eventUpdates") === "on";
  const eventReminders = formData.get("eventReminders") === "on";

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
      eventUpdates,
      eventReminders,
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
      eventUpdates,
      eventReminders,
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
// 10. createSystemNotification – requires at least authentication.
//     Called by other server actions (which have their own auth) and guards
//     against direct unauthenticated client calls.
// ---------------------------------------------------------------------------
export async function createSystemNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  doSendEmail = true
) {
  // Require at least an authenticated session to prevent abuse
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return await deliverNotification({
    userId,
    type,
    title,
    body,
    link: link || null,
    sendEmail: doSendEmail,
  });
}

// ---------------------------------------------------------------------------
// 11. createBulkSystemNotifications – requires authentication
// ---------------------------------------------------------------------------
export async function createBulkSystemNotifications(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  doSendEmail = true
) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  if (userIds.length === 0) return;

  await deliverBulkNotifications(
    userIds.map((uid) => ({
      userId: uid,
      type,
      title,
      body,
      link: link || null,
      sendEmail: doSendEmail,
    }))
  );
}
