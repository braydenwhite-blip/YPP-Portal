"use client";

import { useState } from "react";
import {
  generateLearningPath,
  updateLearningPathProgress,
  pauseLearningPath,
} from "@/lib/ai-personalization-actions";
import { useRouter } from "next/navigation";

interface Milestone {
  week: number;
  goal: string;
  isComplete: boolean;
  level?: string;
  tasks?: string[];
}

export function PathGeneratorClient({
  pathId,
  milestones,
  mode,
}: {
  pathId: string;
  milestones: Milestone[];
  mode: "generate" | "progress" | "pause";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (mode === "pause") {
    return (
      <button
        className="button secondary"
        style={{ fontSize: 13 }}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await pauseLearningPath(pathId);
            router.refresh();
          } catch {
            // silent
          } finally {
            setLoading(false);
          }
        }}
      >
        Resume
      </button>
    );
  }

  if (mode === "progress") {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>Milestones</strong>
          <button
            className="button secondary"
            style={{ fontSize: 11, padding: "4px 10px" }}
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await pauseLearningPath(pathId);
                router.refresh();
              } catch {
                // silent
              } finally {
                setLoading(false);
              }
            }}
          >
            Pause Path
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {milestones.map((m, idx) => (
            <button
              key={idx}
              onClick={async () => {
                setLoading(true);
                try {
                  await updateLearningPathProgress(pathId, idx);
                  router.refresh();
                } catch {
                  // silent
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-sm)",
                background: m.isComplete ? "#f0fdf4" : "white",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
              }}
            >
              <span style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                flexShrink: 0,
                ...(m.isComplete
                  ? { background: "#16a34a", color: "white" }
                  : { background: "var(--gray-200)", color: "var(--gray-500)" }),
              }}>
                {m.isComplete ? "✓" : m.week}
              </span>
              <span style={{ textDecoration: m.isComplete ? "line-through" : "none", color: m.isComplete ? "var(--text-secondary)" : "var(--text)" }}>
                {m.goal}
              </span>
              {m.level && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-secondary)" }}>
                  {m.level}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Generate mode
  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData(e.currentTarget);
      await generateLearningPath(formData);
      setSuccess("Learning path generated! Your personalized roadmap is ready.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate path");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleGenerate} className="card">
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "12px 16px", background: "#f0fdf4", color: "#16a34a", borderRadius: 8, marginBottom: 16 }}>
          {success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Passion Area */}
        <div className="form-group">
          <label className="form-label">What do you want to learn? *</label>
          <select name="passionArea" className="form-input" required>
            <option value="">Choose your passion...</option>
            <option value="Art">Art</option>
            <option value="Music">Music</option>
            <option value="Dance">Dance</option>
            <option value="Theater">Theater</option>
            <option value="Film">Film</option>
            <option value="Writing">Writing</option>
            <option value="Design">Design</option>
            <option value="Photography">Photography</option>
            <option value="Coding">Coding</option>
            <option value="Science">Science</option>
            <option value="Entrepreneurship">Entrepreneurship</option>
            <option value="Public Speaking">Public Speaking</option>
          </select>
        </div>

        {/* Target Level */}
        <div className="form-group">
          <label className="form-label">What level do you want to reach?</label>
          <select name="targetSkillLevel" className="form-input">
            <option value="beginner">Beginner (just getting started)</option>
            <option value="intermediate" selected>Intermediate (solid foundation)</option>
            <option value="advanced">Advanced (deep expertise)</option>
            <option value="expert">Expert (mastery level)</option>
          </select>
        </div>

        {/* Timeframe */}
        <div className="form-group">
          <label className="form-label">Timeframe</label>
          <select name="timeframeDays" className="form-input">
            <option value="30">30 days (sprint)</option>
            <option value="60">60 days</option>
            <option value="90" selected>90 days (recommended)</option>
            <option value="180">6 months</option>
            <option value="365">1 year</option>
          </select>
        </div>

        {/* Weekly Hours */}
        <div className="form-group">
          <label className="form-label">Hours available per week</label>
          <select name="weeklyHoursAvailable" className="form-input">
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
            <option value="5" selected>5 hours</option>
            <option value="7">7 hours (1 hr/day)</option>
            <option value="10">10 hours</option>
            <option value="15">15+ hours</option>
          </select>
        </div>
      </div>

      <button type="submit" className="button primary" disabled={loading} style={{ marginTop: 16 }}>
        {loading ? "Generating Your Path..." : "Generate My Learning Path"}
      </button>
    </form>
  );
}
