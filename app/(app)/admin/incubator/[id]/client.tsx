"use client";

import { useState } from "react";
import { reviewApplication, assignMentor } from "@/lib/incubator-actions";

export function ReviewAppButton({ applicationId }: { applicationId: string }) {
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  async function handleReview(status: string) {
    setLoading(true);
    try {
      await reviewApplication(applicationId, status, note || undefined);
      setReviewed(true);
      setTimeout(() => window.location.reload(), 500);
    } catch {}
    setLoading(false);
  }

  if (reviewed) {
    return <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Done!</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
      {showNote && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Review note (optional)"
          className="input"
          style={{ fontSize: 12, marginBottom: 4 }}
        />
      )}
      {!showNote && (
        <button onClick={() => setShowNote(true)} className="button secondary small" style={{ fontSize: 11 }}>
          Add Note
        </button>
      )}
      <button onClick={() => handleReview("ACCEPTED")} disabled={loading} className="button primary small">
        {loading ? "..." : "Accept"}
      </button>
      <button onClick={() => handleReview("WAITLISTED")} disabled={loading} className="button secondary small" style={{ fontSize: 11 }}>
        Waitlist
      </button>
      <button onClick={() => handleReview("REJECTED")} disabled={loading} className="button secondary small" style={{ fontSize: 11, color: "#ef4444" }}>
        Reject
      </button>
    </div>
  );
}

export function AssignMentorForm({
  projectId,
  mentors,
}: {
  projectId: string;
  mentors: { id: string; name: string; primaryRole: string }[];
}) {
  const [assigned, setAssigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState("");

  async function handleAssign() {
    if (!selectedMentor) return;
    setLoading(true);
    try {
      await assignMentor(projectId, selectedMentor);
      setAssigned(true);
      setTimeout(() => window.location.reload(), 500);
    } catch {}
    setLoading(false);
  }

  if (assigned) {
    return <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Assigned!</span>;
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <select
        value={selectedMentor}
        onChange={(e) => setSelectedMentor(e.target.value)}
        className="input"
        style={{ fontSize: 12, minWidth: 150 }}
      >
        <option value="">Assign mentor...</option>
        {mentors.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.primaryRole})
          </option>
        ))}
      </select>
      <button onClick={handleAssign} disabled={loading || !selectedMentor} className="button primary small" style={{ fontSize: 11 }}>
        {loading ? "..." : "Assign"}
      </button>
    </div>
  );
}
