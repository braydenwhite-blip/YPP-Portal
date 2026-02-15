"use client";

import { useState } from "react";
import {
  assignTrainingToUser,
  bulkAssignModuleToInstructors,
  createTrainingCheckpoint,
  createTrainingModuleWithVideo,
  createTrainingQuizQuestion,
  deleteTrainingCheckpoint,
  deleteTrainingModule,
  deleteTrainingQuizQuestion,
  markTrainingComplete,
  updateTrainingCheckpoint,
  updateTrainingModule,
  updateTrainingQuizQuestion,
} from "@/lib/training-actions";
import { TrainingModuleType, VideoProvider } from "@prisma/client";

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
  title: string;
  description: string | null;
  sortOrder: number;
  required: boolean;
}

interface ModuleQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  sortOrder: number;
}

interface Module {
  id: string;
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

export default function TrainingManager({
  modules,
  instructors,
}: {
  modules: Module[];
  instructors: Instructor[];
}) {
  const [activeTab, setActiveTab] = useState<"modules" | "create">("modules");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);

  return (
    <div>
      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{modules.length}</div>
          <div className="kpi-label">Total Modules</div>
        </div>
        <div className="card">
          <div className="kpi">{modules.filter((m) => m.required).length}</div>
          <div className="kpi-label">Required Modules</div>
        </div>
        <div className="card">
          <div className="kpi">{instructors.length}</div>
          <div className="kpi-label">Instructors</div>
        </div>
      </div>

      <div className="admin-training-tabs">
        <button
          className={`admin-training-tab ${activeTab === "modules" ? "active" : ""}`}
          onClick={() => setActiveTab("modules")}
        >
          All Modules ({modules.length})
        </button>
        <button
          className={`admin-training-tab ${activeTab === "create" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("create");
            setEditingModule(null);
          }}
        >
          + Create Module
        </button>
      </div>

      {activeTab === "create" && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{editingModule ? "Edit Module" : "Create New Training Module"}</h3>
          <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13 }}>
            Required modules must include at least one requirement path (video, required checkpoints, quiz, or evidence).
          </p>
          <form
            action={editingModule ? updateTrainingModule : createTrainingModuleWithVideo}
            className="form-grid"
          >
            {editingModule && (
              <input type="hidden" name="moduleId" value={editingModule} />
            )}
            <div className="grid two">
              <label className="form-row">
                Title
                <input
                  className="input"
                  name="title"
                  required
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.title : ""}
                />
              </label>
              <label className="form-row">
                Type
                <select
                  className="input"
                  name="type"
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.type : TrainingModuleType.WORKSHOP}
                >
                  {Object.values(TrainingModuleType).map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-row">
              Description
              <textarea
                className="input"
                name="description"
                rows={3}
                required
                defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.description : ""}
              />
            </label>
            <div className="grid two">
              <label className="form-row">
                Material URL (optional)
                <input
                  className="input"
                  name="materialUrl"
                  type="url"
                  placeholder="https://..."
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.materialUrl ?? "" : ""}
                />
              </label>
              <label className="form-row">
                Material Notes (optional)
                <input
                  className="input"
                  name="materialNotes"
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.materialNotes ?? "" : ""}
                />
              </label>
            </div>
            <div className="grid two">
              <label className="form-row">
                Video URL (optional)
                <input
                  className="input"
                  name="videoUrl"
                  type="url"
                  placeholder="https://youtube.com/..."
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.videoUrl ?? "" : ""}
                />
              </label>
              <label className="form-row">
                Video Provider
                <select
                  className="input"
                  name="videoProvider"
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.videoProvider ?? "" : ""}
                >
                  <option value="">None</option>
                  {Object.values(VideoProvider).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid three">
              <label className="form-row">
                Video Duration (seconds)
                <input
                  className="input"
                  name="videoDuration"
                  type="number"
                  min={0}
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.videoDuration ?? "" : ""}
                />
              </label>
              <label className="form-row">
                Sort Order
                <input
                  className="input"
                  name="sortOrder"
                  type="number"
                  min={1}
                  required
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.sortOrder : modules.length + 1}
                />
              </label>
              <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 24 }}>
                <input
                  type="checkbox"
                  name="required"
                  defaultChecked={editingModule ? modules.find((m) => m.id === editingModule)?.required : true}
                />
                Required for all instructors
              </label>
            </div>
            <div className="grid three">
              <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 24 }}>
                <input
                  type="checkbox"
                  name="requiresQuiz"
                  defaultChecked={editingModule ? modules.find((m) => m.id === editingModule)?.requiresQuiz : false}
                />
                Require quiz
              </label>
              <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 24 }}>
                <input
                  type="checkbox"
                  name="requiresEvidence"
                  defaultChecked={editingModule ? modules.find((m) => m.id === editingModule)?.requiresEvidence : false}
                />
                Require evidence review
              </label>
              <label className="form-row">
                Pass score %
                <input
                  className="input"
                  name="passScorePct"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.passScorePct ?? 80 : 80}
                />
              </label>
            </div>
            <input type="hidden" name="videoThumbnail" value="" />
            <div style={{ display: "flex", gap: 12 }}>
              <button className="button small" type="submit">
                {editingModule ? "Save Changes" : "Create Module"}
              </button>
              {editingModule && (
                <button
                  className="button small outline"
                  type="button"
                  onClick={() => {
                    setEditingModule(null);
                    setActiveTab("modules");
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {activeTab === "modules" && (
        <div className="admin-training-modules">
          {modules.length === 0 ? (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="empty">No training modules yet. Create one to get started.</p>
            </div>
          ) : (
            modules.map((mod) => {
              const isExpanded = expandedModule === mod.id;
              const completedCount = mod.assignments.filter((a) => a.status === "COMPLETE").length;
              const inProgressCount = mod.assignments.filter((a) => a.status === "IN_PROGRESS").length;
              const notStartedCount = mod.assignments.filter((a) => a.status === "NOT_STARTED").length;
              const assignedInstructorIds = new Set(mod.assignments.map((a) => a.userId));
              const unassignedInstructors = instructors.filter((i) => !assignedInstructorIds.has(i.id));
              const requiredCheckpointCount = mod.checkpoints.filter((checkpoint) => checkpoint.required).length;

              return (
                <div key={mod.id} className="admin-training-module-card">
                  <div
                    className="admin-training-module-header"
                    onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="admin-training-module-info">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="admin-training-module-order">#{mod.sortOrder}</span>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{mod.title}</h3>
                        <span className={`pill pill-small ${mod.required ? "pill-purple" : "pill-declined"}`}>
                          {mod.required ? "Required" : "Optional"}
                        </span>
                        <span className="pill pill-small pill-info">{mod.type.replace(/_/g, " ")}</span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                        {mod.description}
                      </p>
                    </div>
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
                      <span style={{ fontSize: 18, color: "var(--muted)" }}>
                        {isExpanded ? "\u25B2" : "\u25BC"}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="admin-training-module-body">
                      <div className="admin-training-meta-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className={`pill pill-small ${mod.videoUrl ? "pill-success" : "pill-pending"}`}>
                          Video {mod.videoUrl ? "Configured" : "Not set"}
                        </span>
                        <span className={`pill pill-small ${requiredCheckpointCount > 0 ? "pill-success" : "pill-pending"}`}>
                          Required checkpoints: {requiredCheckpointCount}
                        </span>
                        <span className={`pill pill-small ${mod.requiresQuiz ? "pill-pathway" : "pill-pending"}`}>
                          Quiz {mod.requiresQuiz ? `On (${mod.quizQuestions.length} Qs)` : "Off"}
                        </span>
                        <span className={`pill pill-small ${mod.requiresEvidence ? "pill-pathway" : "pill-pending"}`}>
                          Evidence {mod.requiresEvidence ? "Required" : "Optional"}
                        </span>
                        <span className="pill pill-small">Pass score: {mod.passScorePct}%</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 16, marginTop: 12, flexWrap: "wrap" }}>
                        <button
                          className="button small outline"
                          onClick={() => {
                            setEditingModule(mod.id);
                            setActiveTab("create");
                          }}
                        >
                          Edit Module
                        </button>
                        <form action={bulkAssignModuleToInstructors} style={{ display: "inline" }}>
                          <input type="hidden" name="moduleId" value={mod.id} />
                          <button className="button small" type="submit">
                            Assign to All Instructors
                          </button>
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
                          <button className="button small danger" type="submit">
                            Delete
                          </button>
                        </form>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 8 }}>Checkpoints</h4>
                        {mod.checkpoints.length === 0 ? (
                          <p className="empty" style={{ marginTop: 0 }}>No checkpoints yet.</p>
                        ) : (
                          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                            {mod.checkpoints.map((checkpoint) => (
                              <div key={checkpoint.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                                <form action={updateTrainingCheckpoint} className="form-grid">
                                  <input type="hidden" name="checkpointId" value={checkpoint.id} />
                                  <div className="grid two">
                                    <label className="form-row">
                                      Title
                                      <input className="input" name="title" defaultValue={checkpoint.title} required />
                                    </label>
                                    <label className="form-row">
                                      Sort order
                                      <input className="input" name="sortOrder" type="number" min={1} defaultValue={checkpoint.sortOrder} required />
                                    </label>
                                  </div>
                                  <label className="form-row">
                                    Description
                                    <textarea className="input" name="description" rows={2} defaultValue={checkpoint.description ?? ""} />
                                  </label>
                                  <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input type="checkbox" name="required" defaultChecked={checkpoint.required} />
                                    Required checkpoint
                                  </label>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button className="button small" type="submit">Save checkpoint</button>
                                  </div>
                                </form>
                                <form
                                  action={deleteTrainingCheckpoint}
                                  onSubmit={(e) => {
                                    if (!confirm(`Delete checkpoint \"${checkpoint.title}\"?`)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  style={{ marginTop: 8 }}
                                >
                                  <input type="hidden" name="checkpointId" value={checkpoint.id} />
                                  <button className="button small outline" type="submit">Delete checkpoint</button>
                                </form>
                              </div>
                            ))}
                          </div>
                        )}

                        <form action={createTrainingCheckpoint} className="form-grid" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                          <input type="hidden" name="moduleId" value={mod.id} />
                          <div className="grid two">
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
                          <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input type="checkbox" name="required" defaultChecked />
                            Required checkpoint
                          </label>
                          <button className="button small" type="submit">Add checkpoint</button>
                        </form>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 8 }}>Quiz Questions</h4>
                        {mod.quizQuestions.length === 0 ? (
                          <p className="empty" style={{ marginTop: 0 }}>No quiz questions yet.</p>
                        ) : (
                          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                            {mod.quizQuestions.map((question) => (
                              <div key={question.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                                <form action={updateTrainingQuizQuestion} className="form-grid">
                                  <input type="hidden" name="questionId" value={question.id} />
                                  <div className="grid two">
                                    <label className="form-row">
                                      Question
                                      <input className="input" name="question" defaultValue={question.question} required />
                                    </label>
                                    <label className="form-row">
                                      Sort order
                                      <input className="input" name="sortOrder" type="number" min={1} defaultValue={question.sortOrder} required />
                                    </label>
                                  </div>
                                  <label className="form-row">
                                    Options (newline or comma separated)
                                    <textarea className="input" name="options" rows={3} defaultValue={question.options.join("\n")} required />
                                  </label>
                                  <label className="form-row">
                                    Correct answer (must match one option exactly)
                                    <input className="input" name="correctAnswer" defaultValue={question.correctAnswer} required />
                                  </label>
                                  <button className="button small" type="submit">Save question</button>
                                </form>
                                <form
                                  action={deleteTrainingQuizQuestion}
                                  onSubmit={(e) => {
                                    if (!confirm("Delete this quiz question?")) {
                                      e.preventDefault();
                                    }
                                  }}
                                  style={{ marginTop: 8 }}
                                >
                                  <input type="hidden" name="questionId" value={question.id} />
                                  <button className="button small outline" type="submit">Delete question</button>
                                </form>
                              </div>
                            ))}
                          </div>
                        )}

                        <form action={createTrainingQuizQuestion} className="form-grid" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                          <input type="hidden" name="moduleId" value={mod.id} />
                          <div className="grid two">
                            <label className="form-row">
                              New question
                              <input className="input" name="question" required />
                            </label>
                            <label className="form-row">
                              Sort order
                              <input className="input" name="sortOrder" type="number" min={1} defaultValue={mod.quizQuestions.length + 1} required />
                            </label>
                          </div>
                          <label className="form-row">
                            Options (newline or comma separated)
                            <textarea className="input" name="options" rows={3} placeholder="Option A\nOption B\nOption C" required />
                          </label>
                          <label className="form-row">
                            Correct answer (must match one option exactly)
                            <input className="input" name="correctAnswer" required />
                          </label>
                          <button className="button small" type="submit">Add question</button>
                        </form>
                      </div>

                      {unassignedInstructors.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <form action={assignTrainingToUser} className="admin-training-assign-row">
                            <input type="hidden" name="moduleId" value={mod.id} />
                            <select className="input" name="userId" style={{ marginTop: 0, maxWidth: 300 }} required>
                              <option value="">Assign to instructor...</option>
                              {unassignedInstructors.map((inst) => (
                                <option key={inst.id} value={inst.id}>
                                  {inst.name} ({inst.email})
                                </option>
                              ))}
                            </select>
                            <button className="button small" type="submit" style={{ marginTop: 0 }}>
                              Assign
                            </button>
                          </form>
                        </div>
                      )}

                      {mod.assignments.length > 0 ? (
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Instructor</th>
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
                                    a.status === "COMPLETE"
                                      ? "pill-success"
                                      : a.status === "IN_PROGRESS"
                                        ? ""
                                        : "pill-pending"
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
                        <p className="empty">No instructors assigned to this module yet.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
