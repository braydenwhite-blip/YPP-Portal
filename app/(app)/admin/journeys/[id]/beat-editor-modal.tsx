"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { updateDraftBeat } from "@/lib/journey-editor/actions";
import {
  type BeatConfigForm,
  configToFormModel,
  formModelToConfig,
  isStructuredBeatKind,
} from "@/lib/journey-editor/beat-config-forms";
import type { InteractiveBeatKind } from "@/lib/journey-editor/types";

import { BeatConfigFormFields } from "./beat-config-form";

export interface BeatEditorBeat {
  id: string;
  kind: InteractiveBeatKind;
  title: string;
  prompt: string;
  scoringWeight: number;
  config: unknown;
}

interface BeatEditorModalProps {
  beat: BeatEditorBeat;
  onClose: () => void;
}

export function BeatEditorModal(props: BeatEditorModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const structured = isStructuredBeatKind(props.beat.kind);

  // Shared meta fields.
  const [title, setTitle] = useState(props.beat.title);
  const [prompt, setPrompt] = useState(props.beat.prompt);
  const [scoringWeight, setScoringWeight] = useState(props.beat.scoringWeight);

  // Structured config model (only meaningful for editor-supported kinds).
  const [configForm, setConfigForm] = useState<BeatConfigForm | null>(() =>
    isStructuredBeatKind(props.beat.kind)
      ? configToFormModel(props.beat.kind, props.beat.config)
      : null,
  );

  // Advanced JSON mode — the only path for kinds without a visual editor yet,
  // and an opt-in escape hatch for power users on supported kinds.
  const [jsonMode, setJsonMode] = useState(!structured);
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(props.beat.config, null, 2),
  );

  // Track unsaved changes so we can warn before discarding.
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
    props.onClose();
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
        setError(`Config is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    } else if (configForm) {
      config = formModelToConfig(configForm, props.beat.config);
    } else {
      config = props.beat.config;
    }

    setError(null);
    startTransition(async () => {
      try {
        await updateDraftBeat({
          beatId: props.beat.id,
          title: title.trim(),
          prompt: prompt.trim(),
          scoringWeight,
          config,
        });
        setDirty(false);
        props.onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  function enterJsonMode() {
    // Seed the JSON view from the current structured edits so nothing is lost.
    if (configForm) {
      setJsonText(JSON.stringify(formModelToConfig(configForm, props.beat.config), null, 2));
    }
    setJsonMode(true);
  }

  function exitJsonMode() {
    // Re-hydrate the structured form from the (possibly hand-edited) JSON.
    if (isStructuredBeatKind(props.beat.kind)) {
      try {
        const parsed = JSON.parse(jsonText);
        setConfigForm(configToFormModel(props.beat.kind, parsed));
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
      onClose={props.onClose}
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
          <h2>Edit beat</h2>
          <span className="beat-kind-pill">{props.beat.kind}</span>
        </header>

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
            <span className="sr-only">Config (JSON)</span>
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
              Saved against the {props.beat.kind} schema — save fails with the exact validation
              error if it does not parse.
            </small>
          </label>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <footer className="form-actions">
          <button type="button" className="btn" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
