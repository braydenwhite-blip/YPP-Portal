export type InterviewDomain = "HIRING" | "READINESS";

export type InterviewStage = "NEEDS_ACTION" | "SCHEDULED" | "COMPLETED" | "BLOCKED";

export type InterviewScope = "all" | "hiring" | "readiness";

export type InterviewView = "mine" | "team";

export type InterviewStateFilter = "needs_action" | "scheduled" | "completed" | "blocked";

export type InterviewTaskAudience = "mine" | "team";

export type InterviewTaskLink = {
  label: string;
  href: string;
};

export type InterviewSchedulingTone =
  | "needs-action"
  | "scheduled"
  | "completed"
  | "blocked"
  | "info"
  | "warning"
  | "neutral";

/**
 * At-a-glance scheduling state for a candidate/instructor, so the interview
 * side can instantly tell who has been sent times (and by whom) versus who is
 * still waiting for the other party to approve a time.
 */
export type InterviewSchedulingStatus = {
  /**
   * AWAITING_TIMES   – nobody has sent interview times yet.
   * TIMES_SENT       – times have been sent; waiting for the recipient to pick/confirm.
   * AWAITING_REVIEWER – recipient shared availability; waiting on the interview team.
   * CONFIRMED        – a time has been locked in.
   */
  state: "AWAITING_TIMES" | "TIMES_SENT" | "AWAITING_REVIEWER" | "CONFIRMED";
  label: string;
  tone: InterviewSchedulingTone;
  /** Who sent the interview times (the interviewer / reviewer who posted them). */
  sentByName?: string | null;
  /** Who the times were sent to (the applicant / instructor). */
  sentToName?: string | null;
  sentAt?: Date | null;
  slotCount?: number;
};

export type InterviewPrimaryAction =
  | {
      kind: "confirm_hiring_slot";
      label: string;
      slotId: string;
    }
  | {
      kind: "post_hiring_slots_bulk";
      label: string;
      applicationId: string;
      defaultDateTimeLocal: string;
    }
  | {
      kind: "complete_hiring_interview_and_note";
      label: string;
      applicationId: string;
      slotId: string;
    }
  | {
      kind: "add_hiring_recommendation_note";
      label: string;
      applicationId: string;
    }
  | {
      kind: "confirm_readiness_slot";
      label: string;
      slotId: string;
    }
  | {
      kind: "request_readiness_availability";
      label: string;
      instructorId: string;
      defaultDateTimeLocal: string;
    }
  | {
      kind: "post_readiness_slots_bulk";
      label: string;
      gateId: string;
      instructorId: string;
      defaultDateTimeLocal: string;
    }
  | {
      kind: "accept_readiness_request";
      label: string;
      requestId: string;
      defaultDateTimeLocal: string;
    }
  | {
      kind: "complete_readiness_interview_and_outcome";
      label: string;
      gateId: string;
      slotId?: string;
    }
  | {
      kind: "open_details";
      label: string;
      href: string;
    };

/**
 * Optional Entity 360 hook for a task: the person being interviewed
 * (readiness) or the instructor application (hiring V1). Rendered as an
 * EntityChip so the hub opens previews instead of dead-end labels.
 */
export type InterviewTaskEntity = {
  type: "person" | "applicant";
  id: string;
  label: string;
};

export type InterviewTask = {
  id: string;
  domain: InterviewDomain;
  audience: InterviewTaskAudience;
  stage: InterviewStage;
  title: string;
  subtitle: string;
  detail: string;
  ownerName: string;
  href: string;
  primaryAction: InterviewPrimaryAction;
  secondaryLinks: InterviewTaskLink[];
  relatedEntity?: InterviewTaskEntity;
  schedulingStatus?: InterviewSchedulingStatus;
  blockers: string[];
  timestamps?: {
    submittedAt?: Date | null;
    scheduledAt?: Date | null;
    completedAt?: Date | null;
  };
};

export type InterviewHubFilters = {
  scope: InterviewScope;
  view: InterviewView;
  state: InterviewStateFilter | "all";
};

export type InterviewHubSections = {
  needsAction: InterviewTask[];
  scheduled: InterviewTask[];
  completed: InterviewTask[];
  blocked: InterviewTask[];
};

export type InterviewHubKpis = {
  needsAction: number;
  scheduledTotal: number;
  scheduledToday: number;
  completedThisWeek: number;
};

export type InterviewCommandCenterData = {
  filters: InterviewHubFilters;
  tasks: InterviewTask[];
  sections: InterviewHubSections;
  kpis: InterviewHubKpis;
  viewer: {
    userId: string;
    chapterId: string | null;
    roles: string[];
    canTeamView: boolean;
  };
};
