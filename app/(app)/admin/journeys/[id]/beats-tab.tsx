"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useTransition } from "react";

import { addBeat, removeBeat, reorderBeats } from "@/lib/journey-editor/actions";
import {
  EDITOR_SUPPORTED_KINDS,
  type EditorSupportedKind,
} from "@/lib/journey-editor/beat-defaults";
import type { InteractiveBeatKind } from "@/lib/journey-editor/types";

import { BeatEditorModal } from "./beat-editor-modal";

export interface BeatRow {
  id: string;
  sourceKey: string;
  kind: InteractiveBeatKind;
  title: string;
  prompt: string;
  sortOrder: number;
  scoringWeight: number;
  config: unknown;
}

interface BeatsTabProps {
  versionId: string | null;
  versionStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
  beats: BeatRow[];
  canEdit: boolean;
}

export function BeatsTab(props: BeatsTabProps) {
  const [order, setOrder] = useState<string[]>(props.beats.map((b) => b.id));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (props.versionId === null) {
    return (
      <div className="card">
        <p className="muted">No draft version exists. Open the Overview tab and click “Start a new draft”.</p>
      </div>
    );
  }
  if (props.versionStatus !== "DRAFT") {
    return (
      <div className="card">
        <p className="muted">
          The latest version is {props.versionStatus}. Create a new draft from the Overview tab to edit beats.
        </p>
      </div>
    );
  }
  if (!props.canEdit) {
    return (
      <div className="card">
        <p className="muted">Read-only — only ADMIN/CONTENT_ADMIN can edit beats.</p>
      </div>
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        await reorderBeats({ versionId: props.versionId!, orderedBeatIds: next });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reorder failed.");
        setOrder(order); // revert
      } finally {
        setBusy(false);
      }
    });
  }

  function handleAdd(formData: FormData) {
    const kind = String(formData.get("kind") ?? "REFLECTION") as EditorSupportedKind;
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();
    if (!sourceKey) {
      setError("sourceKey is required.");
      return;
    }
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        await addBeat({ versionId: props.versionId!, kind, sourceKey });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Add failed.");
      } finally {
        setBusy(false);
      }
    });
  }

  function handleRemove(beatId: string) {
    if (!confirm("Remove this beat? It will be soft-deleted in this draft.")) return;
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        await removeBeat({ beatId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Remove failed.");
      } finally {
        setBusy(false);
      }
    });
  }

  const beatById = new Map(props.beats.map((b) => [b.id, b]));
  const orderedBeats = order
    .map((id) => beatById.get(id))
    .filter((b): b is BeatRow => Boolean(b));

  return (
    <div className="card">
      <header className="card-header">
        <h2>Beats</h2>
        <p className="muted">
          Drag rows to reorder. Removing a beat soft-deletes it in this draft only —
          previously published versions retain the beat for replay.
        </p>
      </header>

      {orderedBeats.length === 0 ? (
        <p className="muted">No beats yet. Add one below.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedBeats.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <ul className="beat-list" aria-busy={pending || busy}>
              {orderedBeats.map((b, idx) => (
                <SortableBeatRow
                  key={b.id}
                  beat={b}
                  index={idx + 1}
                  onRemove={() => handleRemove(b.id)}
                  onEdit={() => setEditingBeatId(b.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      {editingBeatId
        ? (() => {
            const b = beatById.get(editingBeatId);
            if (!b) return null;
            return (
              <BeatEditorModal
                beat={{
                  id: b.id,
                  kind: b.kind,
                  title: b.title,
                  prompt: b.prompt,
                  scoringWeight: b.scoringWeight,
                  config: b.config,
                }}
                onClose={() => setEditingBeatId(null)}
              />
            );
          })()
        : null}

      <form className="add-beat-form" action={(fd) => handleAdd(fd)}>
        <h3>Add a beat</h3>
        <label className="form-row">
          <span>Kind</span>
          <select name="kind" defaultValue="REFLECTION">
            {EDITOR_SUPPORTED_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="form-row">
          <span>sourceKey</span>
          <input
            name="sourceKey"
            required
            pattern="[a-z0-9][a-z0-9_\-]*"
            placeholder="intro-reflection"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending || busy}>
          Add beat
        </button>
      </form>
    </div>
  );
}

function SortableBeatRow(props: {
  beat: BeatRow;
  index: number;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.beat.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="beat-row">
      <button
        type="button"
        className="beat-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button type="button" className="beat-row-body" onClick={props.onEdit}>
        <div className="beat-row-line">
          <strong>{props.index}.</strong> <span className="beat-kind-pill">{props.beat.kind}</span>{" "}
          {props.beat.title}
        </div>
        <div className="beat-row-meta muted">
          <code>{props.beat.sourceKey}</code>
        </div>
      </button>
      <button type="button" className="btn btn-danger-ghost" onClick={props.onRemove}>
        Remove
      </button>
    </li>
  );
}
