"use client";

/**
 * Sticky decision dock. Holds the rationale composer on the left and the
 * adaptive action row on the right. §7.2 of the redesign plan.
 *
 * The dock is purely the orchestrator — actual commit happens upstream via
 * `useCommitDecision`. The dock surfaces `pendingIntent` so the cockpit
 * shell can mount the confirm modal at root (focus-trap + backdrop).
 */

import { motion } from "framer-motion";
import type { ChairDecisionAction } from "@prisma/client";
import type { FinalReviewWarning } from "@/lib/final-review-warnings";
import DraftRationaleField from "./DraftRationaleField";
import DecisionButtons from "./DecisionButtons";
import DockRiskPreview from "./DockRiskPreview";

export interface DecisionDockProps {
  /** Sticky bottom bar (cockpit) vs embedded panel (applicant review tab). */
  variant?: "sticky" | "inline";
  applicationId: string;
  actorId: string;
  initialRationale: string;
  initialComparisonNotes: string;
  initialSavedAt: string | null;
  hasRedFlags: boolean;
  hasMajorityReject: boolean;
  hasMixedConsensus: boolean;
  rationale: string;
  comparisonNotes: string;
  pendingAction: ChairDecisionAction | null;
  pending: boolean;
  readOnly?: boolean;
  /** Overrides the default read-only copy (e.g. the non-Chair lock notice). */
  readOnlyMessage?: string;
  warnings?: FinalReviewWarning[];
  acknowledgements?: Record<string, boolean>;
  onOpenRiskPreview?: () => void;
  onDraftChange: (draft: { rationale: string; comparisonNotes: string }) => void;
  onChoose: (action: ChairDecisionAction) => void;
  exposeQuoteHandler?: (handler: ((quote: string) => void) | null) => void;
}

export default function DecisionDock(props: DecisionDockProps) {
  const {
    variant = "sticky",
    applicationId,
    actorId,
    initialRationale,
    initialComparisonNotes,
    initialSavedAt,
    hasRedFlags,
    hasMajorityReject,
    hasMixedConsensus,
    rationale,
    pendingAction,
    pending,
    readOnly,
    readOnlyMessage,
    onDraftChange,
    onChoose,
    exposeQuoteHandler,
  } = props;

  const shellClass =
    variant === "inline"
      ? "rounded-[12px] border border-line-soft bg-surface-soft px-4 py-4"
      : "sticky bottom-0 z-20 border-t border-line bg-surface px-6 py-4 shadow-[0_-8px_32px_rgb(59_15_110/0.10),0_-2px_8px_rgb(59_15_110/0.06)]";

  if (readOnly) {
    return (
      <div
        className={`${shellClass} text-center text-[13px] text-ink-muted`}
        role="region"
        aria-label="Decision dock (read-only)"
      >
        {readOnlyMessage ??
          "This application was already decided. The dock is read-only — see the audit trail above."}
      </div>
    );
  }

  const draftMeetsRequirements =
    pendingAction === "REJECT" ? rationale.trim().length > 0 : true;

  const layoutClass =
    variant === "inline"
      ? "flex flex-col gap-5 2xl:flex-row 2xl:items-start"
      : "flex flex-col gap-5 lg:flex-row lg:items-start";

  const actionsClass =
    variant === "inline"
      ? "w-full shrink-0 2xl:w-[min(100%,20rem)]"
      : "w-full shrink-0 lg:w-[min(100%,20rem)]";

  const content = (
    <>
      <div className="min-w-0 w-full flex-1">
        <DraftRationaleField
          applicationId={applicationId}
          actorId={actorId}
          initialRationale={initialRationale}
          initialComparisonNotes={initialComparisonNotes}
          initialSavedAt={initialSavedAt}
          onChange={onDraftChange}
          exposeQuoteHandler={exposeQuoteHandler}
          requiredForIntent={pendingAction}
        />
      </div>
      <div className={`flex flex-col gap-2 ${actionsClass}`}>
        {props.warnings && props.acknowledgements ? (
          <DockRiskPreview
            warnings={props.warnings}
            acknowledgements={props.acknowledgements}
            onClick={props.onOpenRiskPreview}
          />
        ) : null}
        <DecisionButtons
          hasRedFlags={hasRedFlags}
          hasMajorityReject={hasMajorityReject}
          hasMixedConsensus={hasMixedConsensus}
          draftMeetsRequirements={draftMeetsRequirements}
          pending={pending}
          pendingAction={pendingAction}
          className={variant === "inline" ? "2xl:flex 2xl:flex-col" : "lg:flex lg:flex-col"}
          onChoose={(action) => {
            if (action === "REJECT" && rationale.trim().length === 0) {
              onChoose(action);
              return;
            }
            if (!draftMeetsRequirements) return;
            onChoose(action);
          }}
        />
      </div>
    </>
  );

  if (variant === "inline") {
    return (
      <div
        className={`${shellClass} ${layoutClass}`}
        role="region"
        aria-label="Decision dock"
      >
        {content}
      </div>
    );
  }

  return (
    <motion.div
      className={`${shellClass} ${layoutClass}`}
      role="region"
      aria-label="Decision dock"
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      {content}
    </motion.div>
  );
}
