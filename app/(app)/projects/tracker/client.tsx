"use client";

import { useState } from "react";

export function CreateProjectForm() {
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          passionId: formData.get("passionId"),
          description: formData.get("description"),
          targetEndDate: formData.get("targetEndDate") || null,
          visibility: formData.get("visibility") || "PRIVATE",
          tags: (formData.get("tags") as string || "").split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setCreated(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setError(e.message || "Failed to create project");
    }
  }

  if (created) {
    return <div style={{ padding: 12, background: "#dcfce7", color: "#16a34a", borderRadius: 8, fontSize: 13 }}>Project created!</div>;
  }

  return (
    <form action={handleSubmit}>
      {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Title *</label>
          <input name="title" required placeholder="Project name" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Passion Area *</label>
          <input name="passionId" required placeholder="e.g., Music" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Visibility</label>
          <select name="visibility" className="input" style={{ width: "100%" }}>
            <option value="PRIVATE">Private</option>
            <option value="MENTORS_ONLY">Mentors Only</option>
            <option value="PUBLIC">Public</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Description</label>
          <input name="description" placeholder="What will you create?" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Target End Date</label>
          <input name="targetEndDate" type="date" className="input" style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Tags (comma-sep)</label>
          <input name="tags" placeholder="art, music" className="input" style={{ width: "100%" }} />
        </div>
      </div>
      <button type="submit" className="button primary small">Create Project</button>
    </form>
  );
}
