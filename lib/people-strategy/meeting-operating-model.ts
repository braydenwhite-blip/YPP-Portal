/**
 * Meetings Tracker - YPP operating model vocabulary.
 *
 * This module is pure and client-safe. It gives the existing OfficerMeeting
 * table a clear meeting workflow type without creating a second meeting system.
 */

export const MEETING_TYPE_VALUES = [
  "OFFICER_MEETING",
  "GLOBAL_OPERATIONS_IMPACT_PRESENTATION",
  "CHAPTER_IMPACT_PRESENTATION",
  "MENTORSHIP_CHECK_IN",
  "GENERAL_MEETING",
] as const;

export type MeetingType = (typeof MEETING_TYPE_VALUES)[number];

export type MeetingWorkflowPhase = {
  title: string;
  items: string[];
};

export type MeetingOperatingModel = {
  type: MeetingType;
  label: string;
  shortLabel: string;
  navLabel: string;
  description: string;
  defaultCategory: string;
  defaultDurationMinutes: number;
  defaultRecurrence: "WEEKLY" | "NONE";
  leadText: string;
  requiredAttendees: string[];
  agenda: string[];
  presentationSections: string[];
  before: MeetingWorkflowPhase;
  during: MeetingWorkflowPhase;
  after: MeetingWorkflowPhase;
};

export const MEETING_OPERATING_MODELS: Record<MeetingType, MeetingOperatingModel> = {
  OFFICER_MEETING: {
    type: "OFFICER_MEETING",
    label: "Officer Meeting",
    shortLabel: "Officer",
    navLabel: "Officer Meetings",
    description:
      "Decision-focused strategy, applicant review, staff performance, escalations, and role ownership.",
    defaultCategory: "LEADERSHIP",
    defaultDurationMinutes: 60,
    defaultRecurrence: "WEEKLY",
    leadText: "Aveena leading with Ian, Sanvi, Brayden, and Anthea",
    requiredAttendees: ["Aveena", "Ian", "Sanvi", "Brayden", "Anthea"],
    agenda: [
      "Decisions needed this week",
      "Escalations from Impact Presentations",
      "Applicants needing review",
      "Staff performance concerns",
      "Overdue strategic actions",
      "People needing intervention",
      "Role ownership gaps",
      "Upcoming priorities",
      "Last week's commitments still open",
    ],
    presentationSections: [],
    before: {
      title: "Before",
      items: [
        "Review overdue strategic actions",
        "Pull escalations from Impact Presentations",
        "Check applicants and people concerns",
        "Confirm decisions that need owners",
      ],
    },
    during: {
      title: "During",
      items: [
        "Make decisions",
        "Assign owners and due dates",
        "Record people concerns only for leadership visibility",
        "Convert commitments into Action Tracker items",
      ],
    },
    after: {
      title: "After",
      items: [
        "Send or copy the summary",
        "Confirm actions were created",
        "Move unresolved decisions forward",
        "Escalate people or role gaps as needed",
      ],
    },
  },
  GLOBAL_OPERATIONS_IMPACT_PRESENTATION: {
    type: "GLOBAL_OPERATIONS_IMPACT_PRESENTATION",
    label: "Global Operations Impact Presentation",
    shortLabel: "Global Impact",
    navLabel: "Impact Presentations",
    description:
      "Weekly accountability forum where global teams present progress, proof, blockers, decisions, and next commitments.",
    defaultCategory: "OPERATIONS",
    defaultDurationMinutes: 90,
    defaultRecurrence: "WEEKLY",
    leadText: "Aveena and Brayden",
    requiredAttendees: [
      "Aveena",
      "Brayden",
      "Communications: Sanvi and Alina",
      "Expansion: Jackson and Jennifer",
      "Tech: Anthea and Wesley",
    ],
    agenda: [
      "Communications 30 min: progress, deliverables, blockers, next commitments",
      "Expansion 30 min: progress, parent/alumni outreach, blockers, next commitments",
      "Tech 30 min: development, testing, rollout, data/process automation",
      "Leadership decisions and follow-up actions",
      "Attendance or responsiveness concerns",
    ],
    presentationSections: [
      "Team",
      "Presenter or owner",
      "This week's progress",
      "Deliverables shown",
      "Metrics or proof of work",
      "Blockers",
      "Decisions needed",
      "Next week's commitments",
      "Follow-up actions",
      "Attendance and responsiveness concerns",
    ],
    before: {
      title: "Before",
      items: [
        "Confirm each team has a 30 minute slot",
        "Check linked actions and deliverables",
        "Look for missing weekly progress",
        "Bring blockers and decisions into the agenda",
      ],
    },
    during: {
      title: "During",
      items: [
        "Record whether each team presented real progress",
        "Capture proof of work and blockers",
        "Decide next steps with the relevant officer",
        "Turn next week commitments into actions",
      ],
    },
    after: {
      title: "After",
      items: [
        "Create follow-up actions with owners and dates",
        "Flag teams missing updates",
        "Send the impact summary",
        "Escalate unresolved blockers to Officer Meeting",
      ],
    },
  },
  CHAPTER_IMPACT_PRESENTATION: {
    type: "CHAPTER_IMPACT_PRESENTATION",
    label: "Chapter Impact Presentation",
    shortLabel: "Chapter Impact",
    navLabel: "Chapter Meetings",
    description:
      "Weekly chapter accountability meeting for presidents to show progress, outreach, blockers, needs, and next steps.",
    defaultCategory: "CHAPTERS",
    defaultDurationMinutes: 60,
    defaultRecurrence: "WEEKLY",
    leadText: "Ian and Brayden",
    requiredAttendees: ["Ian", "Brayden", "Chapter Presidents"],
    agenda: [
      "Chapter progress this week",
      "New partners or outreach",
      "New applicants or students",
      "Current blockers",
      "Decisions needed",
      "Next week's commitments",
      "Follow-up actions",
      "Attendance or responsiveness concerns",
    ],
    presentationSections: [
      "Chapter",
      "Chapter President",
      "This week's progress",
      "New partners or outreach",
      "New applicants or students",
      "Current blockers",
      "Decisions needed",
      "Next week's commitments",
      "Follow-up actions",
      "Attendance or responsiveness concerns",
    ],
    before: {
      title: "Before",
      items: [
        "Confirm chapter president attendance",
        "Review chapter actions and partner/applicant updates",
        "Prepare blocker and decision questions",
        "Check if an update is missing before the call",
      ],
    },
    during: {
      title: "During",
      items: [
        "Record chapter progress and proof",
        "Name blockers and support needed",
        "Set next steps for the chapter president",
        "Convert commitments into Action Tracker items",
      ],
    },
    after: {
      title: "After",
      items: [
        "Send chapter summary",
        "Assign follow-ups with owners and dates",
        "Escalate missing updates or repeated attendance issues",
        "Make chapter progress visible to Ian and Brayden",
      ],
    },
  },
  MENTORSHIP_CHECK_IN: {
    type: "MENTORSHIP_CHECK_IN",
    label: "Mentorship Check-in",
    shortLabel: "Mentorship",
    navLabel: "Mentorship Check-ins",
    description:
      "Mentor and mentee check-in focused on goals, progress, notes, next steps, and review history.",
    defaultCategory: "MENTORSHIP",
    defaultDurationMinutes: 30,
    defaultRecurrence: "WEEKLY",
    leadText: "Mentor or People Chair",
    requiredAttendees: ["Mentor", "Mentee"],
    agenda: ["Goals", "Progress", "Blockers", "Next steps", "Related actions", "Review history"],
    presentationSections: [],
    before: {
      title: "Before",
      items: ["Review goals", "Check prior commitments", "Bring open mentorship actions"],
    },
    during: {
      title: "During",
      items: ["Capture progress", "Discuss blockers", "Agree on next steps"],
    },
    after: {
      title: "After",
      items: ["Link actions", "Update notes", "Feed review context where supported"],
    },
  },
  GENERAL_MEETING: {
    type: "GENERAL_MEETING",
    label: "General Meeting",
    shortLabel: "General",
    navLabel: "General Meetings",
    description: "Older or one-off meeting that does not fit the new operating model yet.",
    defaultCategory: "OTHER",
    defaultDurationMinutes: 30,
    defaultRecurrence: "NONE",
    leadText: "Assigned facilitator",
    requiredAttendees: [],
    agenda: [],
    presentationSections: [],
    before: {
      title: "Before",
      items: ["Add an agenda", "Confirm attendees", "Review linked actions"],
    },
    during: {
      title: "During",
      items: ["Capture notes", "Record decisions", "Create follow-ups"],
    },
    after: {
      title: "After",
      items: ["Send summary", "Convert commitments into actions", "Close follow-ups"],
    },
  },
};

export function isMeetingType(value: unknown): value is MeetingType {
  return typeof value === "string" && (MEETING_TYPE_VALUES as readonly string[]).includes(value);
}

export function normalizeMeetingType(value: string | null | undefined): MeetingType {
  const normalized = value?.trim().toUpperCase();
  return isMeetingType(normalized) ? normalized : "GENERAL_MEETING";
}

export function meetingTypeLabel(value: string | null | undefined): string {
  return MEETING_OPERATING_MODELS[normalizeMeetingType(value)].label;
}

export function meetingTypeShortLabel(value: string | null | undefined): string {
  return MEETING_OPERATING_MODELS[normalizeMeetingType(value)].shortLabel;
}

export function meetingOperatingModel(value: string | null | undefined): MeetingOperatingModel {
  return MEETING_OPERATING_MODELS[normalizeMeetingType(value)];
}

export function inferMeetingType(input: {
  meetingType?: string | null;
  title?: string | null;
  category?: string | null;
  relatedEntityType?: string | null;
}): MeetingType {
  const explicit = normalizeMeetingType(input.meetingType);
  if (explicit !== "GENERAL_MEETING") return explicit;

  const title = input.title?.toLowerCase() ?? "";
  const category = input.category?.toUpperCase() ?? "";
  if (title.includes("global operations impact") || title.includes("impact presentation")) {
    return "GLOBAL_OPERATIONS_IMPACT_PRESENTATION";
  }
  if (title.includes("chapter impact") || category === "CHAPTERS") {
    return "CHAPTER_IMPACT_PRESENTATION";
  }
  if (title.includes("officer") || title.includes("leadership sync") || category === "LEADERSHIP") {
    return "OFFICER_MEETING";
  }
  if (category === "MENTORSHIP" || input.relatedEntityType === "MENTORSHIP") {
    return "MENTORSHIP_CHECK_IN";
  }
  return explicit;
}
