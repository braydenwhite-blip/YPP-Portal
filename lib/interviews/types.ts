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

export type InterviewCommandCenterData = {
  filters: InterviewHubFilters;
  tasks: InterviewTask[];
  sections: InterviewHubSections;
  viewer: {
    userId: string;
    chapterId: string | null;
    roles: string[];
    canTeamView: boolean;
  };
};
