"use client";

import { useState } from "react";
import { joinServiceProject, logServiceHours, createServiceProject } from "@/lib/real-world-actions";

export function JoinProjectButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    try {
      await joinServiceProject(projectId);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <button className="button primary small" onClick={handleJoin} disabled={loading}>
      {loading ? "Joining..." : "Volunteer"}
    </button>
  );
}

export function LogHoursForm({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ hoursLogged: number; xpEarned: number } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      formData.set("projectId", projectId);
      const res = await logServiceHours(formData);
      setResult(res);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (result) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", borderRadius: "var(--radius-md)", textAlign: "center" }}>
        <div style={{ fontWeight: 600, color: "#16a34a" }}>Hours logged!</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Total: {result.hoursLogged} hours | +{result.xpEarned} XP
        </div>
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <h4 style={{ margin: "0 0 12px" }}>Log Service Hours</h4>
      <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
        <div className="form-group" style={{ flex: 1, margin: 0 }}>
          <label htmlFor="hours">Hours</label>
          <input type="number" id="hours" name="hours" min="1" max="24" required defaultValue="1" />
        </div>
        <div className="form-group" style={{ flex: 2, margin: 0 }}>
          <label htmlFor="reflection">What did you do?</label>
          <input type="text" id="reflection" name="reflection" placeholder="Brief description..." />
        </div>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Logging..." : "Log Hours (+5 XP/hr)"}
        </button>
      </div>
    </form>
  );
}

export function CreateProjectForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createServiceProject(formData);
      setOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="button primary" onClick={() => setOpen(true)}>
        Create Project
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form action={handleSubmit} style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius-lg)", maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ marginBottom: 16 }}>Create Service Project</h3>
        <div className="form-group">
          <label>Title *</label>
          <input type="text" name="title" required placeholder="e.g., Community Mural Project" />
        </div>
        <div className="form-group">
          <label>Description *</label>
          <textarea name="description" required rows={3} placeholder="What will volunteers do? What's the impact?" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label>Passion Area</label>
            <select name="passionArea">
              <option value="">Any</option>
              {["Art", "Music", "Writing", "Dance", "Theater", "Film", "Coding", "Science"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Partner Organization</label>
            <input type="text" name="partnerOrg" placeholder="e.g., Local Library" />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" name="location" placeholder="City, State" />
          </div>
          <div className="form-group">
            <label>Volunteers Needed</label>
            <input type="number" name="volunteersNeeded" min="1" defaultValue="5" />
          </div>
          <div className="form-group">
            <label>Start Date</label>
            <input type="date" name="startDate" />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input type="date" name="endDate" />
          </div>
          <div className="form-group">
            <label>Total Hours Goal</label>
            <input type="number" name="totalHoursGoal" min="1" placeholder="100" />
          </div>
          <div className="form-group">
            <label>XP Reward</label>
            <input type="number" name="xpReward" min="0" defaultValue="50" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="submit" className="button primary" disabled={loading}>
            {loading ? "Creating..." : "Create Project"}
          </button>
          <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
