"use client";

import { useTransition, useState } from "react";
import { createGRTemplate } from "@/lib/gr-actions";
import Link from "next/link";

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

const ROLE_TYPES = [
  { value: "INSTRUCTOR", label: "Instructors" },
  { value: "CHAPTER_PRESIDENT", label: "Chapter Presidents" },
  { value: "GLOBAL_LEADERSHIP", label: "Global Leadership" },
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

export default function GRTemplateListPanel({ templates }: { templates: Template[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const filtered = roleFilter === "ALL" ? templates : templates.filter((t) => t.roleType === roleFilter);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createGRTemplate(formData);
        setShowCreate(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create template");
      }
    });
  }

  return (
    <div>
      {/* Actions bar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input"
          style={{ width: "auto" }}
        >
          <option value="ALL">All Roles</option>
          {ROLE_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button className="button primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Template"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Create New G&R Template</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Title
              <input name="title" className="input" required placeholder="e.g. VP for Instruction G&R" />
            </label>
            <label>
              Role Type
              <select name="roleType" className="input" required>
                {ROLE_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Officer Position (optional, for Global Leadership)
              <input name="officerPosition" className="input" placeholder="e.g. VP for Instruction" />
            </label>
            <label>
              Role Mission
              <textarea name="roleMission" className="input" rows={3} required placeholder="Describe the mission for this role..." />
            </label>
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      )}

      {/* Template list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          No templates found. Create one to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/admin/mentorship-program/gr-templates/${t.id}`}
              className="card"
              style={{ padding: "1rem", display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h3 style={{ margin: 0 }}>{t.title}</h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
                    {t.roleType}{t.officerPosition ? ` — ${t.officerPosition}` : ""} · v{t.version}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span
                    className="badge"
                    style={{ background: STATUS_COLORS[t.status] + "22", color: STATUS_COLORS[t.status] }}
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                <span>{t.goalCount} goals</span>
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
