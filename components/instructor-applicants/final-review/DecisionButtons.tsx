"use client";

/**
 * Adaptive action row. Implements the state machine from §1.7 — primary
 * button shifts based on red flags, majority-reject signal, or split
 * consensus.
 */

import type { ChairDecisionAction } from "@prisma/client";
import { cn } from "@/components/ui-v2/cn";
import ActionButton, { type ActionTone } from "./ActionButton";
import {
  CheckIcon,
  XIcon,
  PauseIcon,
  ClockIcon,
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
  className?: string;
  /** When set, only these actions are shown (staff simplified flow). */
  allowedActions?: ChairDecisionAction[];
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
      "Approve. Grants the role, sends approval email, and marks the application accepted.",
    icon: CheckIcon,
    baseTone: "primary",
  },
  {
    action: "APPROVE_WITH_CONDITIONS",
    label: "Approve w/ conditions",
    description:
      "Approve with conditions. Grants the role and records the conditions on the decision.",
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
      "Reject. Sets status to REJECTED and sends a rejection email.",
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
  className,
  allowedActions,
}: DecisionButtonsProps) {
  const rejectIsPrimary = hasRedFlags || hasMajorityReject;
  const conditionalIsPrimary = !rejectIsPrimary && hasMixedConsensus;
  const configs = allowedActions?.length
    ? CONFIG.filter((cfg) => allowedActions.includes(cfg.action))
    : CONFIG;

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
      className={cn(
        "decision-buttons grid w-full grid-cols-2 gap-2 sm:grid-cols-3 [&_button]:w-full",
        className
      )}
      role="group"
      aria-label="Decisions"
    >
      {configs.map((cfg) => {
        const tone = toneFor(cfg);
        const isLoading = pending && pendingAction === cfg.action;
        const isDisabled = pending && pendingAction !== cfg.action;
        return (
          <ActionButton
            key={cfg.action}
            action={cfg.action}
            tone={tone}
            icon={cfg.icon}
            label={cfg.label}
            description={cfg.description}
            disabled={isDisabled}
            loading={isLoading}
            onClick={() => onChoose(cfg.action)}
          />
        );
      })}
    </div>
  );
}
