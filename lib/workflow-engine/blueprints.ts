// ============================================================================
// Universal Workflow Engine — blueprint catalog
// ============================================================================
//
// The PROOF that every business process is reusable DATA, not custom code. Each
// WorkflowBlueprint below is a complete template definition — stages, steps,
// transitions, and automation rules (which reuse the existing ActionItem /
// Meeting / Notification systems). `seedWorkflowBlueprints` (lib/workflow-engine
// /seed.ts) installs them idempotently, and the admin "Install blueprint" action
// instantiates any of them. Adding a new business process = adding an entry
// here, never new engine code.
//
// Pure data + helpers (no Prisma, no server-only).

import type {
  ExitCriteria,
  WorkflowAutomationActionValue,
  WorkflowAutomationTriggerValue,
  WorkflowStepKindValue,
} from "@/lib/workflow-engine/types";

export type BlueprintStep = {
  key: string;
  name: string;
  description?: string;
  kind?: WorkflowStepKindValue;
  isRequired?: boolean;
  assigneeMode?: string;
  assigneeRole?: string;
  assigneeSubtype?: string;
  dueOffsetHours?: number;
  config?: Record<string, unknown>;
};

export type BlueprintStage = {
  key: string;
  name: string;
  description?: string;
  slaHours?: number;
  isInitial?: boolean;
  isTerminal?: boolean;
  exitCriteria?: ExitCriteria;
  steps: BlueprintStep[];
};

export type BlueprintTransition = {
  fromStageKey: string;
  toStageKey: string;
  label?: string;
  isAutomatic?: boolean;
  condition?: Record<string, unknown>;
};

export type BlueprintAutomation = {
  name: string;
  trigger: WorkflowAutomationTriggerValue;
  action: WorkflowAutomationActionValue;
  stageKey?: string;
  stepKey?: string;
  config?: Record<string, unknown>;
};

export type WorkflowBlueprint = {
  key: string;
  name: string;
  description: string;
  domain: string;
  defaultOwnerRole?: string;
  defaultOwnerSubtype?: string;
  followUpCadenceHours?: number;
  escalateAfterHours?: number;
  stages: BlueprintStage[];
  /** Optional explicit edges; defaults to a linear chain when omitted. */
  transitions?: BlueprintTransition[];
  automations?: BlueprintAutomation[];
};

/** Default linear transitions: each stage → the next declared stage. */
export function linearTransitions(stages: BlueprintStage[]): BlueprintTransition[] {
  const edges: BlueprintTransition[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    edges.push({ fromStageKey: stages[i].key, toStageKey: stages[i + 1].key });
  }
  return edges;
}

/** Resolve a blueprint's transitions (explicit or linear fallback). */
export function blueprintTransitions(bp: WorkflowBlueprint): BlueprintTransition[] {
  return bp.transitions && bp.transitions.length > 0
    ? bp.transitions
    : linearTransitions(bp.stages);
}

/** Structural validation used by tests + the install action. Returns errors. */
export function validateBlueprint(bp: WorkflowBlueprint): string[] {
  const errors: string[] = [];
  if (!bp.key) errors.push("missing key");
  if (bp.stages.length === 0) errors.push(`${bp.key}: no stages`);

  const stageKeys = new Set<string>();
  for (const s of bp.stages) {
    if (stageKeys.has(s.key)) errors.push(`${bp.key}: duplicate stage key ${s.key}`);
    stageKeys.add(s.key);
    const stepKeys = new Set<string>();
    for (const st of s.steps) {
      if (stepKeys.has(st.key))
        errors.push(`${bp.key}/${s.key}: duplicate step key ${st.key}`);
      stepKeys.add(st.key);
    }
  }

  const initial = bp.stages.filter((s) => s.isInitial);
  if (initial.length !== 1)
    errors.push(`${bp.key}: expected exactly one initial stage, found ${initial.length}`);
  if (!bp.stages.some((s) => s.isTerminal))
    errors.push(`${bp.key}: no terminal stage`);

  for (const t of blueprintTransitions(bp)) {
    if (!stageKeys.has(t.fromStageKey))
      errors.push(`${bp.key}: transition from unknown stage ${t.fromStageKey}`);
    if (!stageKeys.has(t.toStageKey))
      errors.push(`${bp.key}: transition to unknown stage ${t.toStageKey}`);
  }
  for (const a of bp.automations ?? []) {
    if (a.stageKey && !stageKeys.has(a.stageKey))
      errors.push(`${bp.key}: automation '${a.name}' references unknown stage ${a.stageKey}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Small automation factories (keep blueprints terse + consistent).
// ---------------------------------------------------------------------------

function notifyOnEnter(stageKey: string, title: string): BlueprintAutomation {
  return {
    name: `Notify owner entering ${stageKey}`,
    trigger: "ON_STAGE_ENTER",
    action: "SEND_NOTIFICATION",
    stageKey,
    config: { title, mode: "OWNER" },
  };
}

function actionOnEnter(stageKey: string, title: string, dueOffsetHours = 72): BlueprintAutomation {
  return {
    name: `Create action for ${stageKey}`,
    trigger: "ON_STAGE_ENTER",
    action: "CREATE_ACTION",
    stageKey,
    config: { title, assigneeMode: "OWNER", dueOffsetHours },
  };
}

function escalateOverdue(): BlueprintAutomation {
  return {
    name: "Escalate when overdue",
    trigger: "ON_OVERDUE",
    action: "ESCALATE",
    config: { title: "Workflow overdue", escalateTo: "LEADERSHIP" },
  };
}

/** Marker automation: the engine auto-advances a stage once its exit criteria
 *  are met (checked after each step completes). ADVANCE_STAGE is never run as a
 *  side-effect — its presence flags the stage as auto-advancing. */
function autoAdvanceWhenReady(): BlueprintAutomation {
  return {
    name: "Auto-advance when stage criteria met",
    trigger: "ON_STEP_COMPLETE",
    action: "ADVANCE_STAGE",
  };
}

// ---------------------------------------------------------------------------
// THE BLUEPRINTS — 12 distinct business processes, all pure data.
// ---------------------------------------------------------------------------

export const WORKFLOW_BLUEPRINTS: WorkflowBlueprint[] = [
  {
    key: "partner-acquisition",
    name: "Partner Acquisition",
    description: "Research, reach out, meet, and confirm a community partner.",
    domain: "PARTNERS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    followUpCadenceHours: 120,
    escalateAfterHours: 168,
    stages: [
      {
        key: "research",
        name: "Research",
        isInitial: true,
        slaHours: 168,
        steps: [
          { key: "identify", name: "Identify target organizations", dueOffsetHours: 48 },
          { key: "qualify", name: "Qualify fit & decision-maker", dueOffsetHours: 96 },
        ],
      },
      {
        key: "outreach",
        name: "Outreach",
        slaHours: 168,
        steps: [
          { key: "first-contact", name: "Send first outreach", dueOffsetHours: 24 },
          { key: "follow-up", name: "Follow up after 5–7 days", isRequired: false, dueOffsetHours: 120 },
        ],
      },
      {
        key: "meeting",
        name: "Meeting",
        steps: [
          { key: "schedule", name: "Schedule partner meeting", kind: "MEETING", dueOffsetHours: 72 },
          { key: "log-outcome", name: "Log meeting outcome", dueOffsetHours: 24 },
        ],
      },
      {
        key: "confirmed",
        name: "Confirmed",
        isTerminal: true,
        steps: [
          { key: "logistics", name: "Confirm logistics in writing" },
          { key: "handoff", name: "Hand off to relationship maintenance", isRequired: false },
        ],
      },
    ],
    automations: [
      actionOnEnter("research", "Begin partner research"),
      notifyOnEnter("outreach", "Time to reach out to the partner"),
      {
        name: "Schedule the partner meeting",
        trigger: "ON_STAGE_ENTER",
        action: "CREATE_MEETING",
        stageKey: "meeting",
        config: { title: "Partner meeting", meetingType: "GENERIC", offsetHours: 72 },
      },
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "instructor-hiring",
    name: "Instructor Hiring",
    description: "Recruit, review, interview, decide, and onboard an instructor.",
    domain: "INSTRUCTORS",
    defaultOwnerSubtype: "HIRING_ADMIN",
    followUpCadenceHours: 72,
    escalateAfterHours: 96,
    stages: [
      {
        key: "recruiting",
        name: "Recruiting",
        isInitial: true,
        steps: [
          { key: "open-apps", name: "Open applications", dueOffsetHours: 24 },
          { key: "promote", name: "Promote the opening", isRequired: false, dueOffsetHours: 72 },
        ],
      },
      {
        key: "review",
        name: "Application Review",
        slaHours: 48,
        steps: [
          { key: "screen", name: "Screen application", kind: "APPROVAL", dueOffsetHours: 48 },
        ],
      },
      {
        key: "interview",
        name: "Interview",
        steps: [
          { key: "schedule", name: "Schedule interview", kind: "MEETING", dueOffsetHours: 72 },
          { key: "conduct", name: "Conduct interview", dueOffsetHours: 24 },
        ],
      },
      {
        key: "decision",
        name: "Decision",
        slaHours: 24,
        steps: [{ key: "decide", name: "Record hiring decision", kind: "DECISION", dueOffsetHours: 24 }],
      },
      {
        key: "onboarding",
        name: "Onboarding",
        isTerminal: true,
        steps: [
          { key: "orientation", name: "Complete orientation" },
          { key: "assign", name: "Confirm class assignment" },
        ],
      },
    ],
    automations: [
      actionOnEnter("review", "Review the instructor application", 48),
      notifyOnEnter("interview", "Schedule the candidate interview"),
      actionOnEnter("decision", "Submit hiring decision", 24),
      notifyOnEnter("onboarding", "Begin instructor onboarding"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "volunteer-onboarding",
    name: "Volunteer Onboarding",
    description: "Welcome, train, and activate a new volunteer.",
    domain: "VOLUNTEERS",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 96,
    stages: [
      {
        key: "welcome",
        name: "Welcome",
        isInitial: true,
        steps: [
          { key: "intro", name: "Send welcome & expectations", dueOffsetHours: 24 },
          { key: "paperwork", name: "Collect paperwork", kind: "DOCUMENT", dueOffsetHours: 72 },
        ],
      },
      {
        key: "training",
        name: "Training",
        steps: [
          { key: "orientation", name: "Complete orientation", dueOffsetHours: 96 },
          { key: "shadow", name: "Shadow a session", isRequired: false, dueOffsetHours: 168 },
        ],
      },
      {
        key: "active",
        name: "Active",
        isTerminal: true,
        steps: [{ key: "first-assignment", name: "Confirm first assignment" }],
      },
    ],
    automations: [
      actionOnEnter("welcome", "Welcome the new volunteer", 24),
      notifyOnEnter("training", "Volunteer ready for training"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "student-advising",
    name: "Student Advising",
    description: "Intake, plan, and follow up on a student advising case.",
    domain: "STUDENTS",
    defaultOwnerRole: "MENTOR",
    followUpCadenceHours: 168,
    stages: [
      {
        key: "intake",
        name: "Intake",
        isInitial: true,
        steps: [
          { key: "gather", name: "Gather student goals & context", dueOffsetHours: 72 },
        ],
      },
      {
        key: "plan",
        name: "Plan",
        steps: [
          { key: "build-plan", name: "Build advising plan", dueOffsetHours: 96 },
          { key: "review", name: "Review plan with student", kind: "MEETING", dueOffsetHours: 120 },
        ],
      },
      {
        key: "follow-up",
        name: "Follow-up",
        isTerminal: true,
        steps: [
          { key: "checkin", name: "Schedule first check-in", isRequired: false },
          { key: "close", name: "Close or recur the case" },
        ],
      },
    ],
    automations: [
      actionOnEnter("plan", "Build the advising plan", 96),
      {
        name: "Schedule follow-up check-in",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "follow-up",
        config: { offsetHours: 336 },
      },
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "program-launch",
    name: "Program Launch",
    description: "Take a program from proposal to live with publicity and readiness.",
    domain: "PROGRAMS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    escalateAfterHours: 168,
    stages: [
      {
        key: "proposal",
        name: "Proposal",
        isInitial: true,
        steps: [
          { key: "define", name: "Define program scope", dueOffsetHours: 72 },
          { key: "approve", name: "Get program approval", kind: "APPROVAL", dueOffsetHours: 120 },
        ],
      },
      {
        key: "setup",
        name: "Setup",
        steps: [
          { key: "staff", name: "Assign instructors", dueOffsetHours: 96 },
          { key: "schedule", name: "Set schedule & location", dueOffsetHours: 96 },
          { key: "publish", name: "Publish listing", dueOffsetHours: 120 },
        ],
      },
      {
        key: "recruit",
        name: "Recruit",
        slaHours: 240,
        steps: [
          { key: "advertise", name: "Advertise the program", dueOffsetHours: 48 },
          { key: "enroll", name: "Reach enrollment target", isRequired: false },
        ],
      },
      {
        key: "live",
        name: "Live",
        isTerminal: true,
        steps: [{ key: "kickoff", name: "Run first session" }],
      },
    ],
    automations: [
      actionOnEnter("setup", "Set up the program", 96),
      notifyOnEnter("recruit", "Begin recruitment & advertising"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "chapter-launch",
    name: "Chapter Launch",
    description: "Stand up a new chapter from approval to first live class.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 168,
    escalateAfterHours: 336,
    stages: [
      {
        key: "approved",
        name: "Approved",
        isInitial: true,
        steps: [
          { key: "president", name: "Confirm chapter president", dueOffsetHours: 72 },
          { key: "plan", name: "Submit launch plan", kind: "DOCUMENT", dueOffsetHours: 168 },
        ],
      },
      {
        key: "buildout",
        name: "Buildout",
        steps: [
          { key: "partners", name: "Secure first partner", dueOffsetHours: 336 },
          { key: "instructors", name: "Recruit founding instructors", dueOffsetHours: 336 },
          { key: "curriculum", name: "Approve first curriculum", kind: "APPROVAL", dueOffsetHours: 336 },
        ],
      },
      {
        key: "readiness",
        name: "Launch Readiness",
        slaHours: 168,
        steps: [
          { key: "classes", name: "Publish first classes" },
          { key: "enroll", name: "Confirm enrollment" },
        ],
      },
      {
        key: "active",
        name: "Active",
        isTerminal: true,
        steps: [{ key: "first-class", name: "Run first class" }],
      },
    ],
    automations: [
      actionOnEnter("buildout", "Build out the chapter", 168),
      notifyOnEnter("readiness", "Verify launch readiness"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "curriculum-approval",
    name: "Curriculum Approval",
    description: "Two-stage curriculum review: chapter review then global approval.",
    domain: "CURRICULUM",
    defaultOwnerSubtype: "CONTENT_ADMIN",
    escalateAfterHours: 96,
    stages: [
      {
        key: "submission",
        name: "Submission",
        isInitial: true,
        steps: [{ key: "submit", name: "Submit curriculum", kind: "DOCUMENT", dueOffsetHours: 24 }],
      },
      {
        key: "cp-review",
        name: "Chapter Review",
        slaHours: 48,
        steps: [{ key: "cp-approve", name: "Chapter president review", kind: "APPROVAL", dueOffsetHours: 48 }],
      },
      {
        key: "global-review",
        name: "Global Review",
        slaHours: 72,
        steps: [{ key: "global-approve", name: "Global content review", kind: "APPROVAL", dueOffsetHours: 72 }],
      },
      {
        key: "approved",
        name: "Approved",
        isTerminal: true,
        steps: [{ key: "publish", name: "Publish to catalog" }],
      },
    ],
    automations: [
      actionOnEnter("cp-review", "Chapter review of curriculum", 48),
      actionOnEnter("global-review", "Global review of curriculum", 72),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "board-preparation",
    name: "Board Preparation",
    description: "Assemble, review, and distribute a board meeting packet.",
    domain: "GOVERNANCE",
    defaultOwnerSubtype: "SUPER_ADMIN",
    stages: [
      {
        key: "assemble",
        name: "Assemble",
        isInitial: true,
        steps: [
          { key: "agenda", name: "Draft agenda", dueOffsetHours: 96 },
          { key: "metrics", name: "Collect metrics & roll-ups", dueOffsetHours: 96 },
        ],
      },
      {
        key: "review",
        name: "Review",
        steps: [{ key: "leadership-review", name: "Leadership review of packet", kind: "APPROVAL", dueOffsetHours: 48 }],
      },
      {
        key: "distribute",
        name: "Distribute",
        steps: [{ key: "send", name: "Distribute packet to board", dueOffsetHours: 24 }],
      },
      {
        key: "meeting",
        name: "Meeting",
        isTerminal: true,
        steps: [
          { key: "hold", name: "Hold board meeting", kind: "MEETING" },
          { key: "minutes", name: "Record decisions & minutes" },
        ],
      },
    ],
    automations: [
      actionOnEnter("assemble", "Assemble the board packet", 96),
      notifyOnEnter("distribute", "Distribute the board packet"),
      {
        name: "Hold the board meeting",
        trigger: "ON_STAGE_ENTER",
        action: "CREATE_MEETING",
        stageKey: "meeting",
        config: { title: "Board meeting", meetingType: "GENERIC", offsetHours: 48 },
      },
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "mentorship",
    name: "Mentorship Cycle",
    description: "Match, kick off, run monthly reviews, and close a mentorship.",
    domain: "MENTORSHIP",
    defaultOwnerSubtype: "MENTORSHIP_ADMIN",
    followUpCadenceHours: 336,
    stages: [
      {
        key: "match",
        name: "Match",
        isInitial: true,
        steps: [{ key: "pair", name: "Pair mentor & mentee", dueOffsetHours: 72 }],
      },
      {
        key: "kickoff",
        name: "Kickoff",
        steps: [
          { key: "goals", name: "Set goals", dueOffsetHours: 96 },
          { key: "first-meeting", name: "Hold kickoff meeting", kind: "MEETING", dueOffsetHours: 120 },
        ],
      },
      {
        key: "cycle",
        name: "Active Cycle",
        slaHours: 720,
        steps: [
          { key: "monthly-review", name: "Complete monthly review", kind: "APPROVAL" },
          { key: "checkins", name: "Log check-ins", isRequired: false },
        ],
      },
      {
        key: "closed",
        name: "Closed",
        isTerminal: true,
        steps: [{ key: "wrap", name: "Final review & wrap-up" }],
      },
    ],
    automations: [
      notifyOnEnter("kickoff", "Kick off the mentorship"),
      {
        name: "Schedule monthly review",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "cycle",
        config: { offsetHours: 720 },
      },
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "event-planning",
    name: "Event Planning",
    description: "Plan, promote, run, and debrief an event.",
    domain: "EVENTS",
    defaultOwnerRole: "STAFF",
    escalateAfterHours: 168,
    stages: [
      {
        key: "plan",
        name: "Plan",
        isInitial: true,
        steps: [
          { key: "concept", name: "Define event concept & budget", dueOffsetHours: 96 },
          { key: "venue", name: "Secure venue & date", dueOffsetHours: 168 },
        ],
      },
      {
        key: "promote",
        name: "Promote",
        slaHours: 240,
        steps: [
          { key: "publicize", name: "Publicize the event", dueOffsetHours: 48 },
          { key: "rsvp", name: "Track RSVPs", isRequired: false },
        ],
      },
      {
        key: "run",
        name: "Run",
        steps: [{ key: "execute", name: "Run the event", kind: "MEETING" }],
      },
      {
        key: "debrief",
        name: "Debrief",
        isTerminal: true,
        steps: [{ key: "retro", name: "Debrief & capture learnings" }],
      },
    ],
    automations: [
      actionOnEnter("plan", "Plan the event", 96),
      notifyOnEnter("promote", "Begin event promotion"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "grant-application",
    name: "Grant Application",
    description: "Identify, draft, submit, and report on a grant.",
    domain: "FUNDRAISING",
    defaultOwnerSubtype: "LEADERSHIP",
    escalateAfterHours: 96,
    stages: [
      {
        key: "identify",
        name: "Identify",
        isInitial: true,
        steps: [
          { key: "find", name: "Identify grant & eligibility", dueOffsetHours: 96 },
          { key: "fit", name: "Confirm fit & decision to apply", kind: "DECISION", dueOffsetHours: 120 },
        ],
      },
      {
        key: "draft",
        name: "Draft",
        slaHours: 240,
        steps: [
          { key: "narrative", name: "Write narrative", kind: "DOCUMENT", dueOffsetHours: 168 },
          { key: "budget", name: "Prepare budget", kind: "DOCUMENT", dueOffsetHours: 168 },
          { key: "review", name: "Internal review", kind: "APPROVAL", dueOffsetHours: 216 },
        ],
      },
      {
        key: "submit",
        name: "Submit",
        steps: [{ key: "send", name: "Submit application", dueOffsetHours: 24 }],
      },
      {
        key: "report",
        name: "Outcome & Report",
        isTerminal: true,
        steps: [
          { key: "outcome", name: "Record outcome" },
          { key: "report", name: "File grant report", isRequired: false },
        ],
      },
    ],
    automations: [
      actionOnEnter("draft", "Draft the grant application", 168),
      notifyOnEnter("submit", "Submit the grant application"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "fundraising-campaign",
    name: "Fundraising Campaign",
    description: "Plan, launch, run, and close a fundraising campaign.",
    domain: "FUNDRAISING",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 168,
    stages: [
      {
        key: "plan",
        name: "Plan",
        isInitial: true,
        steps: [
          { key: "goal", name: "Set goal & theme", dueOffsetHours: 96 },
          { key: "assets", name: "Prepare assets", kind: "DOCUMENT", dueOffsetHours: 168 },
        ],
      },
      {
        key: "launch",
        name: "Launch",
        steps: [{ key: "go-live", name: "Launch the campaign", dueOffsetHours: 24 }],
      },
      {
        key: "run",
        name: "Run",
        slaHours: 480,
        steps: [
          { key: "push", name: "Run donor pushes", isRequired: false },
          { key: "track", name: "Track toward goal" },
        ],
      },
      {
        key: "close",
        name: "Close",
        isTerminal: true,
        steps: [
          { key: "thank", name: "Thank donors" },
          { key: "report", name: "Report results" },
        ],
      },
    ],
    automations: [
      actionOnEnter("plan", "Plan the fundraising campaign", 96),
      notifyOnEnter("launch", "Launch the campaign"),
      {
        name: "Schedule progress follow-up",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "run",
        config: { offsetHours: 168 },
      },
      autoAdvanceWhenReady(),
    ],
  },
];

export function blueprintByKey(key: string): WorkflowBlueprint | undefined {
  return WORKFLOW_BLUEPRINTS.find((b) => b.key === key);
}
