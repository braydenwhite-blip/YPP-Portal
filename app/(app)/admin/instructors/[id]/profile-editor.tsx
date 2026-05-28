"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InstructorProfileDetail } from "@/lib/instructor-ops-actions";
import {
  addTagToInstructor,
  removeTagFromInstructor,
  createInstructorNote,
  updateInstructorNote,
  deleteInstructorNote,
  createInstructorTask,
  resolveInstructorTask,
  deleteInstructorTask,
} from "@/lib/instructor-ops-actions";

type TagRow = InstructorProfileDetail["tags"][number];
type AvailableTag = { id: string; namespace: string; label: string; color: string | null };
type Note = InstructorProfileDetail["notes"][number];
type Task = InstructorProfileDetail["tasks"][number];

// ── Tags Editor ──────────────────────────────────────────────────────────────

export function TagsEditor({
  userId,
  initialTags,
  allTags,
}: {
  userId: string;
  initialTags: TagRow[];
  allTags: AvailableTag[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tags, setTags] = useState(initialTags);
  const [showPicker, setShowPicker] = useState(false);

  const availableToAdd = allTags.filter((t) => !tags.some((tag) => tag.tagId === t.id));

  function handleAdd(tag: AvailableTag) {
    setShowPicker(false);
    setTags((prev) => [
      ...prev,
      { tagId: tag.id, namespace: tag.namespace, slug: "", label: tag.label, color: tag.color },
    ]);
    startTransition(async () => {
      await addTagToInstructor(userId, tag.id);
      router.refresh();
    });
  }

  function handleRemove(tagId: string) {
    setTags((prev) => prev.filter((t) => t.tagId !== tagId));
    startTransition(async () => {
      await removeTagFromInstructor(userId, tagId);
      router.refresh();
    });
  }

  return (
    <div>
      <h3>Tags and categories</h3>
      <div className="instructor-ops-tag-row is-large" style={{ marginBottom: 10 }}>
        {tags.length === 0 ? (
          <span style={{ color: "var(--muted)", fontStyle: "italic", fontWeight: 400, background: "none", border: "none" }}>
            No tags yet
          </span>
        ) : (
          tags.map((tag) => (
            <span key={tag.tagId} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {tag.label}
              <button
                onClick={() => handleRemove(tag.tagId)}
                disabled={isPending}
                aria-label={`Remove ${tag.label}`}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: "0 1px",
                  fontSize: 14,
                  lineHeight: 1,
                  color: "inherit",
                  opacity: 0.55,
                }}
              >
                &times;
              </button>
            </span>
          ))
        )}
      </div>

      <div style={{ position: "relative", display: "inline-block" }}>
        <button
          className="button secondary"
          style={{ fontSize: 12, padding: "4px 10px" }}
          onClick={() => setShowPicker((s) => !s)}
          disabled={isPending || availableToAdd.length === 0}
        >
          + Add tag
        </button>
        {showPicker && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 50,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,.12)",
              padding: 8,
              minWidth: 180,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {availableToAdd.map((t) => (
              <button
                key={t.id}
                onClick={() => handleAdd(t)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--muted)", marginRight: 4, fontSize: 10 }}>
                  {t.namespace.toLowerCase()}
                </span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Notes Editor ─────────────────────────────────────────────────────────────

export function NotesEditor({
  userId,
  initialNotes,
}: {
  userId: string;
  initialNotes: Note[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"global" | "chapter" | "private">("global");

  function handleAdd() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    setNotes((prev) => [
      {
        id: `temp-${Date.now()}`,
        body: trimmed,
        isPinned: false,
        visibility,
        authorName: "You",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    startTransition(async () => {
      await createInstructorNote({ userId, body: trimmed, visibility });
      router.refresh();
    });
  }

  function handleDelete(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    startTransition(async () => {
      await deleteInstructorNote(noteId);
      router.refresh();
    });
  }

  function handlePin(noteId: string, currentPinned: boolean) {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, isPinned: !currentPinned } : n)),
    );
    startTransition(async () => {
      await updateInstructorNote(noteId, { isPinned: !currentPinned });
      router.refresh();
    });
  }

  return (
    <div>
      <h3>Admin notes</h3>

      <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "global" | "chapter" | "private")}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid #e5e7eb",
            }}
          >
            <option value="global">Global (all admins)</option>
            <option value="chapter">Chapter only</option>
            <option value="private">Private</option>
          </select>
          <button
            className="button"
            style={{ fontSize: 12, padding: "5px 14px" }}
            onClick={handleAdd}
            disabled={isPending || !body.trim()}
          >
            Save note
          </button>
        </div>
      </div>

      <div className="instructor-profile-stack">
        {notes.length === 0 ? (
          <p className="instructor-profile-muted">No admin notes yet.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="instructor-profile-activity-row"
              style={{ position: "relative", paddingRight: 64 }}
            >
              <strong>
                {note.isPinned && (
                  <span style={{ marginRight: 4, fontSize: 11 }}>[pinned]</span>
                )}
                {note.authorName}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 400,
                    color: "var(--muted)",
                  }}
                >
                  {note.visibility}
                </span>
              </strong>
              <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {note.body}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  gap: 6,
                }}
              >
                <button
                  onClick={() => handlePin(note.id, note.isPinned)}
                  disabled={isPending}
                  title={note.isPinned ? "Unpin" : "Pin"}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: note.isPinned ? "var(--accent)" : "var(--muted)",
                    padding: "2px 4px",
                  }}
                >
                  {note.isPinned ? "Unpin" : "Pin"}
                </button>
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={isPending}
                  title="Delete note"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--muted)",
                    padding: "2px 4px",
                  }}
                >
                  &times;
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Tasks Editor ─────────────────────────────────────────────────────────────

const TASK_KIND_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  CERT_EXPIRING: "Cert expiring",
  STALLED_STAGE: "Stalled stage",
  IDLE_30D: "Idle 30 days",
  DECLINED_REPEAT: "Declined repeat",
  GHOSTING_MENTEE: "Ghosting mentee",
  TRAINING_OVERDUE: "Training overdue",
};

export function TasksEditor({
  userId,
  initialTasks,
}: {
  userId: string;
  initialTasks: Task[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  const open = tasks.filter((t) => !t.resolvedAt);
  const resolved = tasks.filter((t) => t.resolvedAt);

  function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle("");
    setDueAt("");
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      kind: "MANUAL",
      title: trimmed,
      description: null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assigneeName: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    startTransition(async () => {
      await createInstructorTask({
        userId,
        title: trimmed,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      router.refresh();
    });
  }

  function handleResolve(taskId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, resolvedAt: new Date().toISOString() } : t,
      ),
    );
    startTransition(async () => {
      await resolveInstructorTask(taskId);
      router.refresh();
    });
  }

  function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      await deleteInstructorTask(taskId);
      router.refresh();
    });
  }

  return (
    <div>
      <h3>Tasks</h3>

      <div
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Task title..."
          style={{
            flex: 1,
            minWidth: 180,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            fontFamily: "inherit",
          }}
        />
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 12,
          }}
        />
        <button
          className="button"
          style={{ fontSize: 12, padding: "6px 14px" }}
          onClick={handleAdd}
          disabled={isPending || !title.trim()}
        >
          Add task
        </button>
      </div>

      <div className="instructor-profile-stack">
        {open.length === 0 ? (
          <p className="instructor-profile-muted">No open tasks.</p>
        ) : (
          open.map((task) => (
            <div
              key={task.id}
              className="instructor-profile-activity-row"
              style={{ position: "relative", paddingRight: 80 }}
            >
              <strong>{task.title}</strong>
              <span>
                {TASK_KIND_LABELS[task.kind] ?? task.kind}
                {task.dueAt &&
                  ` | Due ${new Date(task.dueAt).toLocaleDateString()}`}
                {task.assigneeName && ` | ${task.assigneeName}`}
              </span>
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  onClick={() => handleResolve(task.id)}
                  disabled={isPending}
                  title="Mark resolved"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--muted)",
                    padding: "2px 4px",
                  }}
                >
                  Done
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  disabled={isPending}
                  title="Delete task"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--muted)",
                    padding: "2px 4px",
                  }}
                >
                  &times;
                </button>
              </div>
            </div>
          ))
        )}

        {resolved.length > 0 && (
          <details style={{ marginTop: 4 }}>
            <summary
              style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer", userSelect: "none" }}
            >
              {resolved.length} resolved task{resolved.length !== 1 ? "s" : ""}
            </summary>
            <div style={{ marginTop: 4 }}>
              {resolved.map((task) => (
                <div
                  key={task.id}
                  className="instructor-profile-activity-row"
                  style={{ opacity: 0.5, position: "relative", paddingRight: 40 }}
                >
                  <strong style={{ textDecoration: "line-through" }}>{task.title}</strong>
                  <span>
                    Resolved{" "}
                    {task.resolvedAt
                      ? new Date(task.resolvedAt).toLocaleDateString()
                      : ""}
                  </span>
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={isPending}
                    title="Delete task"
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "var(--muted)",
                      padding: "2px 4px",
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
