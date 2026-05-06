"use client";

import { useCallback, useRef, useState } from "react";
import type { ChairDecisionAction } from "@prisma/client";
import { chairDecide, type ChairDecideResult } from "@/lib/instructor-application-actions";

/**
 * `useCommitDecision` — encapsulates the chair-decide commit lifecycle for
 * the Final Review Cockpit per `FINAL_REVIEW_REDESIGN_PLAN.md` §9.2 and §10.5.
 *
 * Behaviour:
 *   - Generates a stable idempotency key per (application, action) pair so
 *     retries replay rather than double-commit.
 *   - Auto-retries `DEADLOCK_DETECTED` up to 3 times with exponential backoff
 *     (400ms / 800ms / 1600ms) — surfaces the `DeadlockRetryToast` while
 *     attempts are in flight; only flips to `error` if all three fail.
 *   - Detects client-side network drops (`AbortError`/timeout) and marks them
 *     so the cockpit can render `NetworkRecoveryBanner` instead of a generic
 *     error.
 *   - Routes structured server error codes to the right cockpit surface via
 *     `commitErrorKind` (sync_rollback, stale_click, validation, network).
 */

export type CommitErrorKind =
  | "validation"
  | "sync_rollback"
  | "stale_click"
  | "network_drop"
  | "unauthorized"
  | "deadlock_exhausted"
  | "unknown";

export interface CommitDecisionInput {
  applicationId: string;
  action: ChairDecisionAction;
  rationale: string;
  comparisonNotes: string;
  rejectReasonCode?: string;
  rejectFreeText?: string;
  conditions?: Array<{ id: string; label: string; source: "preset" | "custom"; presetId?: string }>;
  overrideWarnings?: boolean;
}

export type CommitDecisionState =
  | { status: "idle" }
  | { status: "pending"; startedAt: number; idempotencyKey: string; attempt: number }
  | { status: "retrying"; idempotencyKey: string; attempt: number; maxAttempts: number }
  | {
      status: "success";
      decidedAt: string;
      action: ChairDecisionAction;
      idempotencyKey: string;
    }
  | {
      status: "error";
      kind: CommitErrorKind;
      error: string;
      code: string | null;
      context: Record<string, unknown> | null;
      action: ChairDecisionAction;
      idempotencyKey: string;
      attemptedAt: string;
      canRetry: boolean;
    };

export interface UseCommitDecisionReturn {
  state: CommitDecisionState;
  commit: (input: CommitDecisionInput) => Promise<void>;
  retryLast: () => Promise<void>;
  reset: () => void;
}

const VALIDATION_CODES = new Set([
  "REJECT_REASON_REQUIRED",
  "RATIONALE_TOO_LONG",
  "CONDITIONS_REQUIRED",
  "CONDITION_LABEL_INVALID",
  "CONDITION_LABEL_TOO_LONG",
  "CONDITION_OWNER_NOT_FOUND",
  "TOO_MANY_CONDITIONS",
  "CONTRARIAN_OVERRIDE_MISSING",
  "VALIDATION",
]);

const MAX_DEADLOCK_RETRIES = 3;

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function classifyError(code: string | null): CommitErrorKind {
  if (!code) return "unknown";
  if (code === "STATUS_CHANGED") return "stale_click";
  if (code === "SYNC_ROLLBACK") return "sync_rollback";
  if (code === "UNAUTHORIZED" || code === "APPLICATION_NOT_FOUND") return "unauthorized";
  if (code === "DEADLOCK_DETECTED") return "deadlock_exhausted";
  if (VALIDATION_CODES.has(code)) return "validation";
  return "unknown";
}

function isNetworkDrop(error: unknown): boolean {
  if (!error) return false;
  if (typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  if (name === "AbortError" || name === "TimeoutError") return true;
  const message = (error as { message?: string }).message ?? "";
  return /failed to fetch|network/i.test(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useCommitDecision(): UseCommitDecisionReturn {
  const [state, setState] = useState<CommitDecisionState>({ status: "idle" });
  const idempotencyKeyRef = useRef<string | null>(null);
  const lastActionRef = useRef<ChairDecisionAction | null>(null);
  const lastInputRef = useRef<CommitDecisionInput | null>(null);

  const reset = useCallback(() => {
    idempotencyKeyRef.current = null;
    lastActionRef.current = null;
    lastInputRef.current = null;
    setState({ status: "idle" });
  }, []);

  const runOnce = useCallback(
    async (
      input: CommitDecisionInput,
      key: string,
      attempt: number
    ): Promise<ChairDecideResult> => {
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
      if (input.action === "APPROVE_WITH_CONDITIONS" && input.conditions) {
        formData.set("conditions", JSON.stringify(input.conditions));
      }
      formData.set("attempt", String(attempt));
      return chairDecide(formData);
    },
    []
  );

  const commit = useCallback(
    async (input: CommitDecisionInput) => {
      if (lastActionRef.current && lastActionRef.current !== input.action) {
        idempotencyKeyRef.current = null;
      }
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = generateIdempotencyKey();
      }
      lastActionRef.current = input.action;
      lastInputRef.current = input;

      const key = idempotencyKeyRef.current;
      let attempt = 1;
      setState({ status: "pending", startedAt: Date.now(), idempotencyKey: key, attempt });

      try {
        let result = await runOnce(input, key, attempt);
        while (
          !result.success &&
          result.code === "DEADLOCK_DETECTED" &&
          attempt < MAX_DEADLOCK_RETRIES
        ) {
          attempt += 1;
          setState({
            status: "retrying",
            idempotencyKey: key,
            attempt,
            maxAttempts: MAX_DEADLOCK_RETRIES,
          });
          await delay(200 * 2 ** attempt);
          result = await runOnce(input, key, attempt);
        }
        if (result.success) {
          setState({
            status: "success",
            decidedAt: new Date().toISOString(),
            action: input.action,
            idempotencyKey: key,
          });
          return;
        }
        const code = result.code ?? null;
        const kind = classifyError(code);
        setState({
          status: "error",
          kind,
          error: result.error ?? "Could not record decision.",
          code,
          context: (result.context as Record<string, unknown> | undefined) ?? null,
          action: input.action,
          idempotencyKey: key,
          attemptedAt: new Date().toISOString(),
          canRetry:
            kind === "validation" ||
            kind === "sync_rollback" ||
            kind === "deadlock_exhausted" ||
            kind === "unknown",
        });
      } catch (error) {
        const network = isNetworkDrop(error);
        setState({
          status: "error",
          kind: network ? "network_drop" : "unknown",
          error:
            network
              ? "We couldn't confirm whether your decision saved."
              : error instanceof Error
                ? error.message
                : "Network error — try again.",
          code: null,
          context: null,
          action: input.action,
          idempotencyKey: key,
          attemptedAt: new Date().toISOString(),
          canRetry: true,
        });
      }
    },
    [runOnce]
  );

  const retryLast = useCallback(async () => {
    if (!lastInputRef.current) return;
    await commit(lastInputRef.current);
  }, [commit]);

  return { state, commit, retryLast, reset };
}
