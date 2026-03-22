"use client";

import { useState } from "react";
import { createGoal, updateGoalProgress, cancelGoal } from "@/lib/chapter-goal-actions";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: Date | null;
  status: string;
};

export function ChapterGoals({ goals }: { goals: Goal[] }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await createGoal(new FormData(e.currentTarget));
      setShowForm(false);
    } catch {
      // handled by server action
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(goalId: string) {
    const value = parseInt(editValue, 10);
    if (isNaN(value)) return;
    try {
      await updateGoalProgress(goalId, value);
      setEditingId(null);
    } catch {
      // handled by server action
    }
  }

  async function handleCancel(goalId: string) {
    try {
      await cancelGoal(goalId);
    } catch {
      // handled by server action
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Chapter Goals</h2>
        <button
          className="button small"
          onClick={() => setShowForm(!showForm)}
          style={{ fontSize: 13 }}
        >
          {showForm ? "Cancel" : "+ New Goal"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 10,
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <input
            name="title"
            placeholder="Goal title (e.g., 'Reach 25 members')"
            className="input"
            required
          />
          <input
            name="description"
            placeholder="Description (optional)"
            className="input"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="targetValue"
              type="number"
              min="1"
              placeholder="Target"
              className="input"
              style={{ flex: 1 }}
              required
            />
            <select name="unit" className="input" style={{ flex: 1 }} required>
              <option value="members">Members</option>
              <option value="enrollments">Enrollments</option>
              <option value="events">Events</option>
              <option value="courses">Courses</option>
            </select>
          </div>
          <input name="deadline" type="date" className="input" />
          <button type="submit" className="button" disabled={saving}>
            {saving ? "Creating..." : "Create Goal"}
          </button>
        </form>
      )}

      {/* Goals list */}
      {goals.length === 0 && !showForm ? (
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12 }}>
          No active goals. Set a goal to track your chapter&apos;s progress.
        </p>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {goals.map((goal) => {
            const percent = Math.min(
              Math.round((goal.currentValue / goal.targetValue) * 100),
              100
            );
            const isOverdue = goal.deadline && new Date(goal.deadline) < new Date();

            return (
              <div
                key={goal.id}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{goal.title}</strong>
                    {goal.deadline && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          color: isOverdue ? "#dc2626" : "var(--muted)",
                        }}
                      >
                        {isOverdue ? "Overdue" : `Due ${new Date(goal.deadline).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancel(goal.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--muted)",
                      padding: "2px 6px",
                    }}
                    title="Cancel goal"
                  >
                    ✕
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: "var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${percent}%`,
                        borderRadius: 4,
                        background:
                          percent >= 100
                            ? "#16a34a"
                            : percent >= 50
                            ? "var(--ypp-purple)"
                            : "#ca8a04",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <span>
                      {editingId === goal.id ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            style={{ width: 60, padding: "2px 4px", fontSize: 12 }}
                            className="input"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdate(goal.id)}
                            className="button small"
                            style={{ fontSize: 11, padding: "2px 8px" }}
                          >
                            Save
                          </button>
                        </span>
                      ) : (
                        <span
                          onClick={() => {
                            setEditingId(goal.id);
                            setEditValue(String(goal.currentValue));
                          }}
                          style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                          title="Click to update progress"
                        >
                          {goal.currentValue} / {goal.targetValue} {goal.unit}
                        </span>
                      )}
                    </span>
                    <span>{percent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
