"use client";

import { useTransition, useState } from "react";
import {
  updateGRTemplate,
  addGRTemplateGoal,
  updateGRTemplateGoal,
  removeGRTemplateGoal,
  setGRTemplateSuccessCriteria,
  submitGRTemplateForReview,
  approveGRTemplate,
  addGRTemplateComment,
  resolveGRTemplateComment,
  addGRKPIDefinition,
} from "@/lib/gr-actions";

interface Goal {
  id: string;
  title: string;
  description: string;
  timePhase: string;
  sortOrder: number;
  kpiDefinitions: { id: string; label: string; sourceType: string; targetValue: string | null; unit: string | null }[];
}

interface SuccessCriteria {
  id: string;
  timePhase: string;
  criteria: string;
}

interface Comment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

interface TemplateData {
  id: string;
  title: string;
  roleType: string;
  officerPosition: string | null;
  roleMission: string;
  status: string;
  version: number;
  publishedAt: string | null;
  isActive: boolean;
  createdBy: string;
  lastEditedBy: string | null;
  assignmentCount: number;
  goals: Goal[];
  successCriteria: SuccessCriteria[];
  resources: { id: string; resourceId: string; title: string; url: string; sortOrder: number }[];
  comments: Comment[];
  versions: { version: number; changeNote: string | null; createdAt: string }[];
}

const TIME_PHASES = [
  { value: "FIRST_MONTH", label: "First Month" },
  { value: "FIRST_QUARTER", label: "First Quarter" },
  { value: "FULL_YEAR", label: "Full Year" },
] as const;

type Tab = "details" | "goals" | "criteria" | "resources" | "comments" | "history";

export default function GRTemplateEditor({ template }: { template: TemplateData }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("goals");

  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "goals", label: `Goals (${template.goals.length})` },
    { id: "criteria", label: "Success Criteria" },
    { id: "resources", label: `Resources (${template.resources.length})` },
    { id: "comments", label: `Comments (${template.comments.length})` },
    { id: "history", label: `History (v${template.version})` },
  ];

  function handleAction(action: (fd: FormData) => Promise<void>, fd: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await action(fd);
        setSuccess("Saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div>
      {/* Status bar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="badge">{template.status}</span>
        <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Created by {template.createdBy}
          {template.lastEditedBy && ` · Last edited by ${template.lastEditedBy}`}
          {template.assignmentCount > 0 && ` · ${template.assignmentCount} assignments`}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          {template.status === "GR_DRAFT" && (
            <button
              className="button"
              disabled={isPending}
              onClick={() => {
                const fd = new FormData();
                fd.set("templateId", template.id);
                handleAction(submitGRTemplateForReview, fd);
              }}
            >
              Submit for Review
            </button>
          )}
          {template.status === "IN_REVIEW" && (
            <button
              className="button primary"
              disabled={isPending}
              onClick={() => {
                const fd = new FormData();
                fd.set("templateId", template.id);
                handleAction(approveGRTemplate, fd);
              }}
            >
              Approve & Publish
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: "0.75rem" }}>{error}</p>}
      {success && <p style={{ color: "var(--success)", marginBottom: "0.75rem" }}>{success}</p>}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "2px solid var(--border)", marginBottom: "1.5rem" }}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="button ghost"
            style={{
              borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              borderBottom: tab === id ? "2px solid var(--ypp-purple-500)" : "2px solid transparent",
              marginBottom: "-2px",
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? "var(--ypp-purple-600)" : "var(--muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === "details" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAction(updateGRTemplate, new FormData(e.currentTarget));
          }}
          className="card"
          style={{ padding: "1.25rem" }}
        >
          <input type="hidden" name="templateId" value={template.id} />
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Title
              <input name="title" className="input" defaultValue={template.title} required />
            </label>
            <label>
              Officer Position
              <input name="officerPosition" className="input" defaultValue={template.officerPosition ?? ""} />
            </label>
            <label>
              Role Mission
              <textarea name="roleMission" className="input" rows={5} defaultValue={template.roleMission} required />
            </label>
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* Goals tab */}
      {tab === "goals" && (
        <div>
          {TIME_PHASES.map(({ value: phase, label: phaseLabel }) => {
            const phaseGoals = template.goals.filter((g) => g.timePhase === phase);
            return (
              <div key={phase} style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ marginBottom: "0.75rem" }}>{phaseLabel}</h3>
                {phaseGoals.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No goals for this phase yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {phaseGoals.map((goal) => (
                      <div key={goal.id} className="card" style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <strong>{goal.title}</strong>
                            <p style={{ fontSize: "0.85rem", color: "var(--muted)", whiteSpace: "pre-wrap", margin: "0.25rem 0 0" }}>
                              {goal.description}
                            </p>
                            {goal.kpiDefinitions.length > 0 && (
                              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                {goal.kpiDefinitions.map((kpi) => (
                                  <span key={kpi.id} className="badge" style={{ fontSize: "0.75rem" }}>
                                    {kpi.label}{kpi.targetValue ? ` (${kpi.targetValue}${kpi.unit ?? ""})` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            className="button ghost"
                            style={{ color: "var(--danger)", fontSize: "0.8rem" }}
                            disabled={isPending}
                            onClick={() => {
                              const fd = new FormData();
                              fd.set("goalId", goal.id);
                              handleAction(removeGRTemplateGoal, fd);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add goal form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("templateId", template.id);
                    fd.set("timePhase", phase);
                    handleAction(addGRTemplateGoal, fd);
                    (e.target as HTMLFormElement).reset();
                  }}
                  style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}
                >
                  <input name="title" className="input" placeholder="Goal title" required style={{ flex: "1", minWidth: "200px" }} />
                  <input name="description" className="input" placeholder="Description (Markdown)" required style={{ flex: "2", minWidth: "300px" }} />
                  <input type="hidden" name="sortOrder" value={phaseGoals.length} />
                  <button type="submit" className="button" disabled={isPending}>
                    + Add
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      {/* Success Criteria tab */}
      {tab === "criteria" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {TIME_PHASES.map(({ value: phase, label: phaseLabel }) => {
            const existing = template.successCriteria.find((sc) => sc.timePhase === phase);
            return (
              <form
                key={phase}
                className="card"
                style={{ padding: "1rem" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  fd.set("templateId", template.id);
                  fd.set("timePhase", phase);
                  handleAction(setGRTemplateSuccessCriteria, fd);
                }}
              >
                <h3 style={{ marginBottom: "0.5rem" }}>{phaseLabel}</h3>
                <textarea
                  name="criteria"
                  className="input"
                  rows={4}
                  defaultValue={existing?.criteria ?? ""}
                  placeholder="Enter success criteria using Markdown bullet points..."
                />
                <button type="submit" className="button" style={{ marginTop: "0.5rem" }} disabled={isPending}>
                  Save Criteria
                </button>
              </form>
            );
          })}
        </div>
      )}

      {/* Resources tab */}
      {tab === "resources" && (
        <div>
          {template.resources.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No resources linked. Add resources from the Resource Library.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {template.resources.map((r) => (
                <div key={r.id} className="card" style={{ padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{r.title}</strong>
                    <br />
                    <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.85rem", color: "var(--link)" }}>
                      {r.url}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comments tab */}
      {tab === "comments" && (
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("templateId", template.id);
              handleAction(addGRTemplateComment, fd);
              (e.target as HTMLFormElement).reset();
            }}
            style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
          >
            <input name="body" className="input" placeholder="Add a comment..." required style={{ flex: 1 }} />
            <button type="submit" className="button" disabled={isPending}>Comment</button>
          </form>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {template.comments.map((c) => (
              <div key={c.id} className="card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong>{c.authorName}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: "0.5rem" }}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <p style={{ margin: "0.25rem 0 0" }}>{c.body}</p>
                  </div>
                  <button
                    className="button ghost"
                    style={{ fontSize: "0.8rem" }}
                    disabled={isPending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("commentId", c.id);
                      handleAction(resolveGRTemplateComment, fd);
                    }}
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {template.versions.map((v) => (
            <div key={v.version} className="card" style={{ padding: "0.75rem" }}>
              <strong>v{v.version}</strong>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem", marginLeft: "0.75rem" }}>
                {new Date(v.createdAt).toLocaleDateString()}
              </span>
              {v.changeNote && <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>{v.changeNote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
