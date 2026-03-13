"use client";

import { useMemo, useState } from "react";
import { createCohort, updateCohortStatus } from "@/lib/incubator-actions";

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ["ACCEPTING_APPLICATIONS"],
  ACCEPTING_APPLICATIONS: ["IN_PROGRESS", "DRAFT"],
  IN_PROGRESS: ["SHOWCASE_PHASE"],
  SHOWCASE_PHASE: ["COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACCEPTING_APPLICATIONS: "Open Applications",
  IN_PROGRESS: "In Progress",
  SHOWCASE_PHASE: "Showcase Phase",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export function CreateCohortForm({
  passions,
}: {
  passions: Array<{ id: string; name: string; category: string }>;
}) {
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [selectedPassions, setSelectedPassions] = useState<string[]>([]);

  const selectedSummary = useMemo(() => {
    if (selectedPassions.length === 0) return "All active passions";
    return passions
      .filter((passion) => selectedPassions.includes(passion.id))
      .map((passion) => passion.name)
      .join(", ");
  }, [passions, selectedPassions]);

  async function handleSubmit(formData: FormData) {
    formData.set("passionAreaIds", selectedPassions.join(","));
    try {
      await createCohort(formData);
      setCreated(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (submissionError: any) {
      setError(submissionError?.message || "Failed to create cohort");
    }
  }

  if (created) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", color: "#16a34a", borderRadius: 8, fontSize: 13 }}>
        Cohort created with default milestone templates.
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="passionAreaIds" value={selectedPassions.join(",")} />
      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Cohort Name *</label>
          <input name="name" required placeholder="e.g., Spring 2026 Launch Cohort" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Season</label>
          <select name="season" className="input" style={{ width: "100%" }}>
            <option value="SPRING">Spring</option>
            <option value="SUMMER">Summer</option>
            <option value="FALL">Fall</option>
            <option value="WINTER">Winter</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Year</label>
          <input name="year" type="number" defaultValue={new Date().getFullYear()} className="input" style={{ width: "100%" }} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Description</label>
        <textarea name="description" rows={2} placeholder="What is the focus of this cohort?" className="input" style={{ width: "100%", resize: "vertical" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Start Date *</label>
          <input name="startDate" type="date" required className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>End Date *</label>
          <input name="endDate" type="date" required className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>App Open</label>
          <input name="applicationOpen" type="date" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>App Close</label>
          <input name="applicationClose" type="date" className="input" style={{ width: "100%" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Showcase Date</label>
          <input name="showcaseDate" type="date" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Max Projects</label>
          <input name="maxProjects" type="number" defaultValue={20} className="input" style={{ width: "100%" }} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Allowed Passions</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          Leave everything unchecked to allow all active passions. New cohorts automatically get the default milestone template set.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {passions.map((passion) => {
            const checked = selectedPassions.includes(passion.id);
            return (
              <label
                key={passion.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: 12,
                  border: checked ? "1px solid #93c5fd" : "1px solid rgba(15,23,42,0.08)",
                  background: checked ? "#eff6ff" : "#fff",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedPassions((current) =>
                      checked ? current.filter((id) => id !== passion.id) : [...current, passion.id]
                    )
                  }
                />
                <span>
                  {passion.name}
                  <span style={{ display: "block", color: "#64748b", fontSize: 11 }}>{passion.category}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>
          <strong>Selected:</strong> {selectedSummary}
        </div>
      </div>

      <button type="submit" className="button primary">Create Cohort</button>
    </form>
  );
}

export function CohortStatusButton({ cohortId, currentStatus }: { cohortId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false);
  const nextStatuses = STATUS_FLOW[currentStatus] || [];

  if (nextStatuses.length === 0) return null;

  async function handleChange(newStatus: string) {
    setLoading(true);
    try {
      await updateCohortStatus(cohortId, newStatus);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {nextStatuses.map((status) => (
        <button
          key={status}
          onClick={() => handleChange(status)}
          disabled={loading}
          className="button secondary small"
          style={{ fontSize: 11 }}
        >
          {loading ? "..." : `→ ${STATUS_LABELS[status]}`}
        </button>
      ))}
    </div>
  );
}
