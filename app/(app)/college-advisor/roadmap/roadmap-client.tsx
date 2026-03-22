"use client";

import { useState, useTransition } from "react";
import { toggleRoadmapTask, addRoadmapTask, advanceRoadmapStage, updateRoadmapProfile } from "@/lib/college-roadmap-actions";

interface Props {
  mode: "toggle" | "add-task-form" | "advance-stage" | "profile-form";
  taskId?: string;
  isCompleted?: boolean;
  currentStage?: string;
  availableStages?: { stage: string; label: string }[];
  graduationYear?: number;
  dreamColleges?: string[];
  intendedMajors?: string[];
}

export default function RoadmapClient({
  mode,
  taskId,
  isCompleted,
  currentStage,
  availableStages = [],
  graduationYear,
  dreamColleges = [],
  intendedMajors = [],
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Dream colleges / majors as comma-separated inputs
  const [collegesInput, setCollegesInput] = useState(dreamColleges.join(", "));
  const [majorsInput, setMajorsInput] = useState(intendedMajors.join(", "));

  if (mode === "toggle" && taskId !== undefined) {
    return (
      <button
        onClick={() => {
          startTransition(async () => {
            await toggleRoadmapTask(taskId);
          });
        }}
        disabled={isPending}
        style={{
          width: "20px",
          height: "20px",
          minWidth: "20px",
          borderRadius: "50%",
          border: isCompleted ? "2px solid #16a34a" : "2px solid var(--border)",
          background: isCompleted ? "#16a34a" : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "2px",
        }}
        aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
      >
        {isCompleted && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    );
  }

  if (mode === "advance-stage") {
    return (
      <button
        className="button primary small"
        onClick={() => {
          startTransition(async () => {
            try {
              await advanceRoadmapStage();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to advance stage");
            }
          });
        }}
        disabled={isPending}
      >
        {isPending ? "Advancing…" : "Advance to Next Stage →"}
      </button>
    );
  }

  if (mode === "add-task-form") {
    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setError(null);
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        try {
          await addRoadmapTask(fd);
          (e.target as HTMLFormElement).reset();
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to add task");
        }
      });
    }

    return (
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            name="title"
            required
            placeholder="Task title"
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <select name="stage" defaultValue={currentStage} className="input" style={{ width: "100%", fontSize: "0.82rem" }}>
            {availableStages.map((s) => (
              <option key={s.stage} value={s.stage}>{s.label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <select name="category" className="input" style={{ width: "100%", fontSize: "0.82rem" }}>
            <option value="Research">Research</option>
            <option value="Testing">Testing</option>
            <option value="Essays">Essays</option>
            <option value="Financial">Financial</option>
            <option value="Visits">Visits</option>
            <option value="Academic">Academic</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            type="date"
            name="dueDate"
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
            placeholder="Due date (optional)"
          />
        </div>
        {error && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: "0.4rem" }}>{error}</p>}
        <button type="submit" className="button secondary small" style={{ width: "100%" }} disabled={isPending}>
          {saved ? "Added!" : isPending ? "Adding…" : "Add Task"}
        </button>
      </form>
    );
  }

  if (mode === "profile-form") {
    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setError(null);
      const fd = new FormData(e.currentTarget);

      // Parse comma-separated inputs into separate form entries
      const colleges = collegesInput.split(",").map((s) => s.trim()).filter(Boolean);
      const majors = majorsInput.split(",").map((s) => s.trim()).filter(Boolean);
      colleges.forEach((c) => fd.append("dreamColleges", c));
      majors.forEach((m) => fd.append("intendedMajors", m));

      startTransition(async () => {
        try {
          await updateRoadmapProfile(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save");
        }
      });
    }

    return (
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "0.5rem" }}>
          <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Graduation Year</label>
          <input
            type="number"
            name="graduationYear"
            defaultValue={graduationYear}
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 10}
            placeholder={String(new Date().getFullYear() + 2)}
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Dream Colleges (comma-separated)</label>
          <input
            value={collegesInput}
            onChange={(e) => setCollegesInput(e.target.value)}
            placeholder="Harvard, MIT, Stanford…"
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Intended Majors (comma-separated)</label>
          <input
            value={majorsInput}
            onChange={(e) => setMajorsInput(e.target.value)}
            placeholder="Computer Science, Business…"
            className="input"
            style={{ width: "100%", fontSize: "0.82rem" }}
          />
        </div>
        {error && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: "0.4rem" }}>{error}</p>}
        <button type="submit" className="button secondary small" style={{ width: "100%" }} disabled={isPending}>
          {saved ? "Saved!" : isPending ? "Saving…" : "Save Goals"}
        </button>
      </form>
    );
  }

  return null;
}
