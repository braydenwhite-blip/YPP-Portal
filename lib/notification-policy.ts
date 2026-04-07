import { NotificationType } from "@prisma/client";

export type NotificationDeliveryBucket =
  | "portal_only"
  | "email_only"
  | "email_and_sms_later";

export type NotificationPolicy = {
  type: NotificationType;
  label: string;
  description: string;
  bucket: NotificationDeliveryBucket;
  portalHistory: boolean;
  email: boolean;
  smsPlanned: boolean;
};

const POLICY_BY_TYPE: Record<NotificationType, Omit<NotificationPolicy, "type">> = {
  ANNOUNCEMENT: {
    label: "Announcements",
    description: "Chapter-wide and platform updates arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  MENTOR_FEEDBACK: {
    label: "Mentor Feedback",
    description: "Mentor feedback summaries arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  GOAL_DEADLINE: {
    label: "Goal Deadlines",
    description: "Goal reminders stay inside the portal so they are available when you review your progress.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  COURSE_UPDATE: {
    label: "Course Updates",
    description: "Course and class changes arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  REFLECTION_REMINDER: {
    label: "Reflection Reminders",
    description: "Reflection reminders stay inside the portal so they are tied to your regular dashboard flow.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  ATTENDANCE: {
    label: "Attendance Alerts",
    description: "Attendance alerts send by email now and are marked for SMS delivery once text support is enabled.",
    bucket: "email_and_sms_later",
    portalHistory: true,
    email: true,
    smsPlanned: true,
  },
  MESSAGE: {
    label: "Messages",
    description: "New message alerts send by email now and are marked for SMS delivery once text support is enabled.",
    bucket: "email_and_sms_later",
    portalHistory: true,
    email: true,
    smsPlanned: true,
  },
  SYSTEM: {
    label: "System Alerts",
    description: "Operational alerts for approvals, interviews, intake, and other critical follow-ups send by email now and are marked for SMS delivery once text support is enabled.",
    bucket: "email_and_sms_later",
    portalHistory: true,
    email: true,
    smsPlanned: true,
  },
  CLASS_REMINDER: {
    label: "Class Reminders",
    description: "Class reminders send by email now and are marked for SMS delivery once text support is enabled.",
    bucket: "email_and_sms_later",
    portalHistory: true,
    email: true,
    smsPlanned: true,
  },
  EVENT_UPDATE: {
    label: "Event Updates",
    description: "Chapter event changes arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  EVENT_REMINDER: {
    label: "Event Reminders",
    description: "Event reminders arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
};

export function getNotificationPolicy(type: NotificationType): NotificationPolicy {
  return {
    type,
    ...POLICY_BY_TYPE[type],
  };
}

export function listNotificationPolicies(): NotificationPolicy[] {
  return (Object.keys(POLICY_BY_TYPE) as NotificationType[]).map((type) =>
    getNotificationPolicy(type)
  );
}

export function shouldCreatePortalNotification(type: NotificationType): boolean {
  return getNotificationPolicy(type).portalHistory;
}

export function shouldSendPolicyEmail(
  type: NotificationType,
  allowEmailOverride = true
): boolean {
  return getNotificationPolicy(type).email && allowEmailOverride;
}
