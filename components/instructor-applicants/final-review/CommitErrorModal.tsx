"use client";

/**
 * Validation-error surface for the cockpit. Replaces the inline error chip
 * from Phase 2D for `chairDecide()` validation rejections, with a
 * jump-to-field affordance keyed to the offending field. (§10.4)
 */

import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import { AlertTriangleIcon } from "./cockpit-icons";

export type CommitValidationField =
  | "rationale"
  | "rejectReasonCode"
  | "rejectFreeText"
  | "conditions";

export interface CommitErrorModalProps {
  open: boolean;
  code: string | null;
  message: string;
  field: CommitValidationField | null;
  fieldIndex?: number;
  onJumpToField: (field: CommitValidationField, fieldIndex?: number) => void;
  onDismiss: () => void;
}

const CODE_TITLE: Record<string, string> = {
  REJECT_REASON_REQUIRED: "Pick a reason code before rejecting.",
  RATIONALE_TOO_LONG: "Your rationale is over the 10 000 character limit.",
  CONDITIONS_REQUIRED: "Add at least one condition before approving with conditions.",
  CONDITION_LABEL_INVALID: "A condition is missing a label.",
  CONDITION_LABEL_TOO_LONG: "A condition label is too long.",
  CONDITION_OWNER_NOT_FOUND: "A condition owner couldn't be found.",
  TOO_MANY_CONDITIONS: "Conditions are capped at 10 — remove some before saving.",
  CONTRARIAN_OVERRIDE_MISSING: "Acknowledge the warning before continuing.",
  VALIDATION: "We couldn't save this decision.",
};

export default function CommitErrorModal(props: CommitErrorModalProps) {
  const title =
    (props.code && CODE_TITLE[props.code]) || "We couldn't save this decision.";

  return (
    <ModalV2
      open={props.open}
      onClose={props.onDismiss}
      size="sm"
      accent="warning"
      role="alertdialog"
      labelledBy="commit-err-title"
      motionKey="commit-err"
      className="max-w-[460px]"
    >
      <div className="flex items-center gap-2 text-warning-700">
        <AlertTriangleIcon size={20} />
        <h2 id="commit-err-title" className="m-0 text-[17px] text-ink">
          {title}
        </h2>
      </div>
      <p className="m-0 text-[13px] text-ink-muted">{props.message}</p>
      <ModalFooterV2>
        <Button variant="secondary" size="sm" onClick={props.onDismiss}>
          Cancel
        </Button>
        {props.field ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => props.field && props.onJumpToField(props.field, props.fieldIndex)}
            className="bg-warning-700 hover:bg-warning-700/90"
          >
            Fix {fieldLabel(props.field, props.fieldIndex)}
          </Button>
        ) : null}
      </ModalFooterV2>
    </ModalV2>
  );
}

function fieldLabel(field: CommitValidationField, idx?: number): string {
  switch (field) {
    case "rationale":
      return "rationale";
    case "rejectReasonCode":
      return "reason code";
    case "rejectFreeText":
      return "rejection text";
    case "conditions":
      return idx !== undefined ? `condition #${idx + 1}` : "conditions";
  }
}
