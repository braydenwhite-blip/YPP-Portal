"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  assignTrainingToUser,
  bulkAssignModuleToInstructors,
  bulkAssignModuleToStudents,
  cloneTrainingModule,
  createTrainingCheckpoint,
  createTrainingQuizQuestion,
  deleteTrainingCheckpoint,
  deleteTrainingModule,
  deleteTrainingQuizQuestion,
  markTrainingComplete,
  reorderTrainingModules,
  updateTrainingCheckpoint,
  updateTrainingQuizQuestion,
} from "@/lib/training-actions";
import QuizOptionBuilder from "./quiz-option-builder";

// ------------------------------------
// Shared types (mirrored from training-manager.tsx)
// ------------------------------------

interface Assignment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  completedAt: string | null;
}

interface ModuleCheckpoint {
  id: string;
  contentKey: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  required: boolean;
}

interface ModuleQuizQuestion {
  id: string;
  contentKey: string | null;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  sortOrder: number;
}

interface Module {
  id: string;
  contentKey: string | null;
  title: string;
  description: string;
  materialUrl: string | null;
  materialNotes: string | null;
  type: string;
  required: boolean;
  sortOrder: number;
  videoUrl: string | null;
  videoProvider: string | null;
  videoDuration: number | null;
  videoThumbnail: string | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  passScorePct: number;
  estimatedMinutes: number | null;
  checkpoints: ModuleCheckpoint[];
  quizQuestions: ModuleQuizQuestion[];
  assignmentCount: number;
  assignments: Assignment[];
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface SortableModuleListProps {
  modules: Module[];
  instructors: Instructor[];
  students: Instructor[];
  onEdit: (moduleId: string) => void;
}

// ------------------------------------
// Type badge colours
// ------------------------------------

const MODULE_TYPE_PILL: Record<string, string> = {
  WORKSHOP: "pill-purple",
  SCENARIO_PRACTICE: "pill-info",
  CURRICULUM_REVIEW: "pill-pathway",
  RESOURCE: "pill-success",
};

// ------------------------------------
// Quiz edit form with visual option builder
// ------------------------------------

function QuizQuestionEditForm({ question }: { question: ModuleQuizQuestion }) {
  const [options, setOptions] = useState(question.options);
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer);

  return (
    <form action={updateTrainingQuizQuestion} className="form-grid">
      <input type="hidden" name="questionId" value={question.id} />
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <input type="hidden" name="correctAnswer" value={correctAnswer} />
      <div className="grid two">
        <label className="form-row">
          Content key
          <input
            className="input"
            name="contentKey"
            defaultValue={question.contentKey ?? ""}
            placeholder="foundations_q_01"
          />
        </label>
        <label className="form-row">
          Sort order
          <input className="input" name="sortOrder" type="number" min={1} defaultValue={question.sortOrder} required />
        </label>
      </div>
      <label className="form-row">
        Question
        <input className="input" name="question" defaultValue={question.question} required />
      </label>
      <div className="form-row">
        Options
        <QuizOptionBuilder
          options={options}
          correctAnswer={correctAnswer}
          onChange={(opts, correct) => { setOptions(opts); setCorrectAnswer(correct); }}
        />
      </div>
      <label className="form-row">
        Explanation (optional)
        <textarea className="input" name="explanation" rows={2} defaultValue={question.explanation ?? ""} />
      </label>
      {question.contentKey && (
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
          Key: <code>{question.contentKey}</code>
        </p>
      )}
      <button className="button small" type="submit">Save question</button>
    </form>
  );
}

function NewQuizQuestionForm({ moduleId, nextSortOrder }: { moduleId: string; nextSortOrder: number }) {
  const [options, setOptions] = useState(["", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");

  return (
    <form action={createTrainingQuizQuestion} className="form-grid" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <input type="hidden" name="correctAnswer" value={correctAnswer} />
      <div className="grid two">
        <label className="form-row">
          Content key
          <input className="input" name="contentKey" placeholder="foundations_q_07" />
        </label>
        <label className="form-row">
          Sort order
          <input className="input" name="sortOrder" type="number" min={1} defaultValue={nextSortOrder} required />
        </label>
      </div>
      <label className="form-row">
        Question
        <input className="input" name="question" required placeholder="What is...?" />
      </label>
      <div className="form-row">
        Options
        <QuizOptionBuilder
          options={options}
          correctAnswer={correctAnswer}
          onChange={(opts, correct) => { setOptions(opts); setCorrectAnswer(correct); }}
        />
      </div>
      <label className="form-row">
        Explanation (optional)
        <textarea className="input" name="explanation" rows={2} />
      </label>
      <button className="button small" type="submit">Add question</button>
    </form>
  );
}

// ------------------------------------
// Individual sortable module card
// ------------------------------------

function SortableModuleCard({
  mod,
  instructors,
  students,
  onEdit,
}: {
  mod: Module;
  instructors: Instructor[];
  students: Instructor[];
  onEdit: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isExpanded, setIsExpanded] = useState(false);

  const completedCount = mod.assignments.filter((a) => a.status === "COMPLETE").length;
  const inProgressCount = mod.assignments.filter((a) => a.status === "IN_PROGRESS").length;
  const notStartedCount = mod.assignments.filter((a) => a.status === "NOT_STARTED").length;
  const assignedLearnerIds = new Set(mod.assignments.map((a) => a.userId));
  const unassignedInstructors = instructors.filter((i) => !assignedLearnerIds.has(i.id));
  const unassignedStudents = students.filter((s) => !assignedLearnerIds.has(s.id));
  const requiredCheckpointCount = mod.checkpoints.filter((c) => c.required).length;
  const typePill = MODULE_TYPE_PILL[mod.type] ?? "pill-declined";

  return (
    <div ref={setNodeRef} style={style} className="admin-training-module-card">
      <div className="admin-training-module-header">
        {/* Drag handle — separate from the expand button */}
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          type="button"
          title="Drag to reorder"
        >
          ⠿
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          className="admin-training-module-info"
          style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", flex: 1, padding: 0 }}
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="admin-training-module-order">#{mod.sortOrder}</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{mod.title}</span>
            <span className={`pill pill-small ${mod.required ? "pill-purple" : "pill-declined"}`}>
              {mod.required ? "Required" : "Optional"}
            </span>
            <span className={`pill pill-small ${typePill}`}>
              {mod.type.replace(/_/g, " ")}
            </span>
            {mod.estimatedMinutes && (
              <span className="pill pill-small" style={{ color: "var(--muted)" }}>
                ⏱ {mod.estimatedMinutes} min
              </span>
            )}
          </div>
          {mod.contentKey && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
              Key: <code>{mod.contentKey}</code>
            </p>
          )}
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            {mod.description}
          </p>
        </button>

        <div className="admin-training-module-stats">
          <div className="admin-training-stat-badges">
            {completedCount > 0 && (
              <span className="pill pill-small pill-success">{completedCount} done</span>
            )}
            {inProgressCount > 0 && (
              <span className="pill pill-small">{inProgressCount} in progress</span>
            )}
            {notStartedCount > 0 && (
              <span className="pill pill-small pill-pending">{notStartedCount} not started</span>
            )}
            {mod.assignments.length === 0 && (
              <span className="pill pill-small pill-declined">No assignments</span>
            )}
          </div>
          <span
            style={{ fontSize: 18, color: "var(--muted)", userSelect: "none", cursor: "pointer" }}
            onClick={() => setIsExpanded((v) => !v)}
            aria-hidden="true"
          >
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="admin-training-module-body">
          {/* Status row */}
          <div className="admin-training-meta-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`pill pill-small ${mod.videoUrl ? "pill-success" : "pill-pending"}`}>
              Video {mod.videoUrl ? "Configured" : "Not set"}
            </span>
            <span className={`pill pill-small ${requiredCheckpointCount > 0 ? "pill-success" : "pill-pending"}`}>
              Checkpoints: {requiredCheckpointCount} required
            </span>
            <span className={`pill pill-small ${mod.requiresQuiz ? "pill-pathway" : "pill-pending"}`}>
              Quiz {mod.requiresQuiz ? `On (${mod.quizQuestions.length} Qs)` : "Off"}
            </span>
            <span className={`pill pill-small ${mod.requiresEvidence ? "pill-pathway" : "pill-pending"}`}>
              Evidence {mod.requiresEvidence ? "Required" : "Optional"}
            </span>
            <span className="pill pill-small">Pass: {mod.passScorePct}%</span>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, margin: "12px 0 16px", flexWrap: "wrap" }}>
            <button
              className="button small outline"
              type="button"
              onClick={() => onEdit(mod.id)}
            >
              Edit Module
            </button>
            <form action={cloneTrainingModule} style={{ display: "inline" }}>
              <input type="hidden" name="moduleId" value={mod.id} />
              <button className="button small outline" type="submit">Clone</button>
            </form>
            <form action={bulkAssignModuleToInstructors} style={{ display: "inline" }}>
              <input type="hidden" name="moduleId" value={mod.id} />
              <button className="button small" type="submit">Assign All Instructors</button>
            </form>
            <form action={bulkAssignModuleToStudents} style={{ display: "inline" }}>
              <input type="hidden" name="moduleId" value={mod.id} />
              <button className="button small" type="submit">Assign All Students</button>
            </form>
            <form
              action={deleteTrainingModule}
              style={{ display: "inline" }}
              onSubmit={(e) => {
                if (!confirm(`Delete "${mod.title}"? This will remove all assignments too.`)) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="moduleId" value={mod.id} />
              <button className="button small danger" type="submit">Delete</button>
            </form>
          </div>

          {/* Checkpoints */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Checkpoints</h4>
            {mod.checkpoints.length === 0 ? (
              <p className="empty" style={{ marginTop: 0 }}>No checkpoints yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                {mod.checkpoints.map((cp) => (
                  <div key={cp.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                    <form action={updateTrainingCheckpoint} className="form-grid">
                      <input type="hidden" name="checkpointId" value={cp.id} />
                      <div className="grid three">
                        <label className="form-row">
                          Content key
                          <input className="input" name="contentKey" defaultValue={cp.contentKey ?? ""} placeholder="foundations_cp_01" />
                        </label>
                        <label className="form-row">
                          Title
                          <input className="input" name="title" defaultValue={cp.title} required />
                        </label>
                        <label className="form-row">
                          Sort order
                          <input className="input" name="sortOrder" type="number" min={1} defaultValue={cp.sortOrder} required />
                        </label>
                      </div>
                      <label className="form-row">
                        Description
                        <textarea className="input" name="description" rows={2} defaultValue={cp.description ?? ""} />
                      </label>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                        <input type="checkbox" name="required" defaultChecked={cp.required} />
                        Required checkpoint
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="button small" type="submit">Save</button>
                      </div>
                    </form>
                    <form
                      action={deleteTrainingCheckpoint}
                      onSubmit={(e) => {
                        if (!confirm(`Delete checkpoint "${cp.title}"?`)) e.preventDefault();
                      }}
                      style={{ marginTop: 8 }}
                    >
                      <input type="hidden" name="checkpointId" value={cp.id} />
                      <button className="button small outline" type="submit">Delete</button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <form action={createTrainingCheckpoint} className="form-grid" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <input type="hidden" name="moduleId" value={mod.id} />
              <div className="grid three">
                <label className="form-row">
                  Content key
                  <input className="input" name="contentKey" placeholder="foundations_cp_06" />
                </label>
                <label className="form-row">
                  New checkpoint title
                  <input className="input" name="title" required />
                </label>
                <label className="form-row">
                  Sort order
                  <input className="input" name="sortOrder" type="number" min={1} defaultValue={mod.checkpoints.length + 1} required />
                </label>
              </div>
              <label className="form-row">
                Description
                <textarea className="input" name="description" rows={2} />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" name="required" defaultChecked />
                Required checkpoint
              </label>
              <button className="button small" type="submit">Add checkpoint</button>
            </form>
          </div>

          {/* Quiz Questions */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Quiz Questions</h4>
            {mod.quizQuestions.length === 0 ? (
              <p className="empty" style={{ marginTop: 0 }}>No quiz questions yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                {mod.quizQuestions.map((q) => (
                  <div key={q.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                    <QuizQuestionEditForm question={q} />
                    <form
                      action={deleteTrainingQuizQuestion}
                      onSubmit={(e) => {
                        if (!confirm("Delete this quiz question?")) e.preventDefault();
                      }}
                      style={{ marginTop: 8 }}
                    >
                      <input type="hidden" name="questionId" value={q.id} />
                      <button className="button small outline" type="submit">Delete question</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            <NewQuizQuestionForm moduleId={mod.id} nextSortOrder={mod.quizQuestions.length + 1} />
          </div>

          {/* Assign instructors */}
          {unassignedInstructors.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <form action={assignTrainingToUser} className="admin-training-assign-row">
                <input type="hidden" name="moduleId" value={mod.id} />
                <select className="input" name="userId" style={{ marginTop: 0, maxWidth: 300 }} required>
                  <option value="">Assign to instructor...</option>
                  {unassignedInstructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name} ({inst.email})</option>
                  ))}
                </select>
                <button className="button small" type="submit" style={{ marginTop: 0 }}>Assign</button>
              </form>
            </div>
          )}

          {/* Assign students */}
          {unassignedStudents.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <form action={assignTrainingToUser} className="admin-training-assign-row">
                <input type="hidden" name="moduleId" value={mod.id} />
                <select className="input" name="userId" style={{ marginTop: 0, maxWidth: 300 }} required>
                  <option value="">Assign to student...</option>
                  {unassignedStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
                <button className="button small" type="submit" style={{ marginTop: 0 }}>Assign</button>
              </form>
            </div>
          )}

          {/* Assignments table */}
          {mod.assignments.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mod.assignments.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.userName}</td>
                    <td>{a.userEmail}</td>
                    <td>
                      <span className={`pill pill-small ${
                        a.status === "COMPLETE" ? "pill-success" : a.status === "IN_PROGRESS" ? "" : "pill-pending"
                      }`}>
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "—"}</td>
                    <td>
                      {a.status !== "COMPLETE" && (
                        <form action={markTrainingComplete} style={{ display: "inline" }}>
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <button className="button small" type="submit" style={{ marginTop: 0 }}>
                            Mark Complete
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">No learners assigned to this module yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------
// Main sortable list with DnD context
// ------------------------------------

export default function SortableModuleList({
  modules,
  instructors,
  students,
  onEdit,
}: SortableModuleListProps) {
  const [items, setItems] = useState(modules);
  const [, startTransition] = useTransition();

  // Keep items in sync when modules prop changes (after server revalidation)
  // This is a controlled comparison — if lengths or ids differ, reset
  const moduleIds = modules.map((m) => m.id).join(",");
  const itemIds = items.map((m) => m.id).join(",");
  if (moduleIds !== itemIds) {
    setItems(modules);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((m, i) => ({
      ...m,
      sortOrder: i + 1,
    }));

    // Optimistic update
    setItems(reordered);

    // Persist to server
    const formData = new FormData();
    formData.set("order", JSON.stringify(reordered.map((m) => ({ id: m.id, sortOrder: m.sortOrder }))));
    startTransition(async () => {
      await reorderTrainingModules(formData);
    });
  }

  if (items.length === 0) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <p className="empty">No training modules yet. Click &quot;+ New Module&quot; to create one.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="admin-training-modules">
          {items.map((mod) => (
            <SortableModuleCard
              key={mod.id}
              mod={mod}
              instructors={instructors}
              students={students}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
