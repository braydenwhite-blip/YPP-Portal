"use client";

import { useState, useTransition } from "react";
import { assignReviewer, reassignReviewer } from "@/lib/instructor-application-actions";
import ActiveLoadBadge from "./ActiveLoadBadge";

type Candidate = {
  id: string;
  name: string | null;
  email: string;
  chapterId: string | null;
  chapterMatch: boolean;
  subjectOverlap: boolean;
  reviewerActiveLoad: number;
  reviewerLastAssignedAt: Date | string | null;
};

interface ReviewerAssignPickerProps {
  applicationId: string;
  currentReviewerId?: string | null;
  candidates: Candidate[];
  onAssigned?: () => void;
}

export default function ReviewerAssignPicker({
  applicationId,
  currentReviewerId,
  candidates,
  onAssigned,
}: ReviewerAssignPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = candidates
    .filter((c) => {
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
    startTransition(async () => {
      try {
        const result = currentReviewerId
          ? await reassignReviewer(applicationId, selectedId)
          : await assignReviewer(applicationId, selectedId);
        if (!result.success) {
          setError(result.error ?? "Failed to assign reviewer.");
          return;
        }
        onAssigned?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign reviewer.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        className="input"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 0 }}
      />

      <div
        style={{
          maxHeight: 280,
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
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#e0e7ff",
                    color: "#4338ca",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
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
                      <span className="pill pill-info pill-small">Same chapter</span>
                    )}
                    {c.subjectOverlap && (
                      <span className="pill pill-purple pill-small">Subject match</span>
                    )}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ActiveLoadBadge
                    activeCount={c.reviewerActiveLoad}
                    lastAssignedAt={c.reviewerLastAssignedAt}
                    label="cases"
                  />
                </div>
              </button>
            );
          })
        )}
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>{error}</p>
      )}

      <button
        className="button"
        type="button"
        disabled={!selectedId || isPending}
        onClick={handleAssign}
      >
        {isPending ? "Assigning…" : currentReviewerId ? "Reassign Reviewer" : "Assign Reviewer"}
      </button>
    </div>
  );
}
