"use client";

import { useTransition, useState } from "react";
import { createProgramGoal, toggleProgramGoal, updateProgramGoal } from "@/lib/mentorship-program-actions";

export interface SerializedGoal {
  id: string;
  title: string;
  description: string | null;
  roleType: string;
  isActive: boolean;
  sortOrder: number;
}

interface Props {
  goals: SerializedGoal[];
}

const ROLE_TYPES = [
  { value: "INSTRUCTOR", label: "Instructors" },
  { value: "CHAPTER_PRESIDENT", label: "Chapter Presidents" },
  { value: "GLOBAL_LEADERSHIP", label: "Global Leadership" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructors",
  CHAPTER_PRESIDENT: "Chapter Presidents",
  GLOBAL_LEADERSHIP: "Global Leadership",
};

export default function GoalsPanel({ goals }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createProgramGoal(formData);
        setSuccess("Goal created.");
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create goal");
      }
    });
  }

  function handleToggle(goal: SerializedGoal) {
    const formData = new FormData();
    formData.set("goalId", goal.id);
    formData.set("isActive", String(goal.isActive));
    startTransition(async () => {
      try {
        await toggleProgramGoal(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to toggle goal");
      }
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProgramGoal(formData);
        setSuccess("Goal updated.");
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update goal");
      }
    });
  }

  const filtered =
    roleFilter === "ALL" ? goals : goals.filter((g) => g.roleType === roleFilter);

  const groupedByRole = ROLE_TYPES.map(({ value, label }) => ({
    roleType: value,
    label,
    goals: filtered.filter((g) => g.roleType === value).sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.goals.length > 0 || roleFilter === "ALL");

  return (
    <div>
      {/* Create form */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p className="section-title" style={{ marginBottom: "1rem" }}>
          Add New Goal
        </p>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="form-row">
              <label>Role Group</label>
              <select name="roleType" required>
                <option value="">— select role group —</option>
                {ROLE_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Title</label>
              <input name="title" type="text" required placeholder="e.g. Curriculum Delivery Quality" />
            </div>
            <div className="form-row">
              <label>Description (optional)</label>
              <textarea name="description" rows={2} placeholder="Brief description of this goal…" />
            </div>
            <div className="form-row">
              <label>Sort Order</label>
              <input name="sortOrder" type="number" defaultValue={0} min={0} style={{ width: "6rem" }} />
            </div>
          </div>
          {error && <p style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>{error}</p>}
          {success && <p style={{ color: "var(--color-success)", marginTop: "0.5rem" }}>{success}</p>}
          <button className="button primary" type="submit" disabled={isPending} style={{ marginTop: "1rem" }}>
            {isPending ? "Creating…" : "Create Goal"}
          </button>
        </form>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="ALL">All Role Groups</option>
          {ROLE_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Goals by role group */}
      {goals.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No goals defined yet. Create the first one above.</p>
      ) : (
        groupedByRole.map(({ roleType, label, goals: roleGoals }) => (
          <div key={roleType} style={{ marginBottom: "1.5rem" }}>
            <p className="section-title" style={{ marginBottom: "0.75rem" }}>
              {label} ({roleGoals.length})
            </p>
            {roleGoals.length === 0 ? (
              <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No goals for this role group.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {roleGoals.map((goal) =>
                  editingId === goal.id ? (
                    <div key={goal.id} className="card">
                      <form onSubmit={handleUpdate}>
                        <input type="hidden" name="goalId" value={goal.id} />
                        <div className="form-grid">
                          <div className="form-row">
                            <label>Title</label>
                            <input name="title" type="text" required defaultValue={goal.title} />
                          </div>
                          <div className="form-row">
                            <label>Description</label>
                            <textarea name="description" rows={2} defaultValue={goal.description ?? ""} />
                          </div>
                          <div className="form-row">
                            <label>Sort Order</label>
                            <input name="sortOrder" type="number" defaultValue={goal.sortOrder} min={0} style={{ width: "6rem" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                          <button className="button primary small" type="submit" disabled={isPending}>
                            {isPending ? "Saving…" : "Save"}
                          </button>
                          <button className="button ghost small" type="button" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div
                      key={goal.id}
                      className="card"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "1rem",
                        opacity: goal.isActive ? 1 : 0.55,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 600 }}>{goal.title}</span>
                          <span
                            className={`pill ${goal.isActive ? "pill-success" : "pill-declined"}`}
                            style={{ fontSize: "0.7rem" }}
                          >
                            {goal.isActive ? "Active" : "Inactive"}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>#{goal.sortOrder}</span>
                        </div>
                        {goal.description && (
                          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                        <button
                          className="button ghost small"
                          disabled={isPending}
                          onClick={() => setEditingId(goal.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="button outline small"
                          disabled={isPending}
                          onClick={() => handleToggle(goal)}
                        >
                          {goal.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
