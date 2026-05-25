"use client";

import { useState, useTransition } from "react";
import type { InstructorLifecycleStage, InstructorTaskKind } from "@prisma/client";
import {
  updateInstructorLifecycleStage,
  createInstructorNote,
  updateInstructorNote,
  deleteInstructorNote,
  createInstructorTask,
  resolveInstructorTask,
  deleteInstructorTask,
  addTagToInstructor,
  removeTagFromInstructor,
  upsertInstructorProfile,
} from "@/lib/instructor-ops-actions";

// ── Types ──────────────────────────────────────────────────────────────────

type Note = {
  id: string;
  body: string;
  isPinned: boolean;
  visibility: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

type Task = {
  id: string;
  kind: InstructorTaskKind;
  title: string;
  description: string | null;
  dueAt: string | null;
  assigneeName: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type Tag = {
  tagId: string;
  namespace: string;
  slug: string;
  label: string;
  color: string | null;
};

type Metric = {
  weekStart: string;
  classesTaught: number;
  hoursTaught: number;
  noShows: number;
  ratingAvg: number | null;
  studentsServed: number;
};

type AllTag = { id: string; namespace: string; slug: string; label: string; color: string | null };

interface Props {
  userId: string;
  profile: {
    id: string;
    lifecycleStage: InstructorLifecycleStage;
    isLeadershipTrack: boolean;
    isOnHold: boolean;
    weeklyHoursAvail: number | null;
    maxConcurrent: number;
    readinessScore: number | null;
    reliabilityScore: number | null;
  } | null;
  user: {
    name: string;
    email: string;
    chapterName: string | null;
    growthTier: string | null;
    interviewStatus: string | null;
  };
  notes: Note[];
  tasks: Task[];
  tags: Tag[];
  metrics: Metric[];
  allTags: AllTag[];
}

// ── Stage labels / colors ──────────────────────────────────────────────────

const STAGE_OPTIONS: { value: InstructorLifecycleStage; label: string; color: string }[] = [
  { value: "APPLICANT", label: "Applicant", color: "#6b21c8" },
  { value: "ONBOARDING", label: "Onboarding", color: "#7c3aed" },
  { value: "ACTIVE", label: "Active", color: "#16a34a" },
  { value: "BENCH", label: "Bench", color: "#2563eb" },
  { value: "PAUSED", label: "Paused", color: "#d97706" },
  { value: "ALUMNI", label: "Alumni", color: "#71717a" },
];

const TASK_KINDS: InstructorTaskKind[] = [
  "MANUAL",
  "CERT_EXPIRING",
  "STALLED_STAGE",
  "IDLE_30D",
  "DECLINED_REPEAT",
  "GHOSTING_MENTEE",
  "TRAINING_OVERDUE",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  const bg = tag.color ?? "#e0e7ff";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        background: bg,
        color: "#1e1b4b",
      }}
    >
      <span style={{ opacity: 0.6, fontSize: 10 }}>{tag.namespace.toLowerCase()}</span>
      {tag.label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "inherit", opacity: 0.5 }}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function InstructorProfileClient({
  userId,
  profile: initialProfile,
  user,
  notes: initialNotes,
  tasks: initialTasks,
  tags: initialTags,
  metrics,
  allTags,
}: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "tasks" | "tags" | "metrics">("overview");
  const [isPending, startTransition] = useTransition();

  // Optimistic local state
  const [stage, setStage] = useState<InstructorLifecycleStage>(initialProfile?.lifecycleStage ?? "ACTIVE");
  const [isLeadershipTrack, setIsLeadershipTrack] = useState(initialProfile?.isLeadershipTrack ?? false);
  const [isOnHold, setIsOnHold] = useState(initialProfile?.isOnHold ?? false);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [tags, setTags] = useState<Tag[]>(initialTags);

  // Note form
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskKind, setTaskKind] = useState<InstructorTaskKind>("MANUAL");
  const [taskDueAt, setTaskDueAt] = useState("");

  // Tag picker
  const [showTagPicker, setShowTagPicker] = useState(false);

  // ── Stage change ───────────────────────────────────────────────────────────

  function handleStageChange(newStage: InstructorLifecycleStage) {
    setStage(newStage);
    startTransition(() => { updateInstructorLifecycleStage(userId, newStage); });
  }

  function handleProfileFlag(field: "isLeadershipTrack" | "isOnHold", value: boolean) {
    if (field === "isLeadershipTrack") setIsLeadershipTrack(value);
    if (field === "isOnHold") setIsOnHold(value);
    startTransition(() => {
      upsertInstructorProfile({ userId, [field]: value });
    });
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  async function handleAddNote() {
    if (!noteBody.trim()) return;
    const result = await createInstructorNote({ userId, body: noteBody.trim() });
    if (result.success) {
      setNotes((prev) => [
        {
          id: result.note.id,
          body: result.note.body,
          isPinned: result.note.isPinned,
          visibility: result.note.visibility,
          authorName: (result.note as { author?: { name?: string } }).author?.name ?? "You",
          createdAt: result.note.createdAt.toISOString(),
          updatedAt: result.note.updatedAt.toISOString(),
        },
        ...prev,
      ]);
      setNoteBody("");
    }
  }

  async function handleUpdateNote(id: string, body: string) {
    await updateInstructorNote(id, { body });
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body, updatedAt: new Date().toISOString() } : n)));
    setEditingNoteId(null);
  }

  async function handlePinNote(id: string, isPinned: boolean) {
    await updateInstructorNote(id, { isPinned });
    setNotes((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, isPinned } : n));
      return [...updated].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    });
  }

  async function handleDeleteNote(id: string) {
    await deleteInstructorNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async function handleAddTask() {
    if (!taskTitle.trim()) return;
    const result = await createInstructorTask({
      userId,
      title: taskTitle.trim(),
      description: taskDesc.trim() || undefined,
      kind: taskKind,
      dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : undefined,
    });
    if (result.success) {
      setTasks((prev) => [
        {
          id: result.task.id,
          kind: result.task.kind,
          title: result.task.title,
          description: result.task.description ?? null,
          dueAt: result.task.dueAt?.toISOString() ?? null,
          assigneeName: null,
          resolvedAt: null,
          createdAt: result.task.createdAt.toISOString(),
        },
        ...prev,
      ]);
      setTaskTitle("");
      setTaskDesc("");
      setTaskKind("MANUAL");
      setTaskDueAt("");
      setShowTaskForm(false);
    }
  }

  async function handleResolveTask(id: string) {
    await resolveInstructorTask(id);
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, resolvedAt: new Date().toISOString() } : t)),
    );
  }

  async function handleDeleteTask(id: string) {
    await deleteInstructorTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  function handleTagAdd(tagId: string) {
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag || tags.some((t) => t.tagId === tagId)) return;
    setTags((prev) => [
      ...prev,
      { tagId, namespace: tag.namespace, slug: tag.slug, label: tag.label, color: tag.color },
    ]);
    setShowTagPicker(false);
    startTransition(() => { addTagToInstructor(userId, tagId); });
  }

  function handleTagRemove(tagId: string) {
    setTags((prev) => prev.filter((t) => t.tagId !== tagId));
    startTransition(() => { removeTagFromInstructor(userId, tagId); });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const stageOption = STAGE_OPTIONS.find((s) => s.value === stage) ?? STAGE_OPTIONS[2];
  const openTasks = tasks.filter((t) => !t.resolvedAt);
  const resolvedTasks = tasks.filter((t) => t.resolvedAt);

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
        {(["overview", "notes", "tasks", "tags", "metrics"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 18px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? "#7c3aed" : "var(--muted)",
              borderBottom: activeTab === tab ? "2px solid #7c3aed" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "tasks" && openTasks.length > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  background: "#dc2626",
                  color: "#fff",
                  borderRadius: "50%",
                  fontSize: 10,
                  padding: "0 5px",
                  fontWeight: 700,
                }}
              >
                {openTasks.length}
              </span>
            )}
          </button>
        ))}
        {isPending && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
            Saving…
          </span>
        )}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid two" style={{ gap: 16, alignItems: "start" }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14 }}>Lifecycle Stage</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STAGE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleStageChange(s.value)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: stage === s.value ? `2px solid ${s.color}` : "1px solid #d1d5db",
                    background: stage === s.value ? s.color + "18" : "#fff",
                    color: stage === s.value ? s.color : "inherit",
                    fontWeight: stage === s.value ? 700 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14 }}>Flags</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isLeadershipTrack}
                  onChange={(e) => handleProfileFlag("isLeadershipTrack", e.target.checked)}
                />
                <span style={{ fontSize: 13 }}>
                  <strong>Leadership track</strong>
                  <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: 12 }}>
                    Surfaces in leadership pipeline
                  </span>
                </span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isOnHold}
                  onChange={(e) => handleProfileFlag("isOnHold", e.target.checked)}
                />
                <span style={{ fontSize: 13 }}>
                  <strong>On hold</strong>
                  <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: 12 }}>
                    Excluded from assignment suggestions
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14 }}>Tags</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tags.map((t) => (
                <TagChip key={t.tagId} tag={t} onRemove={() => handleTagRemove(t.tagId)} />
              ))}
              <button
                onClick={() => setShowTagPicker((v) => !v)}
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 10,
                  border: "1px dashed #d1d5db",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                + Add tag
              </button>
            </div>
            {showTagPicker && (
              <div
                style={{
                  marginTop: 8,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  maxHeight: 180,
                  overflowY: "auto",
                  background: "#fff",
                }}
              >
                {allTags
                  .filter((t) => !tags.some((rt) => rt.tagId === t.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTagAdd(t.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "5px 8px",
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

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14 }}>Open Tasks ({openTasks.length})</h3>
            {openTasks.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>No open tasks.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {openTasks.slice(0, 3).map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span>{t.title}</span>
                    {t.dueAt && (
                      <span style={{ fontSize: 11, color: new Date(t.dueAt) < new Date() ? "#dc2626" : "var(--muted)" }}>
                        Due {formatDate(t.dueAt)}
                      </span>
                    )}
                  </div>
                ))}
                {openTasks.length > 3 && (
                  <button
                    onClick={() => setActiveTab("tasks")}
                    style={{ fontSize: 12, color: "#7c3aed", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                  >
                    +{openTasks.length - 3} more →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notes tab ────────────────────────────────────────────────────── */}
      {activeTab === "notes" && (
        <div style={{ maxWidth: 720 }}>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add a note about this instructor…"
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleAddNote}
                disabled={!noteBody.trim()}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#7c3aed",
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: noteBody.trim() ? 1 : 0.5,
                }}
              >
                Add note
              </button>
            </div>
          </div>

          {notes.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 32 }}>
              No notes yet.
            </p>
          )}

          {notes.map((note) => (
            <div
              key={note.id}
              className="card"
              style={{
                padding: 16,
                marginBottom: 10,
                borderLeft: note.isPinned ? "3px solid #7c3aed" : undefined,
              }}
            >
              {editingNoteId === note.id ? (
                <>
                  <textarea
                    value={editingNoteBody}
                    onChange={(e) => setEditingNoteBody(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleUpdateNote(note.id, editingNoteBody)}
                      style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "none", background: "#7c3aed", color: "#fff", cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingNoteId(null)}
                      style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "none", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 8px", fontSize: 13, whiteSpace: "pre-wrap" }}>{note.body}</p>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 11, color: "var(--muted)" }}>
                    <span>{note.authorName}</span>
                    <span>{formatDate(note.createdAt)}</span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handlePinNote(note.id, !note.isPinned)}
                        style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, color: note.isPinned ? "#7c3aed" : "var(--muted)" }}
                      >
                        {note.isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        onClick={() => { setEditingNoteId(note.id); setEditingNoteBody(note.body); }}
                        style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, color: "#dc2626" }}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tasks tab ────────────────────────────────────────────────────── */}
      {activeTab === "tasks" && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setShowTaskForm((v) => !v)}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: "1px solid #7c3aed",
                background: showTaskForm ? "#7c3aed" : "#fff",
                color: showTaskForm ? "#fff" : "#7c3aed",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + New task
            </button>
          </div>

          {showTaskForm && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  placeholder="Task title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  style={inputStyle}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={taskKind} onChange={(e) => setTaskKind(e.target.value as InstructorTaskKind)} style={inputStyle}>
                    {TASK_KINDS.map((k) => (
                      <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={taskDueAt}
                    onChange={(e) => setTaskDueAt(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowTaskForm(false)}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "none", fontSize: 13, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={!taskTitle.trim()}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#7c3aed", color: "#fff", fontSize: 13, cursor: "pointer" }}
                  >
                    Create task
                  </button>
                </div>
              </div>
            </div>
          )}

          {openTasks.length === 0 && !showTaskForm && (
            <p style={{ fontSize: 13, color: "var(--muted)", padding: "20px 0" }}>No open tasks.</p>
          )}

          {openTasks.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{
                padding: 14,
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{task.title}</div>
                {task.description && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{task.description}</div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 6,
                      background: "#f3f4f6",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {task.kind.replace(/_/g, " ")}
                  </span>
                  {task.dueAt && (
                    <span style={{ color: new Date(task.dueAt) < new Date() ? "#dc2626" : "inherit" }}>
                      Due {formatDate(task.dueAt)}
                    </span>
                  )}
                  {task.assigneeName && <span>Assigned: {task.assigneeName}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => handleResolveTask(task.id)}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #16a34a",
                    background: "#f0fdf4",
                    color: "#16a34a",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Resolve
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "none", cursor: "pointer", color: "#dc2626" }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          {resolvedTasks.length > 0 && (
            <details style={{ marginTop: 20 }}>
              <summary style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
                {resolvedTasks.length} resolved task{resolvedTasks.length > 1 ? "s" : ""}
              </summary>
              {resolvedTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: "10px 14px",
                    marginTop: 6,
                    borderRadius: 6,
                    background: "#f9fafb",
                    opacity: 0.6,
                    fontSize: 13,
                  }}
                >
                  <span style={{ textDecoration: "line-through" }}>{task.title}</span>
                  {task.resolvedAt && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)" }}>
                      Resolved {formatDate(task.resolvedAt)}
                    </span>
                  )}
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      {/* ── Tags tab ─────────────────────────────────────────────────────── */}
      {activeTab === "tags" && (
        <div style={{ maxWidth: 600 }}>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Current tags</h3>
            {tags.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>No tags yet.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tags.map((t) => (
                  <TagChip key={t.tagId} tag={t} onRemove={() => handleTagRemove(t.tagId)} />
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Add tags</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {["SKILL", "INTEREST", "LANGUAGE", "AVAILABILITY", "TRAIT", "CUSTOM"].map((ns) => {
                const nsTag = allTags.filter((t) => t.namespace === ns && !tags.some((rt) => rt.tagId === t.id));
                if (nsTag.length === 0) return null;
                return (
                  <div key={ns}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                      {ns}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {nsTag.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleTagAdd(t.id)}
                          style={{
                            fontSize: 12,
                            padding: "3px 10px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          + {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Metrics tab ──────────────────────────────────────────────────── */}
      {activeTab === "metrics" && (
        <div style={{ maxWidth: 720 }}>
          {metrics.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                No metric snapshots yet. Snapshots are recorded weekly by the scheduled job.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    {["Week", "Classes", "Hours", "No-shows", "Avg rating", "Students"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.weekStart} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 14px" }}>{formatDate(m.weekStart)}</td>
                      <td style={{ padding: "10px 14px" }}>{m.classesTaught}</td>
                      <td style={{ padding: "10px 14px" }}>{m.hoursTaught}</td>
                      <td style={{ padding: "10px 14px", color: m.noShows > 0 ? "#dc2626" : undefined }}>
                        {m.noShows}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {m.ratingAvg != null ? m.ratingAvg.toFixed(1) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>{m.studentsServed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 13,
  background: "#fff",
  width: "100%",
  boxSizing: "border-box",
};
