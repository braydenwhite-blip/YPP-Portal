"use client";

import { useState, useTransition } from "react";

import { setAssignments } from "@/lib/journey-editor/actions";
import type { JourneyAudienceRole } from "@/lib/journey-editor/types";

interface AssignmentsTabProps {
  journeyId: string;
  assignments: Array<{ audience: string; autoEnroll: boolean }>;
  canEdit: boolean;
}

/** All assignable audiences, in the order they appear in the editor. */
const AUDIENCES: Array<{ value: JourneyAudienceRole; label: string }> = [
  { value: "STUDENT", label: "Students" },
  { value: "INSTRUCTOR", label: "Instructors" },
  { value: "SUMMER_WORKSHOP_INSTRUCTOR", label: "Summer Workshop Instructors" },
  { value: "MENTOR", label: "Mentors" },
  { value: "CHAPTER_PRESIDENT", label: "Chapter Presidents" },
  { value: "LEADERSHIP", label: "Leadership" },
];

type RowState = { enabled: boolean; autoEnroll: boolean };

function initialRows(
  assignments: Array<{ audience: string; autoEnroll: boolean }>
): Record<JourneyAudienceRole, RowState> {
  const byAudience = new Map(assignments.map((a) => [a.audience, a.autoEnroll]));
  const rows = {} as Record<JourneyAudienceRole, RowState>;
  for (const { value } of AUDIENCES) {
    rows[value] = {
      enabled: byAudience.has(value),
      autoEnroll: byAudience.get(value) ?? false,
    };
  }
  return rows;
}

/**
 * Audience assignment editor (Commit 13). Chooses which audiences a journey is
 * for and whether each is auto-enrolled. Journey-scoped — one rule per audience
 * — and consumed by the publish-time validation that requires at least one
 * assignment. Mirrors the gates tab: local draft state, one save action.
 */
export function AssignmentsTab(props: AssignmentsTabProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<JourneyAudienceRole, RowState>>(() =>
    initialRows(props.assignments)
  );

  function update(audience: JourneyAudienceRole, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [audience]: { ...prev[audience], ...patch } }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const assignments = AUDIENCES.filter((a) => rows[a.value].enabled).map((a) => ({
          audience: a.value,
          autoEnroll: rows[a.value].autoEnroll,
        }));
        await setAssignments({ journeyId: props.journeyId, assignments });
        setSavedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  const enabledCount = AUDIENCES.filter((a) => rows[a.value].enabled).length;

  return (
    <div className="card">
      <header className="card-header">
        <h2>Audience assignments</h2>
        <p className="muted">
          Choose who this journey is for. <strong>Auto-enroll</strong> adds it to that
          audience&apos;s training automatically; otherwise it&apos;s available for them to
          start. A published journey needs at least one audience.
        </p>
      </header>

      <ul className="assignment-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {AUDIENCES.map((a) => {
          const row = rows[a.value];
          return (
            <li
              key={a.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "8px 0",
                borderBottom: "1px solid var(--border, #e5e7eb)",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 260 }}>
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={!props.canEdit}
                  onChange={(e) => update(a.value, { enabled: e.target.checked })}
                />
                <span>{a.label}</span>
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: row.enabled ? 1 : 0.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={row.autoEnroll}
                  disabled={!props.canEdit || !row.enabled}
                  onChange={(e) => update(a.value, { autoEnroll: e.target.checked })}
                />
                <span>Auto-enroll</span>
              </label>
            </li>
          );
        })}
      </ul>

      {enabledCount === 0 ? (
        <p className="muted" style={{ marginTop: 10 }}>
          No audiences selected yet.
        </p>
      ) : null}

      {props.canEdit ? (
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save assignments"}
          </button>
        </div>
      ) : (
        <p className="muted">Read-only — only ADMIN/CONTENT_ADMIN can edit assignments.</p>
      )}

      {error ? <p className="form-error">{error}</p> : null}
      {savedAt ? <p className="form-success">Saved.</p> : null}
    </div>
  );
}
