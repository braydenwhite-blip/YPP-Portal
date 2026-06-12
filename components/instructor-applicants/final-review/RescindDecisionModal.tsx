"use client";

/**
 * SUPER_ADMIN-only confirmation flow for rescinding the most recent chair
 * decision. Captures a required reason that lands in the audit timeline.
 * Wired to `rescindChairDecision()` server action.
 */

import { useEffect, useState, useTransition } from "react";
import type { ChairDecisionAction } from "@prisma/client";
import { useRouter } from "next/navigation";
import { rescindChairDecision } from "@/lib/instructor-application-actions";
import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import { AlertTriangleIcon } from "./cockpit-icons";

const ACTION_LABEL: Record<ChairDecisionAction, string> = {
  APPROVE: "Approval",
  APPROVE_WITH_CONDITIONS: "Approval with conditions",
  REJECT: "Rejection",
  HOLD: "Hold",
  WAITLIST: "Waitlist",
  REQUEST_INFO: "Info request",
  REQUEST_SECOND_INTERVIEW: "Second interview",
};

export interface RescindDecisionModalProps {
  open: boolean;
  applicationId: string;
  applicantName: string;
  decision: { action: ChairDecisionAction; decidedAt: string; chairName: string | null } | null;
  onCancel: () => void;
  onSuccess?: () => void;
}

export default function RescindDecisionModal(props: RescindDecisionModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!props.open) {
      setReason("");
      setError(null);
    }
  }, [props.open]);

  function handleSubmit() {
    if (reason.trim().length === 0) {
      setError("Add a rescind reason — it goes in the audit trail.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("applicationId", props.applicationId);
    formData.set("reason", reason);
    startTransition(async () => {
      const result = await rescindChairDecision(formData);
      if (!result.success) {
        setError(result.error ?? "Could not rescind the decision.");
        return;
      }
      props.onSuccess?.();
      props.onCancel();
      router.refresh();
    });
  }

  return (
    <ModalV2
      open={props.open}
      onClose={props.onCancel}
      locked={pending}
      size="md"
      accent="danger"
      labelledBy="rescind-title"
      motionKey="rescind"
      className="max-w-[520px]"
    >
      <div className="flex items-center gap-2 text-danger-700">
        <AlertTriangleIcon size={22} />
        <h2 id="rescind-title" className="m-0 text-[18px] text-ink">
          Rescind decision for {props.applicantName}
        </h2>
      </div>
      <p className="m-0 text-[13px] leading-normal text-ink-muted">
        {props.decision ? (
          <>
            This supersedes the prior <strong>{ACTION_LABEL[props.decision.action]}</strong>
            {props.decision.chairName ? <> by {props.decision.chairName}</> : null} from{" "}
            {new Date(props.decision.decidedAt).toLocaleDateString()}. The application returns
            to <strong>chair review</strong>; if the decision was an approval, the
            applicant&apos;s INSTRUCTOR role is revoked.
          </>
        ) : (
          "No active decision to rescind."
        )}
      </p>
      <label className="block text-[12px] font-semibold text-ink">
        Rescind reason (required, in audit trail)
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value.slice(0, 2000))}
          rows={4}
          placeholder="Why is this decision being rescinded? Be specific — this goes on the record."
          className="mt-1.5 w-full resize-y rounded-[10px] border border-line p-2.5 font-sans text-[13px]"
        />
        <span className="text-[11px] font-normal text-ink-muted">
          {reason.length} / 2 000
        </span>
      </label>
      {error ? (
        <p
          role="alert"
          className="m-0 rounded-[8px] bg-danger-100 p-2 text-[12px] text-danger-700"
        >
          {error}
        </p>
      ) : null}
      <ModalFooterV2>
        <Button variant="secondary" size="sm" onClick={props.onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleSubmit}
          disabled={pending || !props.decision || reason.trim().length === 0}
        >
          {pending ? "Rescinding…" : "Rescind decision"}
        </Button>
      </ModalFooterV2>
    </ModalV2>
  );
}
