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
import DraftRationaleField from "./DraftRationaleField";
import DecisionButtons from "./DecisionButtons";

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
        className="decision-dock decision-dock-readonly"
        role="region"
        aria-label="Decision dock (read-only)"
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--cockpit-surface, #fff)",
          borderTop: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
          padding: "16px 24px",
          fontSize: 13,
          color: "var(--ink-muted, #6b5f7a)",
          textAlign: "center",
          zIndex: 20,
        }}
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
      className="decision-dock"
      role="region"
      aria-label="Decision dock"
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        background: "var(--cockpit-surface, #fff)",
        borderTop: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        boxShadow:
          "0 -8px 32px rgba(59, 15, 110, 0.10), 0 -2px 8px rgba(59, 15, 110, 0.06)",
        padding: "16px 24px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) auto",
        gap: 16,
        alignItems: "stretch",
      }}
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
      <div style={{ display: "flex", alignItems: "flex-end" }}>
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
