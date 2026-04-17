"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import { deliverNotification, deliverBulkNotifications } from "@/lib/notification-delivery";
import { type NotificationPolicyKey } from "@/lib/notification-policy";
import { normalizePhoneNumberToE164 } from "@/lib/sms";

export type NotificationDeliveryOptions = {
  sendEmail?: boolean;
  policyKey?: NotificationPolicyKey;
};

export type NotificationPreferencesFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailEnabled: true,
  inAppEnabled: true,
  smsEnabled: false,
  smsPhoneE164: null,
  smsConsentAt: null,
  smsOptOutAt: null,
  announcements: true,
  mentorUpdates: true,
  goalReminders: true,
  courseUpdates: true,
  reflectionReminders: true,
  eventUpdates: true,
  eventReminders: true,
} as const;

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

async function ensureNotificationPreferences(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    },
  });
}

function readCheckbox(
  formData: FormData,
  key: string,
  fallback: boolean,
  preserveMissing = false
) {
  if (!formData.has(key)) {
    return preserveMissing ? fallback : false;
  }

  return formData.get(key) === "on";
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
  link?: string,
  options: NotificationDeliveryOptions = {}
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
    sendEmail: options.sendEmail,
    policyKey: options.policyKey,
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
  link?: string,
  options: NotificationDeliveryOptions = {}
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
      sendEmail: options.sendEmail,
      policyKey: options.policyKey,
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

  const preferences = await ensureNotificationPreferences(userId);

  return preferences;
}

// ---------------------------------------------------------------------------
// 8. updateNotificationPreferences – update preferences from FormData
// ---------------------------------------------------------------------------
export async function updateNotificationPreferences(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const current = await ensureNotificationPreferences(userId);
  const formScope = getString(formData, "formScope", false);
  const isSmsForm = formScope === "sms";

  const emailEnabled = readCheckbox(formData, "emailEnabled", current.emailEnabled, isSmsForm);
  const inAppEnabled = readCheckbox(formData, "inAppEnabled", current.inAppEnabled, isSmsForm);
  const announcements = readCheckbox(formData, "announcements", current.announcements, isSmsForm);
  const mentorUpdates = readCheckbox(formData, "mentorUpdates", current.mentorUpdates, isSmsForm);
  const goalReminders = readCheckbox(formData, "goalReminders", current.goalReminders, isSmsForm);
  const courseUpdates = readCheckbox(formData, "courseUpdates", current.courseUpdates, isSmsForm);
  const reflectionReminders = readCheckbox(
    formData,
    "reflectionReminders",
    current.reflectionReminders,
    isSmsForm
  );
  const eventUpdates = readCheckbox(formData, "eventUpdates", current.eventUpdates, isSmsForm);
  const eventReminders = readCheckbox(
    formData,
    "eventReminders",
    current.eventReminders,
    isSmsForm
  );

  let smsEnabled = current.smsEnabled;
  let smsPhoneE164 = current.smsPhoneE164;
  let smsConsentAt = current.smsConsentAt;
  let smsOptOutAt = current.smsOptOutAt;

  if (isSmsForm || formData.has("smsEnabled") || formData.has("smsPhone")) {
    const smsPhoneRaw = getString(formData, "smsPhone", false);
    const requestedSmsEnabled = formData.get("smsEnabled") === "on";

    if (!smsPhoneRaw) {
      if (requestedSmsEnabled) {
        throw new Error("Add a mobile number before turning on text notifications.");
      }

      smsEnabled = false;
      smsPhoneE164 = null;
    } else {
      smsPhoneE164 = normalizePhoneNumberToE164(smsPhoneRaw);
      smsEnabled = requestedSmsEnabled;

      if (smsEnabled) {
        smsConsentAt = new Date();
        smsOptOutAt = null;
      }
    }
  }

  const updatedPreferences = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      emailEnabled,
      inAppEnabled,
      smsEnabled,
      smsPhoneE164,
      smsConsentAt,
      smsOptOutAt,
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
      smsEnabled,
      smsPhoneE164,
      smsConsentAt,
      smsOptOutAt,
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

  return updatedPreferences;
}

export async function updateNotificationPreferencesAction(
  _prevState: NotificationPreferencesFormState,
  formData: FormData
): Promise<NotificationPreferencesFormState> {
  try {
    await updateNotificationPreferences(formData);

    return {
      status: "success",
      message:
        getString(formData, "formScope", false) === "sms"
          ? "Text message settings saved."
          : "Notification settings saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save notification settings.",
    };
  }
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
  options: NotificationDeliveryOptions = {}
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
    sendEmail: options.sendEmail,
    policyKey: options.policyKey,
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
  options: NotificationDeliveryOptions = {}
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
      sendEmail: options.sendEmail,
      policyKey: options.policyKey,
    }))
  );
}
