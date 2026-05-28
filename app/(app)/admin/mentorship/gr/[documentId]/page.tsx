import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getGRAssignedDocuments,
  getGRDocumentForUser,
  getGRTimelineData,
} from "@/lib/gr-actions";
import { GRAdminSubnav } from "../_components/gr-admin-subnav";

export const metadata = { title: "G&R Document — Admin Mentorship" };

interface Props {
  params: Promise<{ documentId: string }>;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminGRDocumentDetailPage({ params }: Props) {
  const { documentId } = await params;
  const session = await getSession();
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/");

  // Reuse the existing admin loader to locate the document + its owner, then
  // reuse the per-user loader for the full goal/resource detail. No forked logic.
  const documents = await getGRAssignedDocuments();
  const row = documents.find((d) => d.id === documentId);
  if (!row) notFound();

  const [doc, timeline] = await Promise.all([
    getGRDocumentForUser(row.user.id),
    getGRTimelineData(documentId),
  ]);

  const today = new Date();
  const goals = doc?.goals ?? [];
  const activeGoals = goals.filter((g) => g.lifecycleStatus === "ACTIVE");
  const overdueGoals = activeGoals.filter((g) => g.dueDate && g.dueDate < today);
  const resources = doc?.resources ?? [];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Goals & Resources</p>
          <h1 className="page-title">{row.user.name}</h1>
          <p className="page-subtitle">
            {row.template.title} · {row.template.roleType} lane · mentored by{" "}
            {row.mentorship.mentor.name}
          </p>
        </div>
        <span
          className={
            row.status === "ACTIVE"
              ? "pill pill-small pill-success"
              : "pill pill-small pill-pending"
          }
          style={{ alignSelf: "flex-start" }}
        >
          {row.status === "ACTIVE" ? "Active" : "Draft — not activated"}
        </span>
      </div>

      <GRAdminSubnav />

      {/* Quick facts that answer the admin's core questions. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="card">
          <p className="kpi">{activeGoals.length}</p>
          <p className="kpi-label">Active goals</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: overdueGoals.length > 0 ? "#dc2626" : undefined }}>
            {overdueGoals.length}
          </p>
          <p className="kpi-label">Overdue goals</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: row._count.goalChanges > 0 ? "#d97706" : undefined }}>
            {row._count.goalChanges}
          </p>
          <p className="kpi-label">Pending goal changes</p>
        </div>
        <div className="card">
          <p className="kpi">{resources.length}</p>
          <p className="kpi-label">Assigned resources</p>
        </div>
      </div>

      <div
        className="card"
        style={{ marginBottom: 20, borderLeft: "3px solid var(--color-primary)" }}
      >
        <strong style={{ fontSize: "0.9rem" }}>What the mentee can see</strong>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
          The mentee sees their active goals, recommended resources, and any
          monthly review that a chair has approved and released. Mentor drafts,
          chair notes, and pre-release feedback stay private to staff.
        </p>
      </div>

      {/* Timeline phases (reuses getGRTimelineData). */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Timeline phases</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {timeline.map((phase) => (
            <div
              key={phase.phase}
              style={{
                padding: "0.75rem 0.9rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: phase.isCurrent ? "rgba(59,130,246,0.06)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: "0.85rem" }}>{phase.label}</strong>
                <span className="pill pill-small">
                  {phase.isCurrent ? "Current" : phase.isCompleted ? "Done" : "Upcoming"}
                </span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
                {phase.goalsWithProgress}/{phase.goalCount} goals with logged progress
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Active goals. */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Active goals ({activeGoals.length})</div>
        {activeGoals.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            No active goals yet. This document may need goals assigned before the
            mentee can make progress.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {activeGoals.map((g) => {
              const overdue = g.dueDate && g.dueDate < today;
              return (
                <div
                  key={g.id}
                  style={{
                    padding: "0.6rem 0.8rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: overdue ? "3px solid #dc2626" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.88rem" }}>{g.title}</strong>
                    <span style={{ fontSize: 12, color: overdue ? "#dc2626" : "var(--muted)" }}>
                      Due {formatDate(g.dueDate)}
                    </span>
                  </div>
                  {g.description && (
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      {g.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Link href="/admin/mentorship/gr/assignments" className="button ghost small">
            Manage goal-change proposals →
          </Link>
        </div>
      </div>
    </div>
  );
}
