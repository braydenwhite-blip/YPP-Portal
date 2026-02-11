"use client";

import { useState } from "react";
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

export function CreateCohortForm() {
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    try {
      await createCohort(formData);
      setCreated(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setError(e.message || "Failed to create");
    }
  }

  if (created) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", color: "#16a34a", borderRadius: 8, fontSize: 13 }}>
        Cohort created!
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Cohort Name *</label>
          <input name="name" required placeholder="e.g., Spring 2026 Cohort" className="input" style={{ width: "100%" }} />
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
        <textarea name="description" rows={2} placeholder="What's this cohort about?" className="input" style={{ width: "100%", resize: "vertical" }} />
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Showcase Date</label>
          <input name="showcaseDate" type="date" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Max Projects</label>
          <input name="maxProjects" type="number" defaultValue={20} className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Passion Areas (comma-sep)</label>
          <input name="passionAreas" placeholder="Music, Art, Coding" className="input" style={{ width: "100%" }} />
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
    } catch {}
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
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
