"use client";

import { useCallback, useRef, useState } from "react";
import type { ChairDecisionAction } from "@prisma/client";
import { chairDecide } from "@/lib/instructor-application-actions";

/**
 * `useCommitDecision` — encapsulates the chair-decide commit lifecycle for
 * the Final Review Cockpit per `FINAL_REVIEW_REDESIGN_PLAN.md` §9.2.
 *
 * Behaviour:
 *   - Generates a stable idempotency key per (application, action) pair so
 *     retries replay rather than double-commit. The server-side idempotency
 *     table from §9.6 is a Phase 2D follow-up; the existing chairDecide()
 *     status guard already protects against accidental double-commits.
 *   - On success, exposes `decidedAt` and `nextApplicantId` so the cockpit
 *     can fire the post-decision toast and prefetch the next page.
 *   - On error, surfaces enough info for inline error rendering.
 */

export interface CommitDecisionInput {
  applicationId: string;
  action: ChairDecisionAction;
  rationale: string;
  comparisonNotes: string;
  rejectReasonCode?: string;
  rejectFreeText?: string;
  overrideWarnings?: boolean;
}

export type CommitDecisionState =
  | { status: "idle" }
  | { status: "pending"; startedAt: number; idempotencyKey: string }
  | {
      status: "success";
      decidedAt: string;
      action: ChairDecisionAction;
      idempotencyKey: string;
    }
  | {
      status: "error";
      error: string;
      action: ChairDecisionAction;
      canRetry: boolean;
    };

export interface UseCommitDecisionReturn {
  state: CommitDecisionState;
  commit: (input: CommitDecisionInput) => Promise<void>;
  reset: () => void;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useCommitDecision(): UseCommitDecisionReturn {
  const [state, setState] = useState<CommitDecisionState>({ status: "idle" });
  const idempotencyKeyRef = useRef<string | null>(null);
  const lastActionRef = useRef<ChairDecisionAction | null>(null);

  const reset = useCallback(() => {
    idempotencyKeyRef.current = null;
    lastActionRef.current = null;
    setState({ status: "idle" });
  }, []);

  const commit = useCallback(async (input: CommitDecisionInput) => {
    if (lastActionRef.current && lastActionRef.current !== input.action) {
      // Action changed — start a fresh idempotency window.
      idempotencyKeyRef.current = null;
    }
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
    lastActionRef.current = input.action;

    const key = idempotencyKeyRef.current;
    setState({ status: "pending", startedAt: Date.now(), idempotencyKey: key });

    try {
      const formData = new FormData();
      formData.set("applicationId", input.applicationId);
      formData.set("action", input.action);
      let rationaleForServer = input.rationale;
      if (input.action === "REJECT" && input.rejectReasonCode) {
        const free = input.rejectFreeText?.trim() ?? input.rationale.trim();
        rationaleForServer = `[${input.rejectReasonCode}] ${free}`;
      }
      formData.set("rationale", rationaleForServer);
      formData.set("comparisonNotes", input.comparisonNotes);
      formData.set("idempotencyKey", key);
      if (input.overrideWarnings) {
        formData.set("overrideWarnings", "true");
      }

      const result = await chairDecide(formData);
      if (!result.success) {
        setState({
          status: "error",
          error: result.error ?? "Could not record decision.",
          action: input.action,
          canRetry: true,
        });
        return;
      }
      setState({
        status: "success",
        decidedAt: new Date().toISOString(),
        action: input.action,
        idempotencyKey: key,
      });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Network error — try again.",
        action: input.action,
        canRetry: true,
      });
    }
  }, []);

  return { state, commit, reset };
}
