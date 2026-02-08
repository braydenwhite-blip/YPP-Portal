"use client";

import { useState } from "react";
import {
  createTrainingModuleWithVideo,
  updateTrainingModule,
  deleteTrainingModule,
  assignTrainingToUser,
  bulkAssignModuleToInstructors,
  markTrainingComplete,
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
      {/* Stats row */}
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

      {/* Tab buttons */}
      <div className="admin-training-tabs">
        <button
          className={`admin-training-tab ${activeTab === "modules" ? "active" : ""}`}
          onClick={() => setActiveTab("modules")}
        >
          All Modules ({modules.length})
        </button>
        <button
          className={`admin-training-tab ${activeTab === "create" ? "active" : ""}`}
          onClick={() => { setActiveTab("create"); setEditingModule(null); }}
        >
          + Create Module
        </button>
      </div>

      {activeTab === "create" && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{editingModule ? "Edit Module" : "Create New Training Module"}</h3>
          <form
            action={editingModule ? updateTrainingModule : createTrainingModuleWithVideo}
            className="form-grid"
            onSubmit={() => setActiveTab("modules")}
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
            <input type="hidden" name="videoThumbnail" value="" />
            <div style={{ display: "flex", gap: 12 }}>
              <button className="button small" type="submit">
                {editingModule ? "Save Changes" : "Create Module"}
              </button>
              {editingModule && (
                <button
                  className="button small outline"
                  type="button"
                  onClick={() => { setEditingModule(null); setActiveTab("modules"); }}
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
                        <span className="pill pill-small pill-info">
                          {mod.type.replace(/_/g, " ")}
                        </span>
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
                      {/* Meta row */}
                      <div className="admin-training-meta-row">
                        {mod.materialUrl && (
                          <a className="link" href={mod.materialUrl} target="_blank" rel="noreferrer">
                            Training Material
                          </a>
                        )}
                        {mod.videoUrl && (
                          <a className="link" href={mod.videoUrl} target="_blank" rel="noreferrer">
                            Watch Video
                          </a>
                        )}
                        {mod.materialNotes && (
                          <span style={{ fontSize: 13, color: "var(--muted)" }}>{mod.materialNotes}</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <button
                          className="button small outline"
                          onClick={() => { setEditingModule(mod.id); setActiveTab("create"); }}
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

                      {/* Assign to individual instructor */}
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

                      {/* Assignments table */}
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
                                    a.status === "COMPLETE" ? "pill-success" :
                                    a.status === "IN_PROGRESS" ? "" :
                                    "pill-pending"
                                  }`}>
                                    {a.status.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td>
                                  {a.completedAt
                                    ? new Date(a.completedAt).toLocaleDateString()
                                    : "\u2014"}
                                </td>
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
