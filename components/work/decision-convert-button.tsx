"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { convertDecisionToAction } from "@/lib/people-strategy/meetings-actions";

/**
 * One-click "Create action" on a decision that never became tracked work.
 * Calls the existing `convertDecisionToAction` server action (idempotent;
 * officer-gated server-side; preserves MEETING_DECISION provenance, the
 * meeting's related entity, and the decider as suggested owner), then
 * refreshes so the decision shows its linked action everywhere.
 */
export function DecisionConvertButton({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  return (
    <button
      type="button"
      disabled={state === "saving"}
      onClick={async () => {
        setState("saving");
        try {
          await convertDecisionToAction(decisionId);
          router.refresh();
          setState("idle");
        } catch {
          setState("error");
        }
      }}
      className="cursor-pointer rounded-[6px] border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold text-brand-700 hover:border-brand-300 hover:bg-brand-50 disabled:cursor-default disabled:opacity-60"
    >
      {state === "saving"
        ? "Creating…"
        : state === "error"
          ? "Couldn't create — retry"
          : "Create action"}
    </button>
  );
}
