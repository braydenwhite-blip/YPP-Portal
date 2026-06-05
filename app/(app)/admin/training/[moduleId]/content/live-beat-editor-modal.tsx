"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { updateLiveBeat } from "@/lib/training-journey/beat-edit-actions";
import {
  type BeatConfigForm,
  configToFormModel,
  formModelToConfig,
  isStructuredBeatKind,
} from "@/lib/journey-editor/beat-config-forms";
import type { InteractiveBeatKind } from "@/lib/journey-editor/types";
import { BeatConfigFormFields } from "@/app/(app)/admin/journeys/[id]/beat-config-form";

export interface LiveBeat {
  id: string;
  sourceKey: string;
  kind: InteractiveBeatKind;
  title: string;
  prompt: string;
  scoringWeight: number;
  config: unknown;
}

interface LiveBeatEditorModalProps {
  beat: LiveBeat;
  onClose: () => void;
  onSaved: () => void;
}

export function LiveBeatEditorModal({ beat, onClose, onSaved }: LiveBeatEditorModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const structured = isStructuredBeatKind(beat.kind);

  const [title, setTitle] = useState(beat.title);
  const [prompt, setPrompt] = useState(beat.prompt);
  const [scoringWeight, setScoringWeight] = useState(beat.scoringWeight);

  const [configForm, setConfigForm] = useState<BeatConfigForm | null>(() =>
    isStructuredBeatKind(beat.kind)
      ? configToFormModel(beat.kind, beat.config)
      : null,
  );

  // Advanced JSON mode — the escape hatch for power users and the only path for
  // any kind without a visual editor.
  const [jsonMode, setJsonMode] = useState(!structured);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(beat.config, null, 2));

  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  function requestClose() {
    if (dirty && !confirm("Discard unsaved changes to this beat?")) return;
    onClose();
  }

  function handleConfigChange(next: BeatConfigForm) {
    setConfigForm(next);
    setDirty(true);
  }

  function handleSave() {
    let config: unknown;
    if (jsonMode) {
      try {
        config = JSON.parse(jsonText);
      } catch (e) {
        setError(`Content is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    } else if (configForm) {
      config = formModelToConfig(configForm, beat.config);
    } else {
      config = beat.config;
    }

    setError(null);
    startTransition(async () => {
      try {
        await updateLiveBeat({
          beatId: beat.id,
          title: title.trim(),
          prompt: prompt.trim(),
          scoringWeight,
          config,
        });
        setDirty(false);
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  function enterJsonMode() {
    if (configForm) {
      setJsonText(JSON.stringify(formModelToConfig(configForm, beat.config), null, 2));
    }
    setJsonMode(true);
  }

  function exitJsonMode() {
    if (isStructuredBeatKind(beat.kind)) {
      try {
        const parsed = JSON.parse(jsonText);
        setConfigForm(configToFormModel(beat.kind, parsed));
        setJsonMode(false);
        setError(null);
      } catch (e) {
        setError(
          `Can't switch to the visual editor — JSON is invalid: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="beat-editor-modal"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) requestClose();
      }}
    >
      <div className="beat-editor-form">
        <header className="beat-editor-header">
          <h2>Edit content</h2>
          <span className="beat-kind-pill">{beat.kind}</span>
        </header>

        <p className="muted" style={{ marginTop: 0 }}>
          Changes save straight to the live module — learners see them the next
          time they open this beat.
        </p>

        <label className="form-row">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            required
            minLength={1}
          />
        </label>
        <label className="form-row">
          <span>Prompt</span>
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setDirty(true);
            }}
            required
          />
        </label>
        <label className="form-row">
          <span>Scoring weight</span>
          <input
            type="number"
            min={0}
            max={100}
            value={scoringWeight}
            onChange={(e) => {
              setScoringWeight(Number(e.target.value));
              setDirty(true);
            }}
            required
          />
          <small className="muted">0 = not graded (reading / reflection beats).</small>
        </label>

        <div className="beat-config-mode-bar">
          <h3>Content</h3>
          {structured ? (
            jsonMode ? (
              <button type="button" className="btn btn-sm" onClick={exitJsonMode}>
                ← Back to visual editor
              </button>
            ) : (
              <button type="button" className="btn btn-sm" onClick={enterJsonMode}>
                Advanced (JSON)
              </button>
            )
          ) : (
            <span className="muted">No visual editor for this kind yet — edit JSON directly.</span>
          )}
        </div>

        {!jsonMode && configForm ? (
          <BeatConfigFormFields form={configForm} onChange={handleConfigChange} />
        ) : (
          <label className="form-row">
            <span className="sr-only">Content (JSON)</span>
            <textarea
              rows={16}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
              className="json-editor"
            />
            <small className="muted">
              Saved against the {beat.kind} schema — save fails with the exact
              validation error if it does not parse.
            </small>
          </label>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <footer className="form-actions">
          <button type="button" className="btn" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
