"use client";

import { useMemo, useState, useTransition } from "react";
import type { ManualEmailKind, ManualEmailStatus } from "@prisma/client";
import { describeManualEmailKind } from "@/lib/application-source-config";
import type { ManualEmailTaskDTO } from "@/lib/manual-email-tasks";
import {
  addManualEmailTaskFromForm,
  updateManualEmailTaskStatusFromForm,
} from "@/lib/manual-email-tasks";

const ALL_KINDS: ManualEmailKind[] = [
  "APPLICATION_CONFIRMATION",
  "MISSING_INFORMATION_REQUEST",
  "REVIEW_UPDATE",
  "INTERVIEW_INVITATION",
  "INTERVIEW_CONFIRMATION",
  "INTERVIEW_REMINDER",
  "POST_INTERVIEW_FOLLOWUP",
  "ACCEPTANCE",
  "WAITLIST",
  "REJECTION",
  "WITHDRAWAL_CONFIRMATION",
  "GENERAL_FOLLOWUP",
];

const STATUS_LABEL: Record<ManualEmailStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  NOT_NEEDED: "Not needed",
  HANDLED_EXTERNALLY: "Handled externally",
};

const STATUS_PILL_CLASS: Record<ManualEmailStatus, string> = {
  PENDING: "pill pill-attention",
  SENT: "pill pill-success",
  NOT_NEEDED: "pill",
  HANDLED_EXTERNALLY: "pill pill-info",
};

interface ManualEmailGuidancePanelProps {
  applicationId: string;
  tasks: ManualEmailTaskDTO[];
  suggestedKinds: ManualEmailKind[];
  /** True if the cockpit viewer can mutate tasks. */
  canEdit: boolean;
}

async function copy(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ManualEmailGuidancePanel({
  applicationId,
  tasks,
  suggestedKinds,
  canEdit,
}: ManualEmailGuidancePanelProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);
  const [addingKind, setAddingKind] = useState<ManualEmailKind | "">("");

  const existingKinds = useMemo(() => new Set(tasks.map((t) => t.kind)), [tasks]);
  const addableKinds = ALL_KINDS;
  const pendingSuggestions = suggestedKinds.filter((k) => !existingKinds.has(k));

  const setRowFeedback = (id: string, text: string) => {
    setFeedback({ id, text });
    if (typeof window !== "undefined") {
      window.setTimeout(() => setFeedback((current) => (current?.id === id ? null : current)), 2500);
    }
  };

  const handleCopySubject = (task: ManualEmailTaskDTO) => {
    if (!task.suggestedSubject) return;
    void copy(task.suggestedSubject).then((ok) =>
      setRowFeedback(task.id, ok ? "Subject copied" : "Copy failed"),
    );
  };

  const handleCopyBody = (task: ManualEmailTaskDTO) => {
    if (!task.suggestedBody) return;
    void copy(task.suggestedBody).then((ok) =>
      setRowFeedback(task.id, ok ? "Body copied" : "Copy failed"),
    );
  };

  const handleStatus = (taskId: string, status: ManualEmailStatus) => {
    if (!canEdit) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("taskId", taskId);
      fd.set("status", status);
      const result = await updateManualEmailTaskStatusFromForm(fd);
      if (!result.ok) setRowFeedback(taskId, `Error: ${result.error}`);
    });
  };

  const handleAdd = () => {
    if (!canEdit || !addingKind) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("applicationId", applicationId);
      fd.set("kind", addingKind);
      const result = await addManualEmailTaskFromForm(fd);
      if (result.ok) {
        setAddingKind("");
      } else {
        setRowFeedback("add", `Error: ${result.error}`);
      }
    });
  };

  return (
    <section
      id="section-manual-email"
      className="rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card"
      aria-label="Manual email tracking"
    >
      <div className="mb-4 grid gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">Manual email tracking</span>
        <h2>Emails to send</h2>
      </div>

      <p
        className="m-0 text-[13px] text-ink-muted"
        style={{ marginTop: 0, fontSize: 13, lineHeight: 1.55 }}
      >
        Manual email tracking only. This does not send an email. Copy the
        suggested subject/body into your email client, send it, then mark the
        task as sent so the team knows it&apos;s handled.
      </p>

      {pendingSuggestions.length > 0 && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            fontSize: 13,
            color: "#78350f",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ fontWeight: 600 }}>Recommended at this stage:</strong>{" "}
          {pendingSuggestions
            .map((kind) => describeManualEmailKind(kind).label)
            .join(", ")}
          .
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted" style={{ marginTop: 16, fontSize: 13 }}>
          No manual email tasks have been added yet. Use the picker below to
          queue an email when one is needed.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "16px 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {tasks.map((task) => {
            const descriptor = describeManualEmailKind(task.kind);
            const isPending = task.status === "PENDING";
            return (
              <li
                key={task.id}
                style={{
                  border: "1px solid var(--border-muted, #e5e7eb)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: isPending ? "#fff" : "var(--surface-1, #fafafa)",
                }}
              >
                <header
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{descriptor.label}</strong>
                    <span
                      className={STATUS_PILL_CLASS[task.status]}
                      title={`Status: ${STATUS_LABEL[task.status]}`}
                    >
                      {STATUS_LABEL[task.status]}
                    </span>
                  </div>
                  {task.markedSentAt && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Marked sent{" "}
                      {new Date(task.markedSentAt).toLocaleString()}
                      {task.markedSentBy?.name ? ` by ${task.markedSentBy.name}` : ""}
                    </span>
                  )}
                </header>

                <p
                  style={{
                    margin: "6px 0 10px",
                    fontSize: 13,
                    color: "var(--muted)",
                    lineHeight: 1.55,
                  }}
                >
                  {descriptor.purpose}
                </p>

                {task.suggestedSubject && (
                  <p style={{ margin: "0 0 6px", fontSize: 13 }}>
                    <strong>Subject:</strong> {task.suggestedSubject}
                  </p>
                )}
                {task.suggestedBody && (
                  <details
                    style={{
                      background: "var(--surface-1, #fafafa)",
                      border: "1px solid var(--border-muted, #e5e7eb)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      marginBottom: 10,
                    }}
                  >
                    <summary
                      style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Suggested body
                    </summary>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: 13,
                        lineHeight: 1.55,
                        margin: "8px 0 0",
                      }}
                    >
                      {task.suggestedBody}
                    </pre>
                  </details>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    className="button small outline"
                    onClick={() => handleCopySubject(task)}
                    disabled={!task.suggestedSubject}
                  >
                    Copy subject
                  </button>
                  <button
                    type="button"
                    className="button small outline"
                    onClick={() => handleCopyBody(task)}
                    disabled={!task.suggestedBody}
                  >
                    Copy body
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="button small"
                        onClick={() => handleStatus(task.id, "SENT")}
                        disabled={pending || task.status === "SENT"}
                        aria-label="Mark sent"
                      >
                        Mark sent
                      </button>
                      <button
                        type="button"
                        className="button small ghost"
                        onClick={() => handleStatus(task.id, "NOT_NEEDED")}
                        disabled={pending || task.status === "NOT_NEEDED"}
                      >
                        Not needed
                      </button>
                      <button
                        type="button"
                        className="button small ghost"
                        onClick={() => handleStatus(task.id, "HANDLED_EXTERNALLY")}
                        disabled={pending || task.status === "HANDLED_EXTERNALLY"}
                      >
                        Handled externally
                      </button>
                      {task.status !== "PENDING" && (
                        <button
                          type="button"
                          className="button small ghost"
                          onClick={() => handleStatus(task.id, "PENDING")}
                          disabled={pending}
                          title="Move back to pending"
                        >
                          Reopen
                        </button>
                      )}
                    </>
                  )}
                  {feedback?.id === task.id && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {feedback.text}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            border: "1px dashed var(--border-muted, #e5e7eb)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <label htmlFor="manual-email-add" style={{ fontSize: 13, fontWeight: 600 }}>
            Add an email task:
          </label>
          <select
            id="manual-email-add"
            className="input"
            value={addingKind}
            onChange={(e) => setAddingKind(e.target.value as ManualEmailKind | "")}
            style={{ minWidth: 240 }}
          >
            <option value="">Pick an email kind…</option>
            {addableKinds.map((kind) => (
              <option key={kind} value={kind}>
                {describeManualEmailKind(kind).label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button small"
            onClick={handleAdd}
            disabled={!addingKind || pending}
          >
            Add task
          </button>
          {feedback?.id === "add" && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{feedback.text}</span>
          )}
        </div>
      )}
    </section>
  );
}
