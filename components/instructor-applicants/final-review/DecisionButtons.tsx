"use client";

/**
 * Adaptive action row. Implements the state machine from §1.7 — primary
 * button shifts based on red flags, majority-reject signal, or split
 * consensus. Limited to the five existing ChairDecisionAction values until
 * APPROVE_WITH_CONDITIONS / WAITLIST land in a follow-up Prisma migration.
 */

import type { ChairDecisionAction } from "@prisma/client";
import ActionButton, { type ActionTone } from "./ActionButton";
import {
  CheckIcon,
  XIcon,
  PauseIcon,
  ClockIcon,
  HelpCircleIcon,
  RotateCwIcon,
} from "./cockpit-icons";

export interface DecisionButtonsProps {
  hasRedFlags: boolean;
  hasMajorityReject: boolean;
  hasMixedConsensus: boolean;
  draftMeetsRequirements: boolean;
  pending: boolean;
  pendingAction: ChairDecisionAction | null;
  onChoose: (action: ChairDecisionAction) => void;
}

interface ActionConfig {
  action: ChairDecisionAction;
  label: string;
  description: string;
  icon: (props: { size?: number }) => JSX.Element;
  baseTone: ActionTone;
}

const CONFIG: ActionConfig[] = [
  {
    action: "APPROVE",
    label: "Approve",
    description:
      "Approve. Grants instructor role, sends approval email, and moves the applicant to APPROVED.",
    icon: CheckIcon,
    baseTone: "primary",
  },
  {
    action: "APPROVE_WITH_CONDITIONS",
    label: "Approve w/ conditions",
    description:
      "Approve with conditions. Grants instructor role and records the conditions on the audit chain.",
    icon: CheckIcon,
    baseTone: "primary-alt",
  },
  {
    action: "WAITLIST",
    label: "Waitlist",
    description:
      "Waitlist the applicant. Sets status to WAITLISTED and removes them from the chair queue.",
    icon: ClockIcon,
    baseTone: "secondary",
  },
  {
    action: "HOLD",
    label: "Hold",
    description: "Hold. Sets status to ON_HOLD without notifying the applicant.",
    icon: PauseIcon,
    baseTone: "secondary",
  },
  {
    action: "REQUEST_INFO",
    label: "Request info",
    description:
      "Request info. Sends a follow-up email asking the applicant for more information.",
    icon: HelpCircleIcon,
    baseTone: "secondary",
  },
  {
    action: "REQUEST_SECOND_INTERVIEW",
    label: "Second interview",
    description:
      "Request second interview. Returns the applicant to interview scheduling for round 2.",
    icon: RotateCwIcon,
    baseTone: "secondary",
  },
  {
    action: "REJECT",
    label: "Reject",
    description:
      "Reject. Sets status to REJECTED and sends a rejection email using the chosen reason code.",
    icon: XIcon,
    baseTone: "destructive",
  },
];

export default function DecisionButtons({
  hasRedFlags,
  hasMajorityReject,
  hasMixedConsensus,
  draftMeetsRequirements,
  pending,
  pendingAction,
  onChoose,
}: DecisionButtonsProps) {
  const rejectIsPrimary = hasRedFlags || hasMajorityReject;
  const conditionalIsPrimary = !rejectIsPrimary && hasMixedConsensus;

  function toneFor(cfg: ActionConfig): ActionTone {
    if (cfg.action === "APPROVE") {
      if (rejectIsPrimary) return "secondary";
      if (conditionalIsPrimary) return "primary-alt";
      return "primary";
    }
    if (cfg.action === "APPROVE_WITH_CONDITIONS") {
      if (rejectIsPrimary) return "secondary";
      if (conditionalIsPrimary) return "primary";
      return "primary-alt";
    }
    if (cfg.action === "REJECT") {
      return rejectIsPrimary ? "primary" : "destructive";
    }
    return cfg.baseTone;
  }

  return (
    <div
      className="decision-buttons"
      role="group"
      aria-label="Chair decisions"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}
    >
      {CONFIG.map((cfg) => {
        const tone = toneFor(cfg);
        const isLoading = pending && pendingAction === cfg.action;
        const isDisabled = pending && pendingAction !== cfg.action;
        const draftBlock =
          (cfg.action === "REJECT" || cfg.action === "REQUEST_INFO") &&
          !draftMeetsRequirements;
        return (
          <ActionButton
            key={cfg.action}
            action={cfg.action}
            tone={tone}
            icon={cfg.icon}
            label={cfg.label}
            description={cfg.description}
            disabled={isDisabled || draftBlock}
            loading={isLoading}
            onClick={() => onChoose(cfg.action)}
          />
        );
      })}
    </div>
  );
}
