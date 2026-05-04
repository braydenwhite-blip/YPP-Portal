"use client";

import { useEffect, useState, useTransition } from "react";
import {
  exportTrainingContentDraft,
  importTrainingContentDraft,
  loadTrainingContentFromDb,
  validateTrainingContentDraft,
} from "@/lib/training-content-actions";
import { useRouter } from "next/navigation";
import SortableModuleList from "./sortable-module-list";
import ModuleForm from "./module-form";
import LearnerProgressView, { type LearnerProgressRow } from "./learner-progress";

// ------------------------------------
// Types
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

// ------------------------------------
// Main component
// ------------------------------------

export default function TrainingManager({
  modules,
  instructors,
  students,
  learnerProgress,
  requiredModuleCount,
}: {
  modules: Module[];
  instructors: Instructor[];
  students: Instructor[];
  learnerProgress: LearnerProgressRow[];
  requiredModuleCount: number;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"modules" | "progress" | "json">("modules");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // JSON sync state
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonPrune, setJsonPrune] = useState(false);
  const [jsonResult, setJsonResult] = useState<JsonSyncResult | null>(null);
  const [isJsonPending, startJsonTransition] = useTransition();

  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  function openCreate() {
    setEditingModuleId(null);
    setDrawerOpen(true);
  }

  function openEdit(moduleId: string) {
    setEditingModuleId(moduleId);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setEditingModuleId(null), 300);
  }

  // ------------------------------------
  // JSON sync helpers
  // ------------------------------------

  function setJsonError(message: string) {
    setJsonResult({ ok: false, errors: [message], warnings: [], counters: null });
  }

  function loadJsonFromDb() {
    startJsonTransition(async () => {
      try {
        const result = await loadTrainingContentFromDb();
        if (!result.ok || !result.content) {
          setJsonResult({ ok: false, errors: result.errors, warnings: result.warnings, counters: null });
          return;
        }
        setJsonDraft(result.rawJson);
        setJsonResult({
          ok: true, errors: [], warnings: result.warnings, counters: null,
          message: `Loaded ${result.content.modules.length} module(s) from database.`,
        });
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : "Failed to load JSON draft from database.");
      }
    });
  }

  function validateJsonDraft() {
    startJsonTransition(async () => {
      try {
        const result = await validateTrainingContentDraft(jsonDraft);
        setJsonResult({
          ok: result.ok, errors: result.errors, warnings: result.warnings, counters: null,
          message: result.ok ? "Validation passed." : "Validation failed. Fix the errors and try again.",
        });
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : "Validation request failed.");
      }
    });
  }

  function importJsonDraft() {
    startJsonTransition(async () => {
      try {
        const result = await importTrainingContentDraft(jsonDraft, jsonPrune);
        setJsonResult({
          ok: result.ok, errors: result.errors, warnings: result.warnings, counters: result.counters,
          message: result.ok ? "Import complete." : "Import failed. Review errors before retrying.",
        });
        if (result.ok) router.refresh();
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : "Import request failed.");
      }
    });
  }

  function exportJsonDraft() {
    startJsonTransition(async () => {
      try {
        const result = await exportTrainingContentDraft();
        if (!result.ok || !result.content) {
          setJsonResult({ ok: false, errors: result.errors, warnings: result.warnings, counters: null });
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
        setJsonResult({ ok: true, errors: [], warnings: result.warnings, counters: null, message });
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : "Export request failed.");
      }
    });
  }

  const editingModule = editingModuleId ? (modules.find((m) => m.id === editingModuleId) ?? null) : null;

  return (
    <div>
      {/* KPI cards */}
      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{modules.length}</div>
          <div className="kpi-label">Total Modules</div>
        </div>
        <div className="card">
          <div className="kpi">{modules.filter((m) => m.required).length}</div>
          <div className="kpi-label">Required</div>
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

      {/* Tab bar + New Module button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div className="admin-training-tabs" style={{ marginBottom: 0, flex: 1 }}>
          <button
            className={`admin-training-tab ${activeTab === "modules" ? "active" : ""}`}
            onClick={() => setActiveTab("modules")}
          >
            All Modules ({modules.length})
          </button>
          <button
            className={`admin-training-tab ${activeTab === "progress" ? "active" : ""}`}
            onClick={() => setActiveTab("progress")}
          >
            Learner Progress ({learnerProgress.length})
          </button>
          <button
            className={`admin-training-tab ${activeTab === "json" ? "active" : ""}`}
            onClick={() => setActiveTab("json")}
          >
            JSON Sync
          </button>
        </div>
        {activeTab === "modules" ? (
          <button className="button small" onClick={openCreate} style={{ flexShrink: 0 }}>
            + New Module
          </button>
        ) : null}
      </div>

      {/* Modules tab */}
      {activeTab === "modules" && (
        <SortableModuleList
          modules={modules}
          instructors={instructors}
          students={students}
          onEdit={openEdit}
        />
      )}

      {/* Learner Progress tab */}
      {activeTab === "progress" && (
        <LearnerProgressView
          rows={learnerProgress}
          requiredModuleCount={requiredModuleCount}
        />
      )}

      {/* JSON tab */}
      {activeTab === "json" && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Training Content JSON Sync</h3>
          <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13 }}>
            Load content from database, validate draft JSON, and import updates.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button type="button" className="button small outline" onClick={loadJsonFromDb} disabled={isJsonPending}>
              {isJsonPending ? "Working..." : "Load from DB"}
            </button>
            <button type="button" className="button small outline" onClick={validateJsonDraft} disabled={isJsonPending}>
              {isJsonPending ? "Working..." : "Validate"}
            </button>
            <button type="button" className="button small" onClick={importJsonDraft} disabled={isJsonPending}>
              {isJsonPending ? "Importing..." : "Import"}
            </button>
            <button type="button" className="button small outline" onClick={exportJsonDraft} disabled={isJsonPending}>
              {isJsonPending ? "Working..." : "Export"}
            </button>
            <label className="form-row" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <input type="checkbox" checked={jsonPrune} onChange={(e) => setJsonPrune(e.target.checked)} />
              Prune stale keyed rows
            </label>
          </div>

          <label className="form-row">
            JSON Draft
            <textarea
              className="input"
              rows={24}
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              placeholder='{"version":"1.0.0","updatedAt":"...","modules":[...]}'
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
          </label>

          {jsonResult && (
            <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {jsonResult.ok ? "Result: Success" : "Result: Failed"}
              </p>
              {jsonResult.message && (
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>{jsonResult.message}</p>
              )}
              {jsonResult.counters && (
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
              )}
              {jsonResult.warnings.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Warnings</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {jsonResult.warnings.map((w) => (
                      <li key={w} style={{ fontSize: 13 }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {jsonResult.errors.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>Errors</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {jsonResult.errors.map((err) => (
                      <li key={err} style={{ fontSize: 13, color: "#b91c1c" }}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Drawer overlay */}
      <div
        className={`training-drawer-overlay ${drawerOpen ? "open" : ""}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={`training-drawer ${drawerOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={editingModuleId ? "Edit Module" : "Create Module"}
      >
        <div className="training-drawer-header">
          <div>
            <h2 className="training-drawer-title">
              {editingModuleId ? "Edit Module" : "New Training Module"}
            </h2>
            <p className="training-drawer-subtitle">
              {editingModuleId
                ? "Update module settings, video, and requirements"
                : "Required modules need at least one of: video, checkpoint, quiz, or evidence"}
            </p>
          </div>
          <button className="training-drawer-close" onClick={closeDrawer} aria-label="Close drawer">
            ✕
          </button>
        </div>
        <div className="training-drawer-body">
          {drawerOpen && (
            <ModuleForm
              module={editingModule}
              onClose={closeDrawer}
              nextSortOrder={modules.length + 1}
            />
          )}
        </div>
      </div>
    </div>
  );
}
