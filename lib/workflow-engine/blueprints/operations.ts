// ============================================================================
// Universal Workflow Engine — blueprint catalog: Operations & Fundraising
// ============================================================================

import { actionOnEnter, escalateOverdue, autoAdvanceWhenReady, notifyOnEnter } from "./helpers";
import type { WorkflowBlueprint } from "./types";

export const OPERATIONS_BLUEPRINTS: WorkflowBlueprint[] = [
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
