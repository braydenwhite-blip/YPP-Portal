"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { updateDraftBeat } from "@/lib/journey-editor/actions";
import type { InteractiveBeatKind } from "@/lib/journey-editor/types";

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

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => {
      const dd = dialogRef.current;
      if (dd?.open) dd.close();
    };
  }, []);

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const scoringWeight = Number(formData.get("scoringWeight") ?? props.beat.scoringWeight);
    const configRaw = String(formData.get("config") ?? "");

    let config: unknown;
    try {
      config = JSON.parse(configRaw);
    } catch (e) {
      setError(`Config is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await updateDraftBeat({
          beatId: props.beat.id,
          title,
          prompt,
          scoringWeight,
          config,
        });
        props.onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className="beat-editor-modal"
      onClose={props.onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) props.onClose();
      }}
    >
      <form method="dialog" className="beat-editor-form" action={(fd) => handleSubmit(fd)}>
        <header className="beat-editor-header">
          <h2>Edit beat</h2>
          <span className="beat-kind-pill">{props.beat.kind}</span>
        </header>

        <label className="form-row">
          <span>Title</span>
          <input name="title" defaultValue={props.beat.title} required minLength={1} />
        </label>
        <label className="form-row">
          <span>Prompt</span>
          <textarea name="prompt" rows={2} defaultValue={props.beat.prompt} required />
        </label>
        <label className="form-row">
          <span>Scoring weight</span>
          <input
            type="number"
            name="scoringWeight"
            min={0}
            max={100}
            defaultValue={props.beat.scoringWeight}
            required
          />
        </label>
        <label className="form-row">
          <span>Config (JSON)</span>
          <textarea
            name="config"
            rows={16}
            defaultValue={JSON.stringify(props.beat.config, null, 2)}
            spellCheck={false}
            className="json-editor"
          />
          <small className="muted">
            Edited live against the {props.beat.kind} schema; save will fail with the exact zod
            error if it does not parse.
          </small>
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <footer className="form-actions">
          <button type="button" className="btn" onClick={props.onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
