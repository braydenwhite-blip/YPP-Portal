"use client";

import { useState } from "react";
import { approveProjectLaunch, assignMentor, reviewApplication } from "@/lib/incubator-actions";

function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 6 }}>{message}</div>;
}

export function ReviewApplicationActions({
  applicationId,
  mentors,
}: {
  applicationId: string;
  mentors: Array<{ id: string; name: string; primaryRole: string; _count?: { incubatorMentoring: number } }>;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMentor, setSelectedMentor] = useState("");
  const [note, setNote] = useState("");
  const [vision, setVision] = useState("4");
  const [readiness, setReadiness] = useState("4");
  const [commitment, setCommitment] = useState("4");

  async function handleReview(status: "ACCEPTED" | "WAITLISTED" | "REJECTED") {
    setLoading(true);
    setError("");
    try {
      await reviewApplication({
        applicationId,
        status,
        reviewNote: note || undefined,
        mentorId: status === "ACCEPTED" ? selectedMentor : undefined,
        rubric: {
          vision: parseInt(vision, 10),
          readiness: parseInt(readiness, 10),
          commitment: parseInt(commitment, 10),
        },
      });
      setReviewed(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (reviewError: any) {
      setError(reviewError?.message || "Could not review application");
      setLoading(false);
    }
  }

  if (reviewed) {
    return <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>Done</span>;
  }

  return (
    <div style={{ minWidth: 250 }}>
      <ErrorText message={error} />
      <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
        <select
          value={selectedMentor}
          onChange={(event) => setSelectedMentor(event.target.value)}
          className="input"
          style={{ fontSize: 12, width: "100%" }}
        >
          <option value="">Choose mentor for acceptance...</option>
          {mentors.map((mentor) => (
            <option key={mentor.id} value={mentor.id}>
              {mentor.name} ({mentor.primaryRole}) · {mentor._count?.incubatorMentoring ?? 0} project(s)
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Review note"
          className="input"
          style={{ fontSize: 12, width: "100%" }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
          <select value={vision} onChange={(event) => setVision(event.target.value)} className="input" style={{ fontSize: 12 }}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Vision {value}</option>)}
          </select>
          <select value={readiness} onChange={(event) => setReadiness(event.target.value)} className="input" style={{ fontSize: 12 }}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Readiness {value}</option>)}
          </select>
          <select value={commitment} onChange={(event) => setCommitment(event.target.value)} className="input" style={{ fontSize: 12 }}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Commitment {value}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          onClick={() => handleReview("ACCEPTED")}
          disabled={loading || !selectedMentor}
          className="button primary small"
        >
          {loading ? "..." : "Accept + Assign Mentor"}
        </button>
        <button onClick={() => handleReview("WAITLISTED")} disabled={loading} className="button secondary small" style={{ fontSize: 11 }}>
          Waitlist
        </button>
        <button onClick={() => handleReview("REJECTED")} disabled={loading} className="button secondary small" style={{ fontSize: 11, color: "#ef4444" }}>
          Reject
        </button>
      </div>
    </div>
  );
}

export function AssignMentorForm({
  projectId,
  mentors,
}: {
  projectId: string;
  mentors: Array<{ id: string; name: string; primaryRole: string; _count?: { incubatorMentoring: number } }>;
}) {
  const [assigned, setAssigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState("");
  const [error, setError] = useState("");

  async function handleAssign() {
    if (!selectedMentor) return;
    setLoading(true);
    setError("");
    try {
      await assignMentor(projectId, selectedMentor);
      setAssigned(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (assignmentError: any) {
      setError(assignmentError?.message || "Could not assign mentor");
      setLoading(false);
    }
  }

  if (assigned) {
    return <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>Assigned!</span>;
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <ErrorText message={error} />
      <select
        value={selectedMentor}
        onChange={(event) => setSelectedMentor(event.target.value)}
        className="input"
        style={{ fontSize: 12, minWidth: 170 }}
      >
        <option value="">Assign mentor...</option>
        {mentors.map((mentor) => (
          <option key={mentor.id} value={mentor.id}>
            {mentor.name} ({mentor.primaryRole}) · {mentor._count?.incubatorMentoring ?? 0}
          </option>
        ))}
      </select>
      <button onClick={handleAssign} disabled={loading || !selectedMentor} className="button primary small" style={{ fontSize: 11 }}>
        {loading ? "..." : "Assign"}
      </button>
    </div>
  );
}

export function ApproveLaunchButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setLoading(true);
    setError("");
    try {
      await approveProjectLaunch(projectId);
      window.location.reload();
    } catch (approvalError: any) {
      setError(approvalError?.message || "Could not approve launch");
      setLoading(false);
    }
  }

  return (
    <div>
      <ErrorText message={error} />
      <button onClick={handleApprove} disabled={loading} className="button primary small">
        {loading ? "Publishing..." : "Approve Launch"}
      </button>
    </div>
  );
}
