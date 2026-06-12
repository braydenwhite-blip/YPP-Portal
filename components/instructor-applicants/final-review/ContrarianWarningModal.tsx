"use client";

/**
 * Pre-pre-confirm step when the chair's chosen action conflicts with reviewer
 * consensus or with the readiness signals. (§8.6)
 */

import type { ChairDecisionAction } from "@prisma/client";
import type { ContrarianSignal } from "@/lib/contrarian-signals";
import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import { AlertTriangleIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "approve",
  APPROVE_WITH_CONDITIONS: "approve with conditions",
  REJECT: "reject",
  HOLD: "hold",
  WAITLIST: "waitlist",
  REQUEST_INFO: "request information",
  REQUEST_SECOND_INTERVIEW: "send to second interview",
};

export interface ContrarianWarningModalProps {
  open: boolean;
  signals: ContrarianSignal[];
  action: ChairDecisionAction;
  onCancel: () => void;
  onContinue: () => void;
}

export default function ContrarianWarningModal({
  open,
  signals,
  action,
  onCancel,
  onContinue,
}: ContrarianWarningModalProps) {
  return (
    <ModalV2
      open={open}
      onClose={onCancel}
      role="alertdialog"
      labelledBy="contrarian-title"
      size="sm"
      accent="warning"
      motionKey="contrarian"
      className="max-w-[480px] gap-0 p-[22px]"
    >
      <div className="inline-flex items-center gap-2 text-warning-700">
        <AlertTriangleIcon size={22} />
        <h2 id="contrarian-title" className="m-0 text-[18px] font-bold text-ink">
          Your decision conflicts with reviewer feedback
        </h2>
      </div>
      <p className="mt-2.5 text-[13px] text-ink-muted">
        You&apos;re about to {ACTION_LABEL[action]} despite the following signals:
      </p>
      <ul className="mb-4 mt-2.5 list-none p-0">
        {signals.map((signal) => (
          <li
            key={signal.kind}
            className="mb-2 rounded-[10px] bg-warning-100 px-3 py-2.5 text-[13px] text-warning-700"
          >
            <strong className="block">{signal.message}</strong>
            {signal.detail ? (
              <span className="mt-1 block text-[12px]">{signal.detail}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <ModalFooterV2>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Go back
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onContinue}
          className="border-warning-700 bg-warning-700 hover:bg-warning-700/90"
        >
          Continue to confirmation
        </Button>
      </ModalFooterV2>
    </ModalV2>
  );
}
