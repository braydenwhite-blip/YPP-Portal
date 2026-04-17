import { NotificationType } from "@prisma/client";

export type NotificationDeliveryChannel =
  | "EMAIL_AND_TEXT"
  | "EMAIL_ONLY"
  | "TEXT_ONLY"
  | "IN_APP_ONLY";

export type NotificationPolicyKey =
  | "APPLICATION_DECISIONS"
  | "INTERVIEW_UPDATES"
  | "MENTORSHIP_REVIEWS"
  | "GOAL_DEADLINES"
  | "MESSAGES"
  | "COURSE_AND_CLASS_UPDATES"
  | "EVENT_REMINDERS_AND_CHANGES"
  | "EVENT_UPDATES"
  | "ANNOUNCEMENTS"
  | "SYSTEM_ALERTS";

export type NotificationPolicyEntry = {
  label: string;
  channel: NotificationDeliveryChannel;
  description: string;
};

export const NOTIFICATION_POLICY: Record<NotificationPolicyKey, NotificationPolicyEntry> = {
  APPLICATION_DECISIONS: {
    label: "Application decisions",
    channel: "EMAIL_AND_TEXT",
    description: "Hiring decisions and requests for more information are delivered urgently.",
  },
  INTERVIEW_UPDATES: {
    label: "Interview updates",
    channel: "EMAIL_AND_TEXT",
    description: "Interview scheduling and follow-up changes are sent by email and text.",
  },
  MENTORSHIP_REVIEWS: {
    label: "Mentorship reviews",
    channel: "EMAIL_ONLY",
    description: "Monthly review submissions, approvals, and change requests are sent by email.",
  },
  GOAL_DEADLINES: {
    label: "Goal deadlines",
    channel: "EMAIL_ONLY",
    description: "Reflection and review deadlines stay on email so people do not miss them.",
  },
  MESSAGES: {
    label: "Direct messages",
    channel: "IN_APP_ONLY",
    description: "Messages live in the portal inbox and home next actions.",
  },
  COURSE_AND_CLASS_UPDATES: {
    label: "Course and class updates",
    channel: "EMAIL_ONLY",
    description: "Schedule or class workflow changes are delivered by email.",
  },
  EVENT_REMINDERS_AND_CHANGES: {
    label: "Event reminders and changes",
    channel: "EMAIL_AND_TEXT",
    description: "RSVP reminders and urgent event changes are sent by email and text.",
  },
  EVENT_UPDATES: {
    label: "Event updates",
    channel: "IN_APP_ONLY",
    description: "Routine event announcements and updates stay in the portal feed.",
  },
  ANNOUNCEMENTS: {
    label: "Announcements",
    channel: "IN_APP_ONLY",
    description: "General updates stay in-app unless they are elevated into a system alert.",
  },
  SYSTEM_ALERTS: {
    label: "System alerts",
    channel: "EMAIL_AND_TEXT",
    description: "Critical platform issues or urgent account notices go to both email and text.",
  },
};

export const NOTIFICATION_POLICY_CHANNEL_LABELS: Record<NotificationDeliveryChannel, string> = {
  EMAIL_AND_TEXT: "Email + text",
  EMAIL_ONLY: "Email only",
  TEXT_ONLY: "Text only",
  IN_APP_ONLY: "Portal only",
};

export type NotificationChannelFlags = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
};

export function resolveNotificationPolicyChannels(
  policyKey?: NotificationPolicyKey
): NotificationChannelFlags {
  if (!policyKey) {
    return {
      inApp: true,
      email: true,
      sms: false,
    };
  }

  const channel = NOTIFICATION_POLICY[policyKey].channel;

  return {
    inApp: true,
    email: channel === "EMAIL_ONLY" || channel === "EMAIL_AND_TEXT",
    sms: channel === "TEXT_ONLY" || channel === "EMAIL_AND_TEXT",
  };
}

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
    description:
      "Chapter-wide and platform updates arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  MENTOR_FEEDBACK: {
    label: "Mentor Feedback",
    description:
      "Mentor feedback summaries arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  GOAL_DEADLINE: {
    label: "Goal Deadlines",
    description:
      "Goal reminders stay inside the portal so they are available when you review your progress.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  COURSE_UPDATE: {
    label: "Course Updates",
    description:
      "Course and class changes arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  REFLECTION_REMINDER: {
    label: "Reflection Reminders",
    description:
      "Reflection reminders stay inside the portal so they are tied to your regular dashboard flow.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  ATTENDANCE: {
    label: "Attendance Alerts",
    description:
      "Attendance alerts send by email now and are marked for SMS delivery once text support is enabled.",
    bucket: "email_and_sms_later",
    portalHistory: true,
    email: true,
    smsPlanned: true,
  },
  MESSAGE: {
    label: "Messages",
    description:
      "Message alerts stay in the portal inbox. Email can be sent selectively, but text messages are not used for direct messages.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  SYSTEM: {
    label: "System Alerts",
    description:
      "Operational alerts for approvals, interviews, intake, and other critical follow-ups can send by email and, for approved workflows, by text.",
    bucket: "email_and_sms_later",
    portalHistory: true,
    email: true,
    smsPlanned: true,
  },
  CLASS_REMINDER: {
    label: "Class Reminders",
    description:
      "Class reminders send by email now and are marked for SMS delivery once text support is enabled.",
    bucket: "email_and_sms_later",
    portalHistory: true,
    email: true,
    smsPlanned: true,
  },
  EVENT_UPDATE: {
    label: "Event Updates",
    description:
      "Chapter event changes arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  EVENT_REMINDER: {
    label: "Event Reminders",
    description:
      "Event reminders arrive by email and stay visible in your portal history.",
    bucket: "email_only",
    portalHistory: true,
    email: true,
    smsPlanned: false,
  },
  REFLECTION_WINDOW_OPENED: {
    label: "Reflection Window Opened",
    description:
      "New monthly reflection openings stay in the portal so they appear alongside your current mentorship tasks.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  REFLECTION_SUBMITTED: {
    label: "Reflection Submitted",
    description:
      "Reflection submission handoffs stay in the portal so mentors can move directly into their monthly review workflow.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  REVIEW_SUBMITTED_FOR_APPROVAL: {
    label: "Review Submitted for Approval",
    description:
      "Chair approval requests stay in the portal so reviewers can open the exact mentorship review from their queue.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  REVIEW_APPROVED_AND_RELEASED: {
    label: "Review Approved and Released",
    description:
      "Review release updates stay in portal history so mentors and mentees can revisit the final result and awarded points.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  GR_REFLECTION_DUE: {
    label: "G&R Reflection Due",
    description: "Reminder that the monthly self-reflection hasn't been submitted yet.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  GR_REVIEW_DUE: {
    label: "G&R Review Due",
    description: "Reminder that a mentee's reflection is waiting for a mentor review.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  GR_CHAIR_APPROVAL_PENDING: {
    label: "G&R Chair Approval Pending",
    description: "Batched reminder that monthly reviews are waiting for chair sign-off.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
    smsPlanned: false,
  },
  GR_REVIEW_RELEASED: {
    label: "G&R Review Released",
    description: "Notification that the mentor's monthly review is now visible on the mentee's G&R page.",
    bucket: "portal_only",
    portalHistory: true,
    email: false,
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
