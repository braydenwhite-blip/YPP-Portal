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
  warnings?: FinalReviewWarning[];
  acknowledgements?: Record<string, boolean>;
  onOpenRiskPreview?: () => void;
  onDraftChange: (draft: { rationale: string; comparisonNotes: string }) => void;
  onChoose: (action: ChairDecisionAction) => void;
  exposeQuoteHandler?: (handler: ((quote: string) => void) | null) => void;
}

export default function DecisionDock(props: DecisionDockProps) {
  const {
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
    onDraftChange,
    onChoose,
    exposeQuoteHandler,
  } = props;

  if (readOnly) {
    return (
      <div
        className="sticky bottom-0 z-20 border-t border-line bg-surface px-6 py-4 text-center text-[13px] text-ink-muted"
        role="region"
        aria-label="Decision dock (read-only)"
      >
        This application was already decided. The dock is read-only — see the audit trail above.
      </div>
    );
  }

  const draftMeetsRequirements =
    pendingAction === "REJECT" || pendingAction === "REQUEST_INFO"
      ? rationale.trim().length > 0
      : true;

  return (
    <motion.div
      className="sticky bottom-0 z-20 grid grid-cols-1 items-stretch gap-4 border-t border-line bg-surface px-6 py-4 shadow-[0_-8px_32px_rgb(59_15_110/0.10),0_-2px_8px_rgb(59_15_110/0.06)] lg:grid-cols-[minmax(0,1.1fr)_auto]"
      role="region"
      aria-label="Decision dock"
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
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
          draftMeetsRequirements={true}
          pending={pending}
          pendingAction={pendingAction}
          onChoose={(action) => {
            // Soft validation handled by the confirm modal; the dock just
            // surfaces the intent. The modal blocks Confirm until required
            // text is present. We pre-flight required fields here too so a
            // chair can't open the modal in an invalid state.
            if ((action === "REJECT" || action === "REQUEST_INFO") && rationale.trim().length === 0) {
              onChoose(action);
              return;
            }
            if (!draftMeetsRequirements) return;
            onChoose(action);
          }}
        />
      </div>
    </motion.div>
  );
}
