"use client";

import { useState, useTransition } from "react";
import { assignInterviewer, removeInterviewer } from "@/lib/instructor-application-actions";
import ActiveLoadBadge from "./ActiveLoadBadge";
import { Button, StatusBadge } from "@/components/ui-v2";

type Candidate = {
  id: string;
  name: string | null;
  email: string;
  chapterId: string | null;
  chapterMatch: boolean;
  interviewerActiveLoad: number;
  interviewerLastAssignedAt: Date | string | null;
};

type Assignment = {
  id: string;
  role: "LEAD" | "SECOND";
  interviewer: { id: string; name: string | null };
};

interface InterviewerAssignPickerProps {
  applicationId: string;
  role: "LEAD" | "SECOND";
  candidates: Candidate[];
  currentAssignment?: Assignment | null;
  disabled?: boolean;
  onAssigned?: () => void;
}

export default function InterviewerAssignPicker({
  applicationId,
  role,
  candidates,
  currentAssignment,
  disabled = false,
  onAssigned,
}: InterviewerAssignPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = candidates.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  function handleAssign() {
    if (!selectedId) return;
    setError(null);
    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("interviewerId", selectedId);
    formData.set("role", role);
    startTransition(async () => {
      try {
        await assignInterviewer(formData);
        onAssigned?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign interviewer.");
      }
    });
  }

  function handleRemove() {
    if (!currentAssignment) return;
    setError(null);
    const formData = new FormData();
    formData.set("assignmentId", currentAssignment.id);
    startTransition(async () => {
      try {
        await removeInterviewer(formData);
        onAssigned?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove interviewer.");
      }
    });
  }

  const roleLabel = role === "LEAD" ? "Lead Interviewer" : "Second Interviewer";

  if (disabled) {
    return (
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        Assign a Lead Interviewer first before adding a Second.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
        {roleLabel}
      </div>

      {currentAssignment ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {currentAssignment.interviewer.name ?? "Unknown"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={handleRemove}
          >
            Remove
          </Button>
        </div>
      ) : (
        <>
          <input
            className="input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 0 }}
          />

          <div
            style={{
              maxHeight: 240,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: "16px 12px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                No candidates found.
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      background: isSelected ? "var(--ypp-purple-100, #f3e8ff)" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#e0e7ff",
                        color: "#4338ca",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {(c.name ?? c.email)[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                        {c.name ?? c.email}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        {c.chapterMatch && (
                          <StatusBadge tone="info">Same chapter</StatusBadge>
                        )}
                      </div>
                    </div>
                    <ActiveLoadBadge
                      activeCount={c.interviewerActiveLoad}
                      lastAssignedAt={c.interviewerLastAssignedAt}
                      label="interviews"
                    />
                  </button>
                );
              })
            )}
          </div>

          <Button
            variant="primary"
            disabled={!selectedId || isPending}
            loading={isPending}
            onClick={handleAssign}
          >
            {isPending ? "Assigning…" : `Assign ${roleLabel}`}
          </Button>
        </>
      )}

      {error && (
        <p className="m-0 text-[13px] text-danger-700">{error}</p>
      )}
    </div>
  );
}
