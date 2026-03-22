"use client";

import { useTransition, useState } from "react";
import { activateGRDocument, reviewGRGoalChange, assignGRDocument } from "@/lib/gr-actions";

interface Document {
  id: string;
  userName: string;
  userEmail: string;
  templateTitle: string;
  roleType: string;
  mentorName: string;
  status: string;
  goalCount: number;
  pendingChanges: number;
  createdAt: string;
}

interface GoalChange {
  id: string;
  documentId: string;
  userName: string;
  templateTitle: string;
  proposedByName: string;
  changeType: string;
  proposedData: Record<string, string>;
  reason: string | null;
  createdAt: string;
}

interface TemplateOption {
  id: string;
  title: string;
  roleType: string;
  status: string;
}

type Tab = "documents" | "changes" | "assign";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  ACTIVE: "#22c55e",
  PENDING_APPROVAL: "#eab308",
  ARCHIVED: "#9ca3af",
};

export default function GRAssignmentsPanel({
  documents,
  goalChanges,
  templates,
}: {
  documents: Document[];
  goalChanges: GoalChange[];
  templates: TemplateOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("documents");

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "documents", label: "Assigned Documents", count: documents.length },
    { id: "changes", label: "Goal Change Queue", count: goalChanges.length },
    { id: "assign", label: "New Assignment" },
  ];

  function handleAction(action: (fd: FormData) => Promise<void>, fd: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await action(fd);
        setSuccess("Done.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "2px solid var(--border)", marginBottom: "1.5rem" }}>
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="button ghost"
            style={{
              borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              borderBottom: tab === id ? "2px solid var(--ypp-purple-500)" : "2px solid transparent",
              marginBottom: "-2px",
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? "var(--ypp-purple-600)" : "var(--muted)",
            }}
          >
            {label}
            {count != null && count > 0 && (
              <span className="badge" style={{ marginLeft: "0.4rem" }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: "0.75rem" }}>{error}</p>}
      {success && <p style={{ color: "var(--success)", marginBottom: "0.75rem" }}>{success}</p>}

      {/* Documents tab */}
      {tab === "documents" && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {documents.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              No G&R documents assigned yet.
            </div>
          ) : (
            documents.map((d) => (
              <div key={d.id} className="card" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <strong>{d.userName}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                      {d.userEmail}
                    </span>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                      {d.templateTitle} · Mentor: {d.mentorName} · {d.goalCount} goals
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {d.pendingChanges > 0 && (
                      <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                        {d.pendingChanges} pending
                      </span>
                    )}
                    <span
                      className="badge"
                      style={{ background: (STATUS_COLORS[d.status] ?? "#6b7280") + "22", color: STATUS_COLORS[d.status] }}
                    >
                      {d.status}
                    </span>
                    {d.status === "DRAFT" && (
                      <button
                        className="button"
                        style={{ fontSize: "0.8rem" }}
                        disabled={isPending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("documentId", d.id);
                          handleAction(activateGRDocument, fd);
                        }}
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Goal Change Queue tab */}
      {tab === "changes" && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {goalChanges.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              No pending goal change proposals.
            </div>
          ) : (
            goalChanges.map((gc) => (
              <div key={gc.id} className="card" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <strong>{gc.changeType}</strong> for {gc.userName}
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                      ({gc.templateTitle})
                    </span>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                      Proposed by {gc.proposedByName} on {new Date(gc.createdAt).toLocaleDateString()}
                    </p>
                    {gc.proposedData.title && <p style={{ margin: "0.25rem 0 0" }}>Title: {gc.proposedData.title}</p>}
                    {gc.reason && <p style={{ fontSize: "0.85rem", fontStyle: "italic", margin: "0.25rem 0 0" }}>Reason: {gc.reason}</p>}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="button primary"
                      style={{ fontSize: "0.8rem" }}
                      disabled={isPending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("changeId", gc.id);
                        fd.set("status", "APPROVED");
                        handleAction(reviewGRGoalChange, fd);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="button"
                      style={{ fontSize: "0.8rem", color: "var(--danger)" }}
                      disabled={isPending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("changeId", gc.id);
                        fd.set("status", "REJECTED");
                        handleAction(reviewGRGoalChange, fd);
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Assign tab */}
      {tab === "assign" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAction(assignGRDocument, new FormData(e.currentTarget));
            (e.target as HTMLFormElement).reset();
          }}
          className="card"
          style={{ padding: "1.25rem" }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Assign G&R Document</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Template
              <select name="templateId" className="input" required>
                <option value="">Select a template...</option>
                {templates
                  .filter((t) => t.status === "GR_APPROVED")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.roleType})
                    </option>
                  ))}
              </select>
            </label>
            <label>
              User ID
              <input name="userId" className="input" required placeholder="User CUID" />
            </label>
            <label>
              Mentorship ID
              <input name="mentorshipId" className="input" required placeholder="Mentorship CUID" />
            </label>
            <label>
              Role Start Date
              <input name="roleStartDate" type="date" className="input" required />
            </label>
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Assigning..." : "Assign G&R"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
