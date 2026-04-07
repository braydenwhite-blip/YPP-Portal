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
