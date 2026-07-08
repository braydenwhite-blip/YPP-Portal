"use client";

import { useState } from "react";
import { proposeGRGoalChange } from "@/lib/gr-actions";

type GoalOption = {
  id: string;
  title: string;
  timePhase: string;
};

type Props = {
  documentId: string;
  goals: GoalOption[];
  sourceReviewId?: string | null;
};

type ChangeType = "ADD" | "EDIT" | "REMOVE";

const TIME_PHASE_OPTIONS: { value: string; label: string }[] = [
  { value: "MONTHLY", label: "This cycle (monthly)" },
  { value: "FIRST_MONTH", label: "First month" },
  { value: "FIRST_QUARTER", label: "First quarter (90 days)" },
  { value: "LONG_TERM", label: "Long-term" },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

export function ProposeChangeForm({ documentId, goals, sourceReviewId }: Props) {
  const [changeType, setChangeType] = useState<ChangeType>("ADD");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setMessage(null);
    try {
      await proposeGRGoalChange(formData);
      setMessage({
        kind: "ok",
        text: "Proposal sent. An admin will review it and apply the change if approved.",
      });
      const form = document.getElementById("propose-change-form") as HTMLFormElement | null;
      form?.reset();
      setChangeType("ADD");
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not submit proposal. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const needsGoalPicker = changeType === "EDIT" || changeType === "REMOVE";
  const needsProposedFields = changeType === "ADD" || changeType === "EDIT";

  return (
    <form
      id="propose-change-form"
      action={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      {sourceReviewId && <input type="hidden" name="sourceReviewId" value={sourceReviewId} />}

      <div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>What kind of change?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["ADD", "EDIT", "REMOVE"] as ChangeType[]).map((t) => (
            <label
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${changeType === t ? "var(--ypp-purple, #6b21c8)" : "var(--border, #e2e8f0)"}`,
                background: changeType === t ? "var(--ypp-purple-50, #faf5ff)" : "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: changeType === t ? 700 : 500,
              }}
            >
              <input
                type="radio"
                name="changeType"
                value={t}
                checked={changeType === t}
                onChange={() => setChangeType(t)}
                style={{ margin: 0 }}
              />
              {t === "ADD" ? "Add a goal" : t === "EDIT" ? "Edit a goal" : "Remove a goal"}
            </label>
          ))}
        </div>
      </div>

      {needsGoalPicker && (
        <div>
          <label htmlFor="goalId" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
            Which goal?
          </label>
          {goals.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
              No goals on this document to edit or remove yet.
            </p>
          ) : (
            <select id="goalId" name="goalId" required className="input" defaultValue="">
              <option value="" disabled>
                Pick a goal…
              </option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.timePhase})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {needsProposedFields && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label htmlFor="proposedTitle" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              {changeType === "ADD" ? "Goal title" : "Proposed new title (leave blank to keep)"}
            </label>
            <input
              id="proposedTitle"
              name="proposedTitle"
              type="text"
              className="input"
              required={changeType === "ADD"}
              placeholder="e.g. Run weekly community planning session"
            />
          </div>

          <div>
            <label htmlFor="proposedDescription" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              {changeType === "ADD" ? "Description" : "Proposed new description (leave blank to keep)"}
            </label>
            <textarea
              id="proposedDescription"
              name="proposedDescription"
              className="input"
              rows={3}
              placeholder="What does success look like? Why this goal now?"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div>
              <label htmlFor="proposedTimePhase" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                Time phase
              </label>
              <select id="proposedTimePhase" name="proposedTimePhase" className="input" defaultValue="">
                <option value="">{changeType === "ADD" ? "Pick one…" : "(no change)"}</option>
                {TIME_PHASE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="proposedPriority" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                Priority
              </label>
              <select id="proposedPriority" name="proposedPriority" className="input" defaultValue="">
                <option value="">{changeType === "ADD" ? "Default (Normal)" : "(no change)"}</option>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="proposedDueDate" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                Due date
              </label>
              <input id="proposedDueDate" name="proposedDueDate" type="date" className="input" />
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="reason" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
          Why are you proposing this? (helps the admin reviewing)
        </label>
        <textarea
          id="reason"
          name="reason"
          className="input"
          rows={2}
          placeholder={
            changeType === "REMOVE"
              ? "e.g. Goal no longer relevant since role scope changed in Q2."
              : changeType === "EDIT"
              ? "e.g. Mentee is ahead of schedule; reshape the goal toward a stretch outcome."
              : "e.g. Mentee needs an explicit goal around recruiting volunteer instructors."
          }
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-[filter] hover:brightness-95 disabled:opacity-60"
          disabled={submitting || (needsGoalPicker && goals.length === 0)}
        >
          {submitting ? "Submitting…" : "Submit proposal"}
        </button>
        {message && (
          <span
            role="status"
            style={{
              fontSize: 13,
              color: message.kind === "ok" ? "#166534" : "#991b1b",
              fontWeight: 600,
            }}
          >
            {message.text}
          </span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
        Proposals go to an admin for review. The G&amp;R document only changes once they approve.
      </p>
    </form>
  );
}
