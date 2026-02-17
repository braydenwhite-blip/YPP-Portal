"use client";

import { useState, useTransition } from "react";
import {
  assignTrainingToUser,
  bulkAssignModuleToInstructors,
  bulkAssignModuleToStudents,
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
import {
  exportTrainingContentDraft,
  importTrainingContentDraft,
  loadTrainingContentFromDb,
  validateTrainingContentDraft,
} from "@/lib/training-content-actions";
import { useRouter } from "next/navigation";
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

type JsonSyncCounters = {
  modulesCreated: number;
  modulesUpdated: number;
  modulesDeleted: number;
  checkpointsCreated: number;
  checkpointsUpdated: number;
  checkpointsDeleted: number;
  quizCreated: number;
  quizUpdated: number;
  quizDeleted: number;
  assignmentsCreated: number;
};

type JsonSyncResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counters?: JsonSyncCounters | null;
  message?: string;
};

export default function TrainingManager({
  modules,
  instructors,
  students,
}: {
  modules: Module[];
  instructors: Instructor[];
  students: Instructor[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"modules" | "create" | "json">("modules");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonPrune, setJsonPrune] = useState(false);
  const [jsonResult, setJsonResult] = useState<JsonSyncResult | null>(null);
  const [isJsonPending, startJsonTransition] = useTransition();

  function setJsonError(message: string) {
    setJsonResult({
      ok: false,
      errors: [message],
      warnings: [],
      counters: null,
    });
  }

  function loadJsonFromDb() {
    startJsonTransition(async () => {
      try {
        const result = await loadTrainingContentFromDb();
        if (!result.ok || !result.content) {
          setJsonResult({
            ok: false,
            errors: result.errors,
            warnings: result.warnings,
            counters: null,
          });
          return;
        }
        setJsonDraft(result.rawJson);
        setJsonResult({
          ok: true,
          errors: [],
          warnings: result.warnings,
          counters: null,
          message: `Loaded ${result.content.modules.length} module(s) from database.`,
        });
      } catch (error) {
        setJsonError(
          error instanceof Error ? error.message : "Failed to load JSON draft from database."
        );
      }
    });
  }

  function validateJsonDraft() {
    startJsonTransition(async () => {
      try {
        const result = await validateTrainingContentDraft(jsonDraft);
        setJsonResult({
          ok: result.ok,
          errors: result.errors,
          warnings: result.warnings,
          counters: null,
          message: result.ok
            ? "Validation passed."
            : "Validation failed. Fix the errors and try again.",
        });
      } catch (error) {
        setJsonError(
          error instanceof Error ? error.message : "Validation request failed."
        );
      }
    });
  }

  function importJsonDraft() {
    startJsonTransition(async () => {
      try {
        const result = await importTrainingContentDraft(jsonDraft, jsonPrune);
        setJsonResult({
          ok: result.ok,
          errors: result.errors,
          warnings: result.warnings,
          counters: result.counters,
          message: result.ok
            ? "Import complete."
            : "Import failed. Review errors before retrying.",
        });
        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setJsonError(
          error instanceof Error ? error.message : "Import request failed."
        );
      }
    });
  }

  function exportJsonDraft() {
    startJsonTransition(async () => {
      try {
        const result = await exportTrainingContentDraft();
        if (!result.ok || !result.content) {
          setJsonResult({
            ok: false,
            errors: result.errors,
            warnings: result.warnings,
            counters: null,
          });
          return;
        }

        setJsonDraft(result.rawJson);
        let message = `Exported ${result.content.modules.length} module(s) to draft.`;

        if (typeof navigator !== "undefined" && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(result.rawJson);
            message = `${message} Copied to clipboard.`;
          } catch {
            message = `${message} Clipboard copy was blocked by browser permissions.`;
          }
        }

        setJsonResult({
          ok: true,
          errors: [],
          warnings: result.warnings,
          counters: null,
          message,
        });
      } catch (error) {
        setJsonError(
          error instanceof Error ? error.message : "Export request failed."
        );
      }
    });
  }

  return (
    <div>
      <div className="grid four" style={{ marginBottom: 24 }}>
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
        <div className="card">
          <div className="kpi">{students.length}</div>
          <div className="kpi-label">Students</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Content operations: run <code>npm run training:export</code> to export JSON and{" "}
          <code>npm run training:import -- --file=data/training-academy/content.v1.json</code> to import updates.
        </p>
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
        <button
          className={`admin-training-tab ${activeTab === "json" ? "active" : ""}`}
          onClick={() => setActiveTab("json")}
        >
          JSON Sync
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
            <label className="form-row">
              Content Key
              <input
                className="input"
                name="contentKey"
                placeholder="academy_foundations_001"
                defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.contentKey ?? "" : ""}
              />
            </label>
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
                Video Thumbnail URL (optional)
                <input
                  className="input"
                  name="videoThumbnail"
                  type="url"
                  placeholder="https://..."
                  defaultValue={editingModule ? modules.find((m) => m.id === editingModule)?.videoThumbnail ?? "" : ""}
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
            </div>
            <div className="grid three">
              <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 24 }}>
                <input
                  type="checkbox"
                  name="required"
                  defaultChecked={editingModule ? modules.find((m) => m.id === editingModule)?.required : true}
                />
                Required module
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

      {activeTab === "json" && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Training Content JSON Sync</h3>
          <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13 }}>
            Load content from database, validate draft JSON, and import updates.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              className="button small outline"
              onClick={loadJsonFromDb}
              disabled={isJsonPending}
            >
              {isJsonPending ? "Working..." : "Load from DB"}
            </button>
            <button
              type="button"
              className="button small outline"
              onClick={validateJsonDraft}
              disabled={isJsonPending}
            >
              {isJsonPending ? "Working..." : "Validate"}
            </button>
            <button
              type="button"
              className="button small"
              onClick={importJsonDraft}
              disabled={isJsonPending}
            >
              {isJsonPending ? "Importing..." : "Import"}
            </button>
            <button
              type="button"
              className="button small outline"
              onClick={exportJsonDraft}
              disabled={isJsonPending}
            >
              {isJsonPending ? "Working..." : "Export"}
            </button>
            <label
              className="form-row"
              style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}
            >
              <input
                type="checkbox"
                checked={jsonPrune}
                onChange={(event) => setJsonPrune(event.target.checked)}
              />
              Prune stale keyed rows
            </label>
          </div>

          <label className="form-row">
            JSON Draft
            <textarea
              className="input"
              rows={24}
              value={jsonDraft}
              onChange={(event) => setJsonDraft(event.target.value)}
              placeholder='{"version":"1.0.0","updatedAt":"...","modules":[...]}'
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
          </label>

          {jsonResult ? (
            <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {jsonResult.ok ? "Result: Success" : "Result: Failed"}
              </p>
              {jsonResult.message ? (
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>{jsonResult.message}</p>
              ) : null}

              {jsonResult.counters ? (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Modules: +{jsonResult.counters.modulesCreated} created /{" "}
                    {jsonResult.counters.modulesUpdated} updated /{" "}
                    {jsonResult.counters.modulesDeleted} deleted
                  </p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Checkpoints: +{jsonResult.counters.checkpointsCreated} created /{" "}
                    {jsonResult.counters.checkpointsUpdated} updated /{" "}
                    {jsonResult.counters.checkpointsDeleted} deleted
                  </p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Quiz: +{jsonResult.counters.quizCreated} created /{" "}
                    {jsonResult.counters.quizUpdated} updated /{" "}
                    {jsonResult.counters.quizDeleted} deleted
                  </p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Assignments created: {jsonResult.counters.assignmentsCreated}
                  </p>
                </div>
              ) : null}

              {jsonResult.warnings.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Warnings</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {jsonResult.warnings.map((warning) => (
                      <li key={warning} style={{ fontSize: 13 }}>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {jsonResult.errors.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>Errors</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {jsonResult.errors.map((error) => (
                      <li key={error} style={{ fontSize: 13, color: "#b91c1c" }}>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
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
              const assignedLearnerIds = new Set(mod.assignments.map((a) => a.userId));
              const unassignedInstructors = instructors.filter((i) => !assignedLearnerIds.has(i.id));
              const unassignedStudents = students.filter((student) => !assignedLearnerIds.has(student.id));
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
                      {mod.contentKey ? (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                          Key: <code>{mod.contentKey}</code>
                        </p>
                      ) : null}
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
                        <form action={bulkAssignModuleToStudents} style={{ display: "inline" }}>
                          <input type="hidden" name="moduleId" value={mod.id} />
                          <button className="button small" type="submit">
                            Assign to All Students
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
                                  <div className="grid three">
                                    <label className="form-row">
                                      Content key
                                      <input
                                        className="input"
                                        name="contentKey"
                                        defaultValue={checkpoint.contentKey ?? ""}
                                        placeholder="foundations_cp_01"
                                      />
                                    </label>
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
                                  {checkpoint.contentKey ? (
                                    <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                                      Key: <code>{checkpoint.contentKey}</code>
                                    </p>
                                  ) : null}
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
                          <div className="grid three">
                            <label className="form-row">
                              Content key
                              <input
                                className="input"
                                name="contentKey"
                                placeholder="foundations_cp_06"
                              />
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
                                  <div className="grid three">
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
                                  <label className="form-row">
                                    Explanation (optional)
                                    <textarea className="input" name="explanation" rows={2} defaultValue={question.explanation ?? ""} />
                                  </label>
                                  {question.contentKey ? (
                                    <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                                      Key: <code>{question.contentKey}</code>
                                    </p>
                                  ) : null}
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
                          <div className="grid three">
                            <label className="form-row">
                              Content key
                              <input
                                className="input"
                                name="contentKey"
                                placeholder="foundations_q_07"
                              />
                            </label>
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
                          <label className="form-row">
                            Explanation (optional)
                            <textarea className="input" name="explanation" rows={2} />
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

                      {unassignedStudents.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <form action={assignTrainingToUser} className="admin-training-assign-row">
                            <input type="hidden" name="moduleId" value={mod.id} />
                            <select className="input" name="userId" style={{ marginTop: 0, maxWidth: 300 }} required>
                              <option value="">Assign to student...</option>
                              {unassignedStudents.map((student) => (
                                <option key={student.id} value={student.id}>
                                  {student.name} ({student.email})
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
