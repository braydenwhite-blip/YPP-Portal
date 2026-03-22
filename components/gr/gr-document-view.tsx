"use client";

import { useTransition, useState } from "react";
import { saveGRPlanOfAction } from "@/lib/gr-actions";

interface KPIValue {
  value: string;
  measuredAt: string;
  notes: string | null;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  timePhase: string;
  isCustom: boolean;
  kpiValues: KPIValue[];
}

interface SuccessCriteria {
  timePhase: string;
  criteria: string;
}

interface Resource {
  title: string;
  url: string;
  description: string | null;
}

interface PlanOfAction {
  cycleNumber: number;
  content: string;
  updatedAt: string;
}

interface DocumentData {
  id: string;
  templateTitle: string;
  roleType: string;
  roleMission: string;
  status: string;
  roleStartDate: string;
  mentorName: string;
  mentorEmail: string;
  mentorInfo: Record<string, string> | null;
  officerInfo: Record<string, string> | null;
  goals: Goal[];
  successCriteria: SuccessCriteria[];
  resources: Resource[];
  plansOfAction: PlanOfAction[];
}

const PHASE_LABELS: Record<string, string> = {
  FIRST_MONTH: "First Month",
  FIRST_QUARTER: "First Quarter",
  FULL_YEAR: "Full Year",
};

const PHASE_ORDER = ["FIRST_MONTH", "FIRST_QUARTER", "FULL_YEAR"];

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  GLOBAL_LEADERSHIP: "Global Leadership",
};

function computePhaseStatus(roleStartDate: string, phase: string) {
  const start = new Date(roleStartDate);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const phaseEndDays: Record<string, number> = {
    FIRST_MONTH: 30,
    FIRST_QUARTER: 90,
    FULL_YEAR: 365,
  };

  const endDate = new Date(start.getTime() + (phaseEndDays[phase] ?? 365) * dayMs);
  const isCurrent = now >= start && now <= endDate;
  const isCompleted = now > endDate;

  return { isCurrent, isCompleted, endDate };
}

export default function GRDocumentView({ document: doc, isOwner }: { document: DocumentData; isOwner: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);

  const latestPlan = doc.plansOfAction[0] ?? null;
  const nextCycle = latestPlan ? latestPlan.cycleNumber + 1 : 1;

  function handleSavePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    formData.set("documentId", doc.id);
    startTransition(async () => {
      try {
        await saveGRPlanOfAction(formData);
        setSuccess("Plan of action saved.");
        setShowPlanForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Timeline visualization */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Timeline</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
          {PHASE_ORDER.map((phase) => {
            const { isCurrent, isCompleted } = computePhaseStatus(doc.roleStartDate, phase);
            const phaseGoals = doc.goals.filter((g) => g.timePhase === phase);
            return (
              <div
                key={phase}
                style={{
                  flex: 1,
                  padding: "1rem",
                  borderRadius: "var(--radius-sm)",
                  border: isCurrent ? "2px solid var(--ypp-purple-500)" : "1px solid var(--border)",
                  background: isCompleted ? "var(--success-bg, #f0fdf4)" : isCurrent ? "var(--ypp-purple-50, #faf5ff)" : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{PHASE_LABELS[phase]}</strong>
                  {isCurrent && <span className="badge" style={{ background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)", fontSize: "0.7rem" }}>Current</span>}
                  {isCompleted && <span className="badge" style={{ background: "#dcfce7", color: "#166534", fontSize: "0.7rem" }}>Done</span>}
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {phaseGoals.length} goal{phaseGoals.length !== 1 ? "s" : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info section */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.25rem" }}>Role</h3>
            <p>{ROLE_LABELS[doc.roleType] ?? doc.roleType}</p>
          </div>
          <div>
            <h3 style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.25rem" }}>Mentor</h3>
            <p>{doc.mentorName}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{doc.mentorEmail}</p>
          </div>
          {doc.officerInfo && (
            <div>
              <h3 style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.25rem" }}>Officer</h3>
              <p>{doc.officerInfo.name ?? "—"}</p>
            </div>
          )}
          <div>
            <h3 style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.25rem" }}>Start Date</h3>
            <p>{new Date(doc.roleStartDate).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Role Mission */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Role Mission</h2>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{doc.roleMission}</p>
      </div>

      {/* Goals by phase */}
      {PHASE_ORDER.map((phase) => {
        const phaseGoals = doc.goals.filter((g) => g.timePhase === phase);
        const phaseCriteria = doc.successCriteria.find((sc) => sc.timePhase === phase);
        const { isCurrent } = computePhaseStatus(doc.roleStartDate, phase);

        if (phaseGoals.length === 0 && !phaseCriteria) return null;

        return (
          <div key={phase}>
            <h2 style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {PHASE_LABELS[phase]}
              {isCurrent && <span className="badge" style={{ background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>Current Phase</span>}
            </h2>

            {/* Goals */}
            <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
              {phaseGoals.map((goal) => (
                <div key={goal.id} className="card" style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <strong>{goal.title}</strong>
                      {goal.isCustom && <span className="badge" style={{ marginLeft: "0.5rem", fontSize: "0.7rem" }}>Custom</span>}
                      <p style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.5 }}>
                        {goal.description}
                      </p>
                    </div>
                  </div>
                  {goal.kpiValues.length > 0 && (
                    <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                      <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>Recent KPI Values</p>
                      {goal.kpiValues.map((kpi, i) => (
                        <div key={i} style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          {kpi.value} — {new Date(kpi.measuredAt).toLocaleDateString()}
                          {kpi.notes && <span> ({kpi.notes})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Success Criteria */}
            {phaseCriteria && (
              <div className="card" style={{ padding: "1rem", background: "var(--surface-alt, #f9fafb)", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Success Criteria</h3>
                <p style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: 1.6 }}>{phaseCriteria.criteria}</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Resources */}
      {doc.resources.length > 0 && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Resources</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {doc.resources.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>{r.title}</strong>
                  {r.description && <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0.1rem 0 0" }}>{r.description}</p>}
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="button ghost" style={{ fontSize: "0.8rem" }}>
                  Open
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan of Action */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Plan of Action</h2>
          {isOwner && (
            <button className="button" onClick={() => setShowPlanForm(!showPlanForm)}>
              {showPlanForm ? "Cancel" : latestPlan ? "Update Plan" : "Write Plan"}
            </button>
          )}
        </div>

        {error && <p style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>{error}</p>}
        {success && <p style={{ color: "var(--success)", marginBottom: "0.5rem" }}>{success}</p>}

        {showPlanForm && (
          <form onSubmit={handleSavePlan} style={{ marginBottom: "1rem" }}>
            <input type="hidden" name="cycleNumber" value={nextCycle} />
            <textarea
              name="content"
              className="input"
              rows={5}
              required
              placeholder="Write your plan of action for this cycle. Use Markdown for formatting..."
              style={{ marginBottom: "0.5rem" }}
            />
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Saving..." : "Save Plan"}
            </button>
          </form>
        )}

        {doc.plansOfAction.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No plan of action written yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {doc.plansOfAction.map((p) => (
              <div key={p.cycleNumber} style={{ borderLeft: "3px solid var(--ypp-purple-300)", paddingLeft: "0.75rem" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)" }}>
                  Cycle {p.cycleNumber} — {new Date(p.updatedAt).toLocaleDateString()}
                </p>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "0.9rem" }}>{p.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
