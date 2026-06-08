"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ClassOutcomeStatus,
  ClassRepeatRecommendation,
} from "@prisma/client";
import { setClassAdminOutcome } from "@/lib/class-feedback-actions";
import {
  OUTCOME_STATUS_LABELS,
  OUTCOME_STATUS_ORDER,
  REPEAT_RECOMMENDATION_HINTS,
  REPEAT_RECOMMENDATION_LABELS,
  REPEAT_RECOMMENDATION_ORDER,
} from "@/lib/class-feedback-constants";

/**
 * Admin completion-outcome control on the admin class detail page. Records the
 * overall verdict, the repeat recommendation, an optional "got good feedback"
 * flag, and notes — all journaled to the offering timeline server-side.
 */
export function AdminOutcomeForm({
  offeringId,
  defaultStatus,
  defaultRepeat,
  defaultGotGoodFeedback,
  defaultNotes,
  recordedAt,
}: {
  offeringId: string;
  defaultStatus: ClassOutcomeStatus;
  defaultRepeat: ClassRepeatRecommendation | "";
  defaultGotGoodFeedback: boolean;
  defaultNotes: string;
  recordedAt?: Date | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ClassOutcomeStatus>(defaultStatus);
  const [repeat, setRepeat] = useState<ClassRepeatRecommendation | "">(defaultRepeat);
  const [gotGoodFeedback, setGotGoodFeedback] = useState(defaultGotGoodFeedback);
  const [notes, setNotes] = useState(defaultNotes);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(recordedAt ?? null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("offeringId", offeringId);
        fd.set("status", status);
        fd.set("repeatRecommendation", repeat);
        fd.set("gotGoodFeedback", gotGoodFeedback ? "true" : "false");
        fd.set("adminNotes", notes);
        await setClassAdminOutcome(fd);
        setSavedAt(new Date());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the outcome.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Overall outcome
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value as ClassOutcomeStatus)}
          style={{ fontSize: 13, marginTop: 4 }}
        >
          {OUTCOME_STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {OUTCOME_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Repeat recommendation
        <select
          className="input"
          value={repeat}
          onChange={(e) =>
            setRepeat(e.target.value as ClassRepeatRecommendation | "")
          }
          style={{ fontSize: 13, marginTop: 4 }}
        >
          <option value="">— Not set —</option>
          {REPEAT_RECOMMENDATION_ORDER.map((value) => (
            <option key={value} value={value}>
              {REPEAT_RECOMMENDATION_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      {repeat ? (
        <p style={{ margin: "-4px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
          {REPEAT_RECOMMENDATION_HINTS[repeat]}
        </p>
      ) : null}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={gotGoodFeedback}
          onChange={(e) => setGotGoodFeedback(e.target.checked)}
        />
        Flag as “got good feedback” (highlights it on the reports page)
      </label>

      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Notes (optional)
        <textarea
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why this outcome — context for the next planning cycle."
          style={{ fontSize: 13, marginTop: 4, resize: "vertical" }}
        />
      </label>

      {error && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          className="button primary"
          onClick={handleSubmit}
          disabled={isPending}
          style={{ fontSize: 13 }}
        >
          {isPending ? "Saving…" : "Save outcome"}
        </button>
        {savedAt ? (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Last recorded{" "}
            {new Date(savedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
