"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createGRTemplate } from "@/lib/gr-actions";
import { formatEnum } from "@/lib/format-utils";

interface Template {
  id: string;
  title: string;
  roleType: string;
  officerPosition: string | null;
  status: string;
  version: number;
  publishedAt: string | null;
  goalCount: number;
  assignmentCount: number;
  commentCount: number;
  updatedAt: string;
}

type DraftGoal = { title: string; description: string; timePhase: string };

const ROLE_TYPES = [
  { value: "INSTRUCTOR", label: "Instructors" },
  { value: "CHAPTER_PRESIDENT", label: "Chapter Presidents" },
  { value: "GLOBAL_LEADERSHIP", label: "Global Leadership" },
] as const;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_TYPES.map(({ value, label }) => [value, label])
);

const TIME_PHASES = [
  { value: "FIRST_MONTH", label: "First month" },
  { value: "FIRST_QUARTER", label: "First quarter" },
  { value: "LONG_TERM", label: "Long term" },
  { value: "MONTHLY", label: "Monthly" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  GR_DRAFT: "#6b7280",
  IN_REVIEW: "#eab308",
  GR_APPROVED: "#22c55e",
  GR_ARCHIVED: "#9ca3af",
};

const STATUS_LABELS: Record<string, string> = {
  GR_DRAFT: "Draft",
  IN_REVIEW: "In Review",
  GR_APPROVED: "Approved",
  GR_ARCHIVED: "Archived",
};

function formatPosition(position: string) {
  const trimmed = position.trim();
  if (!trimmed) return "";
  if (/_/.test(trimmed) || trimmed === trimmed.toUpperCase()) {
    return formatEnum(trimmed);
  }
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

function templateMeta(t: Template) {
  const parts = [ROLE_LABELS[t.roleType] ?? formatEnum(t.roleType)];
  const position = t.officerPosition ? formatPosition(t.officerPosition) : "";
  if (position) parts.push(position);
  parts.push(`${t.goalCount} goal${t.goalCount === 1 ? "" : "s"}`);
  parts.push(`v${t.version}`);
  return parts.join(" · ");
}

export default function GRTemplateListPanel({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [goals, setGoals] = useState<DraftGoal[]>([
    { title: "", description: "", timePhase: "LONG_TERM" },
  ]);

  const filtered =
    roleFilter === "ALL" ? templates : templates.filter((t) => t.roleType === roleFilter);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const cleaned = goals
      .map((g) => ({
        title: g.title.trim(),
        description: g.description.trim(),
        timePhase: g.timePhase,
      }))
      .filter((g) => g.title.length > 0);

    if (cleaned.length === 0) {
      setError("Add at least one goal/question for this template.");
      return;
    }

    formData.set("goalsJson", JSON.stringify(cleaned));

    startTransition(async () => {
      try {
        const result = await createGRTemplate(formData);
        setShowCreate(false);
        setGoals([{ title: "", description: "", timePhase: "LONG_TERM" }]);
        form.reset();
        router.refresh();
        if (result?.id) {
          router.push(`/admin/mentorship/gr/templates/${result.id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create template");
      }
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input"
          style={{ width: "auto" }}
        >
          <option value="ALL">All Roles</option>
          {ROLE_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="button primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? "Cancel" : "+ New Template"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="card"
          style={{ padding: "1.25rem", marginBottom: "1.5rem" }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Create New G&R Template</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Title
              <input
                name="title"
                className="input"
                required
                placeholder="e.g. VP for Instruction G&R"
              />
            </label>
            <label>
              Role Type
              <select name="roleType" className="input" required>
                {ROLE_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Officer Position (optional, for Global Leadership)
              <input
                name="officerPosition"
                className="input"
                placeholder="e.g. VP for Instruction"
              />
            </label>
            <label>
              Role Mission
              <textarea
                name="roleMission"
                className="input"
                rows={3}
                required
                placeholder="Describe the mission for this role..."
              />
            </label>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <strong>Goals / questions</strong>
                <button
                  type="button"
                  className="button outline"
                  style={{ fontSize: "0.85rem" }}
                  onClick={() =>
                    setGoals((prev) => [
                      ...prev,
                      { title: "", description: "", timePhase: "LONG_TERM" },
                    ])
                  }
                >
                  + Add goal
                </button>
              </div>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                These copy onto every person this template is assigned to.
              </p>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {goals.map((goal, index) => (
                  <div
                    key={index}
                    className="card"
                    style={{ padding: "0.75rem", background: "var(--surface-soft, #f8fafc)" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        Goal {index + 1}
                      </span>
                      {goals.length > 1 ? (
                        <button
                          type="button"
                          className="button outline"
                          style={{ fontSize: "0.75rem" }}
                          onClick={() =>
                            setGoals((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <label>
                      Title
                      <input
                        className="input"
                        required={index === 0}
                        value={goal.title}
                        onChange={(e) =>
                          setGoals((prev) =>
                            prev.map((g, i) =>
                              i === index ? { ...g, title: e.target.value } : g
                            )
                          )
                        }
                        placeholder="e.g. Lead weekly team huddle"
                      />
                    </label>
                    <label style={{ marginTop: "0.5rem", display: "block" }}>
                      Description
                      <textarea
                        className="input"
                        rows={2}
                        value={goal.description}
                        onChange={(e) =>
                          setGoals((prev) =>
                            prev.map((g, i) =>
                              i === index ? { ...g, description: e.target.value } : g
                            )
                          )
                        }
                        placeholder="What success looks like…"
                      />
                    </label>
                    <label style={{ marginTop: "0.5rem", display: "block" }}>
                      Time phase
                      <select
                        className="input"
                        value={goal.timePhase}
                        onChange={(e) =>
                          setGoals((prev) =>
                            prev.map((g, i) =>
                              i === index ? { ...g, timePhase: e.target.value } : g
                            )
                          )
                        }
                      >
                        {TIME_PHASES.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          No templates found. Create one to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/admin/mentorship/gr/templates/${t.id}`}
              className="card"
              style={{
                padding: "1rem",
                display: "block",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>{t.title}</h3>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.85rem",
                      margin: "0.25rem 0 0",
                    }}
                  >
                    {templateMeta(t)}
                  </p>
                </div>
                <span
                  className="badge"
                  style={{
                    background: STATUS_COLORS[t.status] + "22",
                    color: STATUS_COLORS[t.status],
                  }}
                >
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  marginTop: "0.75rem",
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                }}
              >
                <span>
                  {t.goalCount} goal{t.goalCount === 1 ? "" : "s"}
                </span>
                <span>{t.assignmentCount} assigned</span>
                {t.commentCount > 0 && <span>{t.commentCount} comments</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
