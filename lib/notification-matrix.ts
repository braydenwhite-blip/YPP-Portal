import {
  MessagePriority,
  NotificationScenarioKey,
  NotificationType,
  NotificationUrgency,
} from "@prisma/client";

export type NotificationAudience =
  | "APPLICANT"
  | "STUDENT"
  | "MENTOR"
  | "INSTRUCTOR"
  | "CHAPTER_PRESIDENT"
  | "CHAPTER_LEAD"
  | "ADMIN_STAFF"
  | "PARENT"
  | "ALL_SYSTEM";

export type NotificationMatrixChannels = {
  portal: boolean;
  email: boolean;
  sms: boolean;
};

export type NotificationQuietHoursBehavior = "BYPASS" | "QUEUE";

export type NotificationSmsFallbackBehavior = "NONE" | "EMAIL_ACTION_REQUIRED";

export type NotificationScenarioDefinition = {
  key: NotificationScenarioKey;
  audience: NotificationAudience;
  label: string;
  type: NotificationType;
  urgency: NotificationUrgency;
  channels: NotificationMatrixChannels;
  quietHours: NotificationQuietHoursBehavior;
  smsFallback: NotificationSmsFallbackBehavior;
  notes?: string;
};

export type NotificationMatrixSection = {
  audience: NotificationAudience;
  label: string;
  scenarios: NotificationScenarioKey[];
};

const CHANNELS_BY_URGENCY: Record<NotificationUrgency, NotificationMatrixChannels> = {
  P0: { portal: true, email: true, sms: true },
  P1: { portal: true, email: true, sms: false },
  P2: { portal: true, email: true, sms: false },
  P3: { portal: true, email: false, sms: false },
};

function channelsFromUrgency(urgency: NotificationUrgency): NotificationMatrixChannels {
  return CHANNELS_BY_URGENCY[urgency];
}

function quietHoursFromUrgency(urgency: NotificationUrgency): NotificationQuietHoursBehavior {
  return urgency === "P0" || urgency === "P1" ? "BYPASS" : "QUEUE";
}

function smsFallbackFromChannels(
  channels: NotificationMatrixChannels
): NotificationSmsFallbackBehavior {
  return channels.sms ? "EMAIL_ACTION_REQUIRED" : "NONE";
}

function buildScenario(
  key: NotificationScenarioKey,
  audience: NotificationAudience,
  label: string,
  type: NotificationType,
  urgency: NotificationUrgency,
  notes?: string,
  overrideChannels?: Partial<NotificationMatrixChannels>
): NotificationScenarioDefinition {
  const channels = {
    ...channelsFromUrgency(urgency),
    ...overrideChannels,
  };

  return {
    key,
    audience,
    label,
    type,
    urgency,
    channels,
    quietHours: quietHoursFromUrgency(urgency),
    smsFallback: smsFallbackFromChannels(channels),
    notes,
  };
}

export const NOTIFICATION_MATRIX: Record<NotificationScenarioKey, NotificationScenarioDefinition> = {
  LEGACY_GENERIC: buildScenario(
    "LEGACY_GENERIC",
    "ALL_SYSTEM",
    "Legacy notification",
    "SYSTEM",
    "P2",
    "Compatibility wrapper for older callers."
  ),
  SYSTEM_SMS_TEST: {
    key: "SYSTEM_SMS_TEST",
    audience: "ALL_SYSTEM",
    label: "Test SMS",
    type: "SYSTEM",
    urgency: "P1",
    channels: { portal: false, email: false, sms: true },
    quietHours: "BYPASS",
    smsFallback: "NONE",
    notes: "Used by the notification settings screen to validate a real SMS delivery.",
  },
  APPLICANT_STATUS_CHANGE_NEXT_STAGE: buildScenario(
    "APPLICANT_STATUS_CHANGE_NEXT_STAGE",
    "APPLICANT",
    "Application Status Change (Next Stage)",
    "SYSTEM",
    "P1",
    "Moving from 'Review' to 'Interview'."
  ),
  APPLICANT_INTERVIEW_SCHEDULED: buildScenario(
    "APPLICANT_INTERVIEW_SCHEDULED",
    "APPLICANT",
    "Interview Scheduled",
    "SYSTEM",
    "P1",
    "Includes Zoom/Meeting link."
  ),
  APPLICANT_INTERVIEW_REMINDER_24H: buildScenario(
    "APPLICANT_INTERVIEW_REMINDER_24H",
    "APPLICANT",
    "Interview Reminder (24h)",
    "SYSTEM",
    "P1"
  ),
  APPLICANT_DECISION_RELEASED: buildScenario(
    "APPLICANT_DECISION_RELEASED",
    "APPLICANT",
    "Decision Released",
    "SYSTEM",
    "P1",
    "Acceptance or rejection."
  ),
  STUDENT_ATTENDANCE_ALERT_UNEXCUSED_ABSENCE: buildScenario(
    "STUDENT_ATTENDANCE_ALERT_UNEXCUSED_ABSENCE",
    "STUDENT",
    "Attendance Alert (Unexcused Absence)",
    "ATTENDANCE",
    "P1",
    "Sent immediately after session log."
  ),
  STUDENT_CLASS_REMINDER_1H: buildScenario(
    "STUDENT_CLASS_REMINDER_1H",
    "STUDENT",
    "Class Reminder (1h before)",
    "CLASS_REMINDER",
    "P1",
    "Direct link to classroom."
  ),
  STUDENT_FEEDBACK_GRADE_POSTED: buildScenario(
    "STUDENT_FEEDBACK_GRADE_POSTED",
    "STUDENT",
    "New Feedback/Grade Posted",
    "COURSE_UPDATE",
    "P2",
    "Link to assignment or goal review."
  ),
  STUDENT_WAITLIST_OFFER_AVAILABLE: buildScenario(
    "STUDENT_WAITLIST_OFFER_AVAILABLE",
    "STUDENT",
    "Waitlist Offer Available",
    "COURSE_UPDATE",
    "P1",
    "48-hour window to accept."
  ),
  STUDENT_WAITLIST_OFFER_EXPIRING_6H: buildScenario(
    "STUDENT_WAITLIST_OFFER_EXPIRING_6H",
    "STUDENT",
    "Waitlist Offer Expiring (6h)",
    "COURSE_UPDATE",
    "P0",
    "Final reminder."
  ),
  STUDENT_NEW_BADGE_EARNED: buildScenario(
    "STUDENT_NEW_BADGE_EARNED",
    "STUDENT",
    "New Badge Earned",
    "ANNOUNCEMENT",
    "P3",
    "Visual pop-up on next login."
  ),
  STUDENT_PEER_KUDOS_RECEIVED: buildScenario(
    "STUDENT_PEER_KUDOS_RECEIVED",
    "STUDENT",
    "Peer Kudos Received",
    "ANNOUNCEMENT",
    "P3",
    "Visual pop-up on next login."
  ),
  MENTOR_NEW_REFLECTION_SUBMITTED: buildScenario(
    "MENTOR_NEW_REFLECTION_SUBMITTED",
    "MENTOR",
    "New Reflection Submitted",
    "REFLECTION_REMINDER",
    "P2",
    "Mentee has submitted their monthly reflection."
  ),
  MENTOR_GOAL_REVIEW_DUE_48H: buildScenario(
    "MENTOR_GOAL_REVIEW_DUE_48H",
    "MENTOR",
    "Goal Review Due (48h left)",
    "GOAL_DEADLINE",
    "P1"
  ),
  MENTOR_GOAL_REVIEW_OVERDUE: buildScenario(
    "MENTOR_GOAL_REVIEW_OVERDUE",
    "MENTOR",
    "Goal Review Overdue",
    "GOAL_DEADLINE",
    "P0",
    "Critical for mentee point awards."
  ),
  MENTOR_CHANGES_REQUESTED_BY_CHAIR: buildScenario(
    "MENTOR_CHANGES_REQUESTED_BY_CHAIR",
    "MENTOR",
    "Changes Requested by Chair",
    "MENTOR_FEEDBACK",
    "P1",
    "Chair returned review for clarification."
  ),
  MENTOR_NEW_MENTEE_ASSIGNED: buildScenario(
    "MENTOR_NEW_MENTEE_ASSIGNED",
    "MENTOR",
    "New Mentee Assigned",
    "MENTOR_FEEDBACK",
    "P2",
    "Welcome email with mentee bio."
  ),
  MENTOR_MILESTONE_REACHED: buildScenario(
    "MENTOR_MILESTONE_REACHED",
    "MENTOR",
    "Mentee Milestone Reach",
    "ANNOUNCEMENT",
    "P3",
    'e.g., mentee earned a "Gold" badge.'
  ),
  MENTOR_SCHEDULED_CHECK: buildScenario(
    "MENTOR_SCHEDULED_CHECK",
    "MENTOR",
    "Scheduled Mentor Check",
    "MENTOR_FEEDBACK",
    "P2",
    "Mentee submitted availability for check."
  ),
  MENTOR_CHECK_SOON_24H: buildScenario(
    "MENTOR_CHECK_SOON_24H",
    "MENTOR",
    "Mentor Check Soon (24 hrs)",
    "MENTOR_FEEDBACK",
    "P1",
    undefined,
    { sms: true }
  ),
  INSTRUCTOR_CLASS_SESSION_REMINDER_1H: buildScenario(
    "INSTRUCTOR_CLASS_SESSION_REMINDER_1H",
    "INSTRUCTOR",
    "Class Session Reminder (1h)",
    "CLASS_REMINDER",
    "P0"
  ),
  INSTRUCTOR_ATTENDANCE_NOT_LOGGED_POST_SESSION: buildScenario(
    "INSTRUCTOR_ATTENDANCE_NOT_LOGGED_POST_SESSION",
    "INSTRUCTOR",
    "Attendance Not Logged (Post-Session)",
    "ATTENDANCE",
    "P1",
    "Reminder to finalize class records."
  ),
  INSTRUCTOR_NEW_STUDENT_ENROLLMENT: buildScenario(
    "INSTRUCTOR_NEW_STUDENT_ENROLLMENT",
    "INSTRUCTOR",
    "New Student Enrollment",
    "COURSE_UPDATE",
    "P2",
    "Notification of class list update."
  ),
  INSTRUCTOR_TRAINING_MODULE_ASSIGNED: buildScenario(
    "INSTRUCTOR_TRAINING_MODULE_ASSIGNED",
    "INSTRUCTOR",
    "Training Module Assigned",
    "COURSE_UPDATE",
    "P2",
    "New curriculum or safety training."
  ),
  INSTRUCTOR_TRAINING_DUE_SOON: buildScenario(
    "INSTRUCTOR_TRAINING_DUE_SOON",
    "INSTRUCTOR",
    "Training Due Soon",
    "COURSE_UPDATE",
    "P1"
  ),
  CHAPTER_PRESIDENT_HIRING_DECISION_PENDING_CHAIR: buildScenario(
    "CHAPTER_PRESIDENT_HIRING_DECISION_PENDING_CHAIR",
    "CHAPTER_PRESIDENT",
    "Hiring Decision Pending (Chair)",
    "SYSTEM",
    "P0",
    "Application ready for final sign-off."
  ),
  CHAPTER_PRESIDENT_GOAL_REVIEW_PENDING_APPROVAL: buildScenario(
    "CHAPTER_PRESIDENT_GOAL_REVIEW_PENDING_APPROVAL",
    "CHAPTER_PRESIDENT",
    "Goal Review Pending Approval",
    "GOAL_DEADLINE",
    "P1",
    "Mentor submitted review for Chair approval."
  ),
  CHAPTER_PRESIDENT_NEW_CHAPTER_JOIN_REQUEST: buildScenario(
    "CHAPTER_PRESIDENT_NEW_CHAPTER_JOIN_REQUEST",
    "CHAPTER_PRESIDENT",
    "New Chapter Join Request",
    "SYSTEM",
    "P2"
  ),
  CHAPTER_PRESIDENT_CHAPTER_ACHIEVEMENT_EARNED: buildScenario(
    "CHAPTER_PRESIDENT_CHAPTER_ACHIEVEMENT_EARNED",
    "CHAPTER_PRESIDENT",
    "Chapter Achievement Earned",
    "ANNOUNCEMENT",
    "P3",
    "Milestone for the entire chapter."
  ),
  CHAPTER_PRESIDENT_OPERATIONAL_RISK_ALERT: buildScenario(
    "CHAPTER_PRESIDENT_OPERATIONAL_RISK_ALERT",
    "CHAPTER_PRESIDENT",
    "Operational Risk Alert",
    "SYSTEM",
    "P0",
    "e.g., critical staffing shortage or non-compliance."
  ),
  CHAPTER_LEAD_NEW_APPLICANT_IN_QUEUE: buildScenario(
    "CHAPTER_LEAD_NEW_APPLICANT_IN_QUEUE",
    "CHAPTER_LEAD",
    "New Applicant in Queue",
    "SYSTEM",
    "P2",
    "New candidate to be moved to Under Review."
  ),
  CHAPTER_LEAD_INTERVIEW_REQUEST_ACCEPTED: buildScenario(
    "CHAPTER_LEAD_INTERVIEW_REQUEST_ACCEPTED",
    "CHAPTER_LEAD",
    "Interview Request Accepted",
    "SYSTEM",
    "P2",
    "Candidate confirmed slot."
  ),
  CHAPTER_LEAD_NEW_MEMBER_ONBOARDING_STATUS: buildScenario(
    "CHAPTER_LEAD_NEW_MEMBER_ONBOARDING_STATUS",
    "CHAPTER_LEAD",
    "New Member Onboarding Status",
    "ANNOUNCEMENT",
    "P3",
    "Tracking instructors as they complete training."
  ),
  CHAPTER_LEAD_CHAPTER_ANNOUNCEMENT_POSTED: buildScenario(
    "CHAPTER_LEAD_CHAPTER_ANNOUNCEMENT_POSTED",
    "CHAPTER_LEAD",
    "Chapter Announcement Posted",
    "ANNOUNCEMENT",
    "P2"
  ),
  ADMIN_SYSTEM_ERROR_API_FAILURE: buildScenario(
    "ADMIN_SYSTEM_ERROR_API_FAILURE",
    "ADMIN_STAFF",
    "System Error / API Failure",
    "SYSTEM",
    "P0",
    "Production reliability alerts."
  ),
  ADMIN_ESCALATED_SUPPORT_REQUEST: buildScenario(
    "ADMIN_ESCALATED_SUPPORT_REQUEST",
    "ADMIN_STAFF",
    "Escalated Support Request",
    "SYSTEM",
    "P0"
  ),
  ADMIN_NEW_CHAPTER_PROPOSAL: buildScenario(
    "ADMIN_NEW_CHAPTER_PROPOSAL",
    "ADMIN_STAFF",
    "New Chapter Proposal",
    "SYSTEM",
    "P2"
  ),
  ADMIN_GLOBAL_ACHIEVEMENT_SUMMARY: buildScenario(
    "ADMIN_GLOBAL_ACHIEVEMENT_SUMMARY",
    "ADMIN_STAFF",
    "Global Achievement Summary",
    "ANNOUNCEMENT",
    "P3",
    "Periodic statistics."
  ),
  PARENT_ATTENDANCE_ALERT_ABSENCE: buildScenario(
    "PARENT_ATTENDANCE_ALERT_ABSENCE",
    "PARENT",
    "Attendance Alert (Absence)",
    "ATTENDANCE",
    "P0",
    "Immediate notification if child is not in session."
  ),
  PARENT_PROGRESS_REPORT_AVAILABLE: buildScenario(
    "PARENT_PROGRESS_REPORT_AVAILABLE",
    "PARENT",
    "Progress Report Available",
    "COURSE_UPDATE",
    "P2",
    "Monthly summary of child's growth."
  ),
  PARENT_NEW_DIRECT_MESSAGE_FROM_INSTRUCTOR: buildScenario(
    "PARENT_NEW_DIRECT_MESSAGE_FROM_INSTRUCTOR",
    "PARENT",
    "New Direct Message from Instructor",
    "MESSAGE",
    "P1"
  ),
  SYSTEM_PASSWORD_RESET_LOGIN_ALERT: buildScenario(
    "SYSTEM_PASSWORD_RESET_LOGIN_ALERT",
    "ALL_SYSTEM",
    "Password Reset / Login Alert",
    "SYSTEM",
    "P0",
    "Security sensitive transactions."
  ),
  SYSTEM_ROLE_CHANGE_CONFIRMATION: buildScenario(
    "SYSTEM_ROLE_CHANGE_CONFIRMATION",
    "ALL_SYSTEM",
    "Role Change Confirmation",
    "SYSTEM",
    "P1",
    "e.g., promotion from Instructor to Lead."
  ),
  SYSTEM_NEW_MESSAGING_THREAD: buildScenario(
    "SYSTEM_NEW_MESSAGING_THREAD",
    "ALL_SYSTEM",
    "New Messaging Thread",
    "MESSAGE",
    "P1"
  ),
  SYSTEM_NEW_MESSAGE: {
    key: "SYSTEM_NEW_MESSAGE",
    audience: "ALL_SYSTEM",
    label: "New Message",
    type: "MESSAGE",
    urgency: "P2",
    channels: channelsFromUrgency("P2"),
    quietHours: quietHoursFromUrgency("P2"),
    smsFallback: "NONE",
    notes: "Urgency is selected by the sender.",
  },
};

export const NOTIFICATION_MATRIX_SECTIONS: NotificationMatrixSection[] = [
  {
    audience: "APPLICANT",
    label: "Applicant",
    scenarios: [
      "APPLICANT_STATUS_CHANGE_NEXT_STAGE",
      "APPLICANT_INTERVIEW_SCHEDULED",
      "APPLICANT_INTERVIEW_REMINDER_24H",
      "APPLICANT_DECISION_RELEASED",
    ],
  },
  {
    audience: "STUDENT",
    label: "Student",
    scenarios: [
      "STUDENT_ATTENDANCE_ALERT_UNEXCUSED_ABSENCE",
      "STUDENT_CLASS_REMINDER_1H",
      "STUDENT_FEEDBACK_GRADE_POSTED",
      "STUDENT_WAITLIST_OFFER_AVAILABLE",
      "STUDENT_WAITLIST_OFFER_EXPIRING_6H",
      "STUDENT_NEW_BADGE_EARNED",
      "STUDENT_PEER_KUDOS_RECEIVED",
    ],
  },
  {
    audience: "MENTOR",
    label: "Mentor",
    scenarios: [
      "MENTOR_NEW_REFLECTION_SUBMITTED",
      "MENTOR_GOAL_REVIEW_DUE_48H",
      "MENTOR_GOAL_REVIEW_OVERDUE",
      "MENTOR_CHANGES_REQUESTED_BY_CHAIR",
      "MENTOR_NEW_MENTEE_ASSIGNED",
      "MENTOR_MILESTONE_REACHED",
      "MENTOR_SCHEDULED_CHECK",
      "MENTOR_CHECK_SOON_24H",
    ],
  },
  {
    audience: "INSTRUCTOR",
    label: "Instructor",
    scenarios: [
      "INSTRUCTOR_CLASS_SESSION_REMINDER_1H",
      "INSTRUCTOR_ATTENDANCE_NOT_LOGGED_POST_SESSION",
      "INSTRUCTOR_NEW_STUDENT_ENROLLMENT",
      "INSTRUCTOR_TRAINING_MODULE_ASSIGNED",
      "INSTRUCTOR_TRAINING_DUE_SOON",
    ],
  },
  {
    audience: "CHAPTER_PRESIDENT",
    label: "Chapter President",
    scenarios: [
      "CHAPTER_PRESIDENT_HIRING_DECISION_PENDING_CHAIR",
      "CHAPTER_PRESIDENT_GOAL_REVIEW_PENDING_APPROVAL",
      "CHAPTER_PRESIDENT_NEW_CHAPTER_JOIN_REQUEST",
      "CHAPTER_PRESIDENT_CHAPTER_ACHIEVEMENT_EARNED",
      "CHAPTER_PRESIDENT_OPERATIONAL_RISK_ALERT",
    ],
  },
  {
    audience: "CHAPTER_LEAD",
    label: "Chapter Lead",
    scenarios: [
      "CHAPTER_LEAD_NEW_APPLICANT_IN_QUEUE",
      "CHAPTER_LEAD_INTERVIEW_REQUEST_ACCEPTED",
      "CHAPTER_LEAD_NEW_MEMBER_ONBOARDING_STATUS",
      "CHAPTER_LEAD_CHAPTER_ANNOUNCEMENT_POSTED",
    ],
  },
  {
    audience: "ADMIN_STAFF",
    label: "Admin / Staff",
    scenarios: [
      "ADMIN_SYSTEM_ERROR_API_FAILURE",
      "ADMIN_ESCALATED_SUPPORT_REQUEST",
      "ADMIN_NEW_CHAPTER_PROPOSAL",
      "ADMIN_GLOBAL_ACHIEVEMENT_SUMMARY",
    ],
  },
  {
    audience: "PARENT",
    label: "Parent",
    scenarios: [
      "PARENT_ATTENDANCE_ALERT_ABSENCE",
      "PARENT_PROGRESS_REPORT_AVAILABLE",
      "PARENT_NEW_DIRECT_MESSAGE_FROM_INSTRUCTOR",
    ],
  },
  {
    audience: "ALL_SYSTEM",
    label: "All / System",
    scenarios: [
      "SYSTEM_PASSWORD_RESET_LOGIN_ALERT",
      "SYSTEM_ROLE_CHANGE_CONFIRMATION",
      "SYSTEM_NEW_MESSAGING_THREAD",
      "SYSTEM_NEW_MESSAGE",
    ],
  },
];

export const NOTIFICATION_URGENCY_LABELS: Record<NotificationUrgency, string> = {
  P0: "P0 Critical",
  P1: "P1 High",
  P2: "P2 Normal",
  P3: "P3 Low",
};

export const NOTIFICATION_URGENCY_DESCRIPTIONS: Record<NotificationUrgency, string> = {
  P0: "Text + email + portal for immediate action items and security alerts.",
  P1: "Email + portal for time-sensitive work in the next 24-48 hours.",
  P2: "Email + portal for routine updates and new submissions.",
  P3: "Portal-only history for achievements and background updates.",
};

export function getNotificationScenarioDefinition(
  scenarioKey: NotificationScenarioKey,
  urgencyOverride?: NotificationUrgency
): NotificationScenarioDefinition {
  const base = NOTIFICATION_MATRIX[scenarioKey];

  if (!base) {
    return NOTIFICATION_MATRIX.LEGACY_GENERIC;
  }

  if (scenarioKey !== "SYSTEM_NEW_MESSAGE" || !urgencyOverride) {
    return base;
  }

  const channels = channelsFromUrgency(urgencyOverride);

  return {
    ...base,
    urgency: urgencyOverride,
    channels,
    quietHours: quietHoursFromUrgency(urgencyOverride),
    smsFallback: smsFallbackFromChannels(channels),
  };
}

export function isMatrixScenarioKey(scenarioKey?: NotificationScenarioKey | null) {
  return Boolean(scenarioKey && scenarioKey !== "LEGACY_GENERIC");
}

export function getNotificationAudienceLabel(audience: NotificationAudience) {
  return NOTIFICATION_MATRIX_SECTIONS.find((section) => section.audience === audience)?.label ?? audience;
}

export function getNotificationChannelsLabel(channels: NotificationMatrixChannels) {
  const labels = [];
  if (channels.sms) labels.push("Text");
  if (channels.email) labels.push("Email");
  if (channels.portal) labels.push("Portal");
  return labels.join(" + ");
}

export function messagePriorityToNotificationUrgency(
  priority: MessagePriority
): NotificationUrgency {
  switch (priority) {
    case "URGENT":
      return "P0";
    case "HIGH":
      return "P1";
    case "LOW":
      return "P3";
    case "NORMAL":
    default:
      return "P2";
  }
}

export function notificationUrgencyToMessagePriority(
  urgency: NotificationUrgency
): MessagePriority {
  switch (urgency) {
    case "P0":
      return "URGENT";
    case "P1":
      return "HIGH";
    case "P3":
      return "LOW";
    case "P2":
    default:
      return "NORMAL";
  }
}
