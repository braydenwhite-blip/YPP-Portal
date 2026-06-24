"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, RecordSection, StatusBadge, cn } from "@/components/ui-v2";
import { createActionFromSuggestion } from "@/lib/people-strategy/suggested-actions-actions";
import type { SuggestedAction } from "@/lib/people-strategy/notes-to-actions";

/**
 * "Review suggested actions" — turns a meeting's notes into reviewable actions.
 *
 * Deterministic by default; an optional "Use AI" toggle (only shown when the
 * server reports AI is available) asks Claude to extract instead, falling back
 * to the heuristic parser. Every suggestion is confirm / edit / ignore — the
 * officer is always in control, and confirming creates a tracked action that
 * preserves its meeting source.
 */

type Person = { id: string; name: string };

type Row = SuggestedAction & {
  // local editable state
  editTitle: string;
  editOwnerId: string;
  editDeadline: string; // yyyy-mm-dd
  state: "pending" | "saving" | "added" | "ignored";
  createdId?: string;
  error?: string | null;
};

const CONFIDENCE_TONE: Record<SuggestedAction["confidence"], "success" | "warning" | "info"> = {
  high: "success",
  medium: "info",
  low: "warning",
};

function isoToDateInput(iso: string | null): string {
  if (!iso) return defaultDeadline();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultDeadline();
  return d.toISOString().slice(0, 10);
}

function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function SuggestedActionsPanel({
  meetingId,
  people,
  relatedEntityType,
  relatedEntityId,
  aiAvailable,
  hasNotes,
}: {
  meetingId: string;
  people: Person[];
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  aiAvailable: boolean;
  hasNotes: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);

  const review = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/help-agent/suggest-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, useAI }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not analyze the notes.");
      }
      const data = (await res.json()) as { suggestions: SuggestedAction[]; aiUsed: boolean };
      setAiUsed(data.aiUsed);
      setRows(
        data.suggestions.map((s) => ({
          ...s,
          editTitle: s.title,
          editOwnerId: s.ownerId ?? "",
          editDeadline: isoToDateInput(s.dueDateISO),
          state: "pending",
        }))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));

  const confirm = async (row: Row) => {
    if (!row.editOwnerId) {
      update(row.id, { error: "Choose an owner first." });
      return;
    }
    update(row.id, { state: "saving", error: null });
    try {
      const result = await createActionFromSuggestion({
        meetingId,
        title: row.editTitle.trim(),
        leadId: row.editOwnerId,
        deadline: row.editDeadline,
        relatedEntityType: relatedEntityType ?? null,
        relatedEntityId: relatedEntityId ?? null,
      });
      update(row.id, { state: "added", createdId: result.id });
      router.refresh();
    } catch (err) {
      update(row.id, { state: "pending", error: (err as Error).message });
    }
  };

  const pendingCount = rows?.filter((r) => r.state === "pending" || r.state === "saving").length ?? 0;

  return (
    <RecordSection
      title="Suggested actions from notes"
      description="Turn what was written down into tracked work. Confirm, edit, or ignore each one."
      action={
        rows !== null ? (
          <Button variant="ghost" size="sm" onClick={review} disabled={loading}>
            {loading ? "Re-analyzing…" : "Re-analyze"}
          </Button>
        ) : undefined
      }
      className="mt-5"
    >
      {!hasNotes ? (
        <p className="m-0 text-[13.5px] text-ink-muted">
          No notes have been added yet. Capture what was discussed, then review suggested actions to
          turn this meeting into trackable work.
        </p>
      ) : rows === null ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13.5px] text-ink-muted">
            Scan the notes for action items — assignments, follow-ups, and to-dos — and propose
            structured actions you can confirm in one click.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={review} disabled={loading}>
              {loading ? "Reading notes…" : "Review suggested actions"}
            </Button>
            {aiAvailable ? (
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="size-3.5 accent-brand-600"
                />
                Use AI to read the notes (optional)
              </label>
            ) : null}
          </div>
          {error ? (
            <p className="m-0 text-[13px] text-danger-700">{error}</p>
          ) : null}
        </div>
      ) : rows.length === 0 ? (
        <p className="m-0 text-[13.5px] text-ink-muted">
          No clear action items were detected in the notes. You can still{" "}
          <a
            href="/actions/new"
            className="font-semibold text-brand-700 hover:underline"
          >
            create an action manually
          </a>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[12.5px] text-ink-muted">
            {aiUsed ? "AI-read from the notes. " : "Detected from the notes. "}
            {pendingCount > 0
              ? `${pendingCount} suggestion${pendingCount === 1 ? "" : "s"} to review.`
              : "All reviewed."}
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "rounded-[10px] border border-line-soft p-3.5",
                  row.state === "added" && "border-success-300 bg-success-50/50",
                  row.state === "ignored" && "opacity-50"
                )}
              >
                {row.state === "ignored" ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-ink-muted line-through">{row.editTitle}</span>
                    <button
                      type="button"
                      onClick={() => update(row.id, { state: "pending" })}
                      className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                    >
                      Undo
                    </button>
                  </div>
                ) : row.state === "added" ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <StatusBadge tone="success">Added</StatusBadge>
                      {row.editTitle}
                    </span>
                    {row.createdId ? (
                      <a
                        href={`/actions/${row.createdId}`}
                        className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                      >
                        Open action →
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start gap-2">
                      <StatusBadge tone={CONFIDENCE_TONE[row.confidence]}>{row.confidence}</StatusBadge>
                      <input
                        value={row.editTitle}
                        onChange={(e) => update(row.id, { editTitle: e.target.value })}
                        aria-label="Action title"
                        className="min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[13.5px] font-semibold text-ink outline-none focus:border-brand-400"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={row.editOwnerId}
                        onChange={(e) => update(row.id, { editOwnerId: e.target.value, error: null })}
                        aria-label="Owner"
                        className="rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand-400"
                      >
                        <option value="">Choose owner…</option>
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={row.editDeadline}
                        onChange={(e) => update(row.id, { editDeadline: e.target.value })}
                        aria-label="Due date"
                        className="rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand-400"
                      />
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => update(row.id, { state: "ignored" })}
                          className="rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-ink"
                        >
                          Ignore
                        </button>
                        <Button size="sm" onClick={() => confirm(row)} disabled={row.state === "saving"}>
                          {row.state === "saving" ? "Adding…" : "Confirm"}
                        </Button>
                      </div>
                    </div>
                    {row.sourceLine ? (
                      <p className="m-0 text-[11.5px] italic text-ink-muted">“{row.sourceLine}”</p>
                    ) : null}
                    {row.error ? (
                      <p className="m-0 text-[12px] font-medium text-danger-700">{row.error}</p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </RecordSection>
  );
}
