"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addLiveBeat,
  removeLiveBeat,
  reorderLiveBeats,
  updateLiveJourneySettings,
} from "@/lib/training-journey/beat-edit-actions";
import { EDITOR_SUPPORTED_KINDS } from "@/lib/journey-editor/beat-defaults";
import type { InteractiveBeatKind } from "@/lib/journey-editor/types";

import { LiveBeatEditorModal, type LiveBeat } from "./live-beat-editor-modal";

interface JourneySettings {
  id: string;
  estimatedMinutes: number;
  passScorePct: number;
  strictMode: boolean;
}

interface ModuleContentEditorProps {
  canPublish: boolean;
  moduleId: string;
  moduleTitle: string;
  moduleDescription: string;
  journey: JourneySettings;
  beats: LiveBeat[];
}

/** Human-friendly labels for each beat kind shown in the picker + list. */
const KIND_LABELS: Record<InteractiveBeatKind, string> = {
  CONCEPT_REVEAL: "Concept reveal",
  CONTENT_BLOCK: "Reading / content",
  SCENARIO_CHOICE: "Scenario choice",
  MULTI_SELECT: "Multi-select",
  SORT_ORDER: "Order the steps",
  MATCH_PAIRS: "Match pairs",
  SPOT_THE_MISTAKE: "Spot the mistake",
  FILL_IN_BLANK: "Fill in the blank",
  BRANCHING_SCENARIO: "Branching scenario",
  REFLECTION: "Reflection",
  COMPARE: "Compare",
  HOTSPOT: "Hotspot",
  MESSAGE_COMPOSER: "Message composer",
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind as InteractiveBeatKind] ?? kind;
}

export function ModuleContentEditor({
  canPublish,
  moduleId,
  moduleTitle,
  moduleDescription,
  journey,
  beats,
}: ModuleContentEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local copy so reorders feel instant; re-synced from the server on refresh.
  const [order, setOrder] = useState<LiveBeat[]>(beats);
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<InteractiveBeatKind>("CONTENT_BLOCK");

  // Journey settings form
  const [estimatedMinutes, setEstimatedMinutes] = useState(journey.estimatedMinutes);
  const [passScorePct, setPassScorePct] = useState(journey.passScorePct);
  const [strictMode, setStrictMode] = useState(journey.strictMode);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const editingBeat = editingBeatId
    ? order.find((b) => b.id === editingBeatId) ?? null
    : null;

  function run(action: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        router.refresh();
      }
    });
  }

  function moveBeat(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    run(() =>
      reorderLiveBeats({
        journeyId: journey.id,
        orderedBeatIds: next.map((b) => b.id),
      }),
    );
  }

  function handleAdd() {
    run(() => addLiveBeat({ journeyId: journey.id, kind: addKind }));
  }

  function handleRemove(beat: LiveBeat) {
    if (
      !confirm(
        `Remove "${beat.title}" from this module? Learners will no longer see it. (Past attempts are kept.)`,
      )
    ) {
      return;
    }
    run(() => removeLiveBeat({ beatId: beat.id }));
  }

  function handleSaveSettings() {
    setSettingsSaved(false);
    run(
      () =>
        updateLiveJourneySettings({
          journeyId: journey.id,
          estimatedMinutes,
          passScorePct,
          strictMode,
        }),
      () => setSettingsSaved(true),
    );
  }

  const totalWeight = order.reduce((sum, b) => sum + b.scoringWeight, 0);
  const gradedCount = order.filter((b) => b.scoringWeight > 0).length;

  return (
    <div className="module-content-editor">
      {/* Overview / context */}
      <section className="card" style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              {moduleDescription}
            </p>
          </div>
          <Link className="button small outline" href={`/training/${moduleId}`} target="_blank">
            ▶ Preview as learner
          </Link>
        </div>

        <div className="admin-training-meta-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <span className="pill pill-small">{order.length} beats</span>
          <span className="pill pill-small">{gradedCount} graded</span>
          <span className="pill pill-small">{totalWeight} total points</span>
        </div>
      </section>

      {!canPublish ? (
        <p className="banner banner-info" style={{ marginTop: 16 }}>
          Read-only mode. Only ADMIN / CONTENT_ADMIN can edit module content.
        </p>
      ) : (
        <p className="banner banner-info" style={{ marginTop: 16 }}>
          Edits here go <strong>live immediately</strong> — there is no draft/publish step.
        </p>
      )}

      {error ? (
        <p className="form-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      {/* Journey settings */}
      <section className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Module settings</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="form-row" style={{ minWidth: 160 }}>
            <span>Estimated minutes</span>
            <input
              type="number"
              min={0}
              max={600}
              value={estimatedMinutes}
              disabled={!canPublish}
              onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
            />
          </label>
          <label className="form-row" style={{ minWidth: 160 }}>
            <span>Pass score %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={passScorePct}
              disabled={!canPublish}
              onChange={(e) => setPassScorePct(Number(e.target.value))}
            />
          </label>
          <label className="beat-config-checkbox" style={{ marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={strictMode}
              disabled={!canPublish}
              onChange={(e) => setStrictMode(e.target.checked)}
            />
            <span>Strict mode (must pass every beat)</span>
          </label>
          {canPublish ? (
            <button
              type="button"
              className="button small"
              onClick={handleSaveSettings}
              disabled={pending}
              style={{ marginBottom: 8 }}
            >
              {pending ? "Saving…" : "Save settings"}
            </button>
          ) : null}
          {settingsSaved ? (
            <span className="pill pill-small pill-success" style={{ marginBottom: 8 }}>
              Saved
            </span>
          ) : null}
        </div>
      </section>

      {/* Beat list */}
      <section style={{ marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0 }}>Lesson beats</h3>
          {canPublish ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={addKind}
                onChange={(e) => setAddKind(e.target.value as InteractiveBeatKind)}
                aria-label="New beat type"
              >
                {EDITOR_SUPPORTED_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </select>
              <button type="button" className="button small" onClick={handleAdd} disabled={pending}>
                + Add beat
              </button>
            </div>
          ) : null}
        </div>

        {order.length === 0 ? (
          <p className="muted">No beats yet. Add the first one above.</p>
        ) : (
          <ol className="module-beat-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {order.map((beat, idx) => (
              <li key={beat.id} className="card module-beat-card">
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
                    <span
                      className="beat-config-index"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <strong>{beat.title}</strong>
                        <span className="beat-kind-pill">{kindLabel(beat.kind)}</span>
                        <span className="pill pill-small">
                          {beat.scoringWeight > 0 ? `${beat.scoringWeight} pts` : "Not graded"}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 13,
                          color: "var(--muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {beat.prompt}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                        Key: <code>{beat.sourceKey}</code>
                      </p>
                    </div>
                  </div>

                  {canPublish ? (
                    <div className="module-beat-actions" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="button small outline"
                        onClick={() => moveBeat(idx, -1)}
                        disabled={pending || idx === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button small outline"
                        onClick={() => moveBeat(idx, 1)}
                        disabled={pending || idx === order.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="button small"
                        onClick={() => setEditingBeatId(beat.id)}
                        disabled={pending}
                      >
                        Edit content
                      </button>
                      <button
                        type="button"
                        className="button small danger"
                        onClick={() => handleRemove(beat)}
                        disabled={pending}
                        aria-label="Remove beat"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {editingBeat ? (
        <LiveBeatEditorModal
          beat={editingBeat}
          onClose={() => setEditingBeatId(null)}
          onSaved={() => setEditingBeatId(null)}
        />
      ) : null}
    </div>
  );
}
