"use client";

import { useState, useTransition } from "react";

import { setGates } from "@/lib/journey-editor/actions";
import type { JourneyGateKind } from "@/lib/journey-editor/types";

export interface GateRow {
  id: string;
  kind: JourneyGateKind;
  targetRef: string;
  requiredRef: string;
  threshold: number | null;
}

interface GatesTabProps {
  versionId: string | null;
  versionStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
  gates: GateRow[];
  beatRefs: string[];
  knownModuleRefs: string[];
  canEdit: boolean;
}

const GATE_KINDS: JourneyGateKind[] = [
  "READINESS_CHECK",
  "BEAT_COMPLETE",
  "MODULE_COMPLETE",
  "SCORE_THRESHOLD",
];

export function GatesTab(props: GatesTabProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<GateRow[]>(props.gates);

  if (props.versionId === null || props.versionStatus !== "DRAFT") {
    return (
      <div className="card">
        <p className="muted">
          Gates can only be edited on a DRAFT version. Open the Overview tab to
          create one.
        </p>
        {props.gates.length > 0 ? (
          <ul className="gate-list">
            {props.gates.map((g) => (
              <li key={g.id} className="gate-row">
                <code>{g.kind}</code>{" "}
                <code>{g.targetRef} ← {g.requiredRef}</code>
                {g.threshold !== null ? <code>≥ {g.threshold}%</code> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (!props.canEdit) {
    return (
      <div className="card">
        <p className="muted">Read-only — only ADMIN/CONTENT_ADMIN can edit gates.</p>
      </div>
    );
  }

  function update(idx: number, patch: Partial<GateRow>) {
    setDraft((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function addRow() {
    const firstBeatRef = props.beatRefs[0] ?? "";
    setDraft((prev) => [
      ...prev,
      {
        id: `new-${prev.length}`,
        kind: "BEAT_COMPLETE",
        targetRef: firstBeatRef,
        requiredRef: firstBeatRef,
        threshold: null,
      },
    ]);
  }

  function removeRow(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await setGates({
          versionId: props.versionId!,
          gates: draft.map((g) => ({
            kind: g.kind,
            targetRef: g.targetRef,
            requiredRef: g.requiredRef,
            threshold: g.kind === "SCORE_THRESHOLD" ? g.threshold ?? 0 : null,
          })),
        });
        setSavedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  const allRefs = [...props.beatRefs, ...props.knownModuleRefs];

  return (
    <div className="card">
      <header className="card-header">
        <h2>Gates</h2>
        <p className="muted">
          Block a target beat or module on a required beat or module. Refs use{" "}
          <code>beat:&lt;sourceKey&gt;</code> or <code>module:&lt;contentKey&gt;</code>.
        </p>
      </header>

      {draft.length === 0 ? (
        <p className="muted">No gates yet. Add one to enforce a prerequisite.</p>
      ) : (
        <ul className="gate-list">
          {draft.map((g, idx) => (
            <li key={g.id} className="gate-row">
              <select
                value={g.kind}
                onChange={(e) => update(idx, { kind: e.target.value as JourneyGateKind })}
              >
                {GATE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <RefInput
                label="target"
                value={g.targetRef}
                allRefs={allRefs}
                onChange={(v) => update(idx, { targetRef: v })}
              />
              <RefInput
                label="required"
                value={g.requiredRef}
                allRefs={allRefs}
                onChange={(v) => update(idx, { requiredRef: v })}
              />
              {g.kind === "SCORE_THRESHOLD" ? (
                <label className="form-row inline">
                  <span>≥</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={g.threshold ?? 0}
                    onChange={(e) => update(idx, { threshold: Number(e.target.value) })}
                  />
                  <span>%</span>
                </label>
              ) : null}
              <button type="button" className="btn btn-danger-ghost" onClick={() => removeRow(idx)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={addRow}>
          + Add gate
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save gates"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {savedAt ? <p className="form-success">Saved.</p> : null}
    </div>
  );
}

function RefInput(props: {
  label: string;
  value: string;
  allRefs: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="form-row inline">
      <span>{props.label}</span>
      <input
        list={`refs-${props.label}`}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        pattern="(beat|module):[A-Za-z0-9_\-]+"
        placeholder="beat:intro"
      />
      <datalist id={`refs-${props.label}`}>
        {props.allRefs.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </label>
  );
}
