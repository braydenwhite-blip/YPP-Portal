import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendNotificationEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/portal-auth-utils";
import {
  type NotificationPolicyKey,
  resolveNotificationPolicyChannels,
  shouldCreatePortalNotification,
  shouldSendPolicyEmail,
} from "@/lib/notification-policy";
import { isSmsConfigured, sendSmsNotification } from "@/lib/sms";

type DeliveryInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  sendEmail?: boolean;
  policyKey?: NotificationPolicyKey;
};

type PreferenceRecord = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  smsPhoneE164: string | null;
  announcements: boolean;
  mentorUpdates: boolean;
  goalReminders: boolean;
  courseUpdates: boolean;
  reflectionReminders: boolean;
  eventUpdates: boolean;
  eventReminders: boolean;
};

function preferenceKeyForType(type: NotificationType): keyof PreferenceRecord | null {
  switch (type) {
    case "ANNOUNCEMENT":
      return "announcements";
    case "MENTOR_FEEDBACK":
      return "mentorUpdates";
    case "GOAL_DEADLINE":
      return "goalReminders";
    case "COURSE_UPDATE":
    case "CLASS_REMINDER":
      return "courseUpdates";
    case "REFLECTION_REMINDER":
      return "reflectionReminders";
    case "EVENT_UPDATE":
      return "eventUpdates";
    case "EVENT_REMINDER":
      return "eventReminders";
    default:
      return null;
  }
}

function isTypeEnabled(
  preferences: PreferenceRecord | null | undefined,
  type: NotificationType
) {
  const key = preferenceKeyForType(type);
  if (!key) return true;
  return preferences?.[key] ?? true;
}
export async function deliverNotification(input: DeliveryInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      name: true,
      notificationPreference: {
        select: {
          emailEnabled: true,
          inAppEnabled: true,
          smsEnabled: true,
          smsPhoneE164: true,
          announcements: true,
          mentorUpdates: true,
          goalReminders: true,
          courseUpdates: true,
          reflectionReminders: true,
          eventUpdates: true,
          eventReminders: true,
        },
      },
    },
  });

  if (!user) return null;

  const preferences = user.notificationPreference;
  const typeEnabled = isTypeEnabled(preferences, input.type);
  const policyChannels = input.policyKey
    ? resolveNotificationPolicyChannels(input.policyKey)
    : null;
  const shouldCreateInApp =
    (policyChannels?.inApp ?? shouldCreatePortalNotification(input.type)) &&
    (preferences?.inAppEnabled ?? true) &&
    typeEnabled;
  const shouldSendEmail =
    (policyChannels
      ? input.sendEmail !== false && policyChannels.email
      : shouldSendPolicyEmail(input.type, input.sendEmail !== false)) &&
    (preferences?.emailEnabled ?? true) &&
    typeEnabled &&
    isEmailConfigured();
  const shouldSendSms =
    Boolean(policyChannels?.sms) &&
    (preferences?.smsEnabled ?? false) &&
    Boolean(preferences?.smsPhoneE164) &&
    typeEnabled &&
    isSmsConfigured();

  let notification = null;

  if (shouldCreateInApp) {
    notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link || null,
      },
    });
  }

  if (shouldSendEmail) {
    const baseUrl = await getBaseUrl();
    const fullLink = input.link
      ? `${baseUrl}${input.link.startsWith("/") ? input.link : `/${input.link}`}`
      : undefined;

    await sendNotificationEmail({
      to: user.email,
      name: user.name,
      title: input.title,
      body: input.body,
      link: fullLink,
    }).catch((error) => {
      console.error("[NotificationDelivery] Failed to send email:", error);
    });
  }

  if (shouldSendSms && preferences?.smsPhoneE164) {
    await sendSmsNotification({
      to: preferences.smsPhoneE164,
      title: input.title,
      body: input.body,
      link: input.link || null,
    }).catch((error) => {
      console.error("[NotificationDelivery] Failed to send SMS:", error);
    });
  }

  return notification;
}

export async function deliverBulkNotifications(inputs: DeliveryInput[]) {
  const uniqueInputs = new Map<string, DeliveryInput>();

  for (const input of inputs) {
    uniqueInputs.set(
      `${input.userId}:${input.type}:${input.title}:${input.link ?? ""}:${input.policyKey ?? ""}`,
      input
    );
  }

  for (const input of uniqueInputs.values()) {
    await deliverNotification(input);
  }
}
