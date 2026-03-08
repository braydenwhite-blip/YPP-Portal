"use client";

import { useTransition, useState } from "react";
import { assignProgramMentor, endProgramMentorship } from "@/lib/mentorship-program-actions";

export interface SerializedUser {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
}

export interface SerializedPairing {
  id: string;
  mentorName: string;
  mentorEmail: string;
  menteeName: string;
  menteeEmail: string;
  menteeRole: string;
  startDate: string;
  status: string;
}

interface Props {
  pairings: SerializedPairing[];
  potentialMentors: SerializedUser[];
  potentialMentees: SerializedUser[];
}

export default function PairingsPanel({ pairings, potentialMentors, potentialMentees }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await assignProgramMentor(formData);
        setSuccess("Mentor assigned successfully.");
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign mentor");
      }
    });
  }

  function handleEnd(pairingId: string, menteeName: string) {
    if (!confirm(`End the program mentorship for ${menteeName}?`)) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("mentorshipId", pairingId);
    formData.set("status", "COMPLETE");
    startTransition(async () => {
      try {
        await endProgramMentorship(formData);
        setSuccess("Mentorship ended.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to end mentorship");
      }
    });
  }

  const filteredPairings = pairings.filter((p) => {
    const matchesRole = roleFilter === "ALL" || p.menteeRole === roleFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.menteeName.toLowerCase().includes(q) ||
      p.mentorName.toLowerCase().includes(q) ||
      p.menteeEmail.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const activePairings = filteredPairings.filter((p) => p.status === "ACTIVE");
  const inactivePairings = filteredPairings.filter((p) => p.status !== "ACTIVE");

  const ROLE_LABELS: Record<string, string> = {
    ALL: "All Roles",
    INSTRUCTOR: "Instructors",
    CHAPTER_LEAD: "Chapter Presidents",
    ADMIN: "Global Leadership",
    STAFF: "Global Leadership",
  };

  return (
    <div>
      {/* Assign Form */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p className="section-title" style={{ marginBottom: "1rem" }}>
          Assign Program Mentor
        </p>
        <form onSubmit={handleAssign}>
          <div className="form-grid">
            <div className="form-row">
              <label>Mentor</label>
              <select name="mentorId" required>
                <option value="">— select mentor —</option>
                {potentialMentors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Mentee</label>
              <select name="menteeId" required>
                <option value="">— select mentee —</option>
                {potentialMentees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.primaryRole}) — {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Notes (optional)</label>
              <textarea name="notes" rows={2} placeholder="Any notes about this pairing…" />
            </div>
          </div>
          {error && <p style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>{error}</p>}
          {success && <p style={{ color: "var(--color-success)", marginTop: "0.5rem" }}>{success}</p>}
          <button className="button primary" type="submit" disabled={isPending} style={{ marginTop: "1rem" }}>
            {isPending ? "Assigning…" : "Assign Mentor"}
          </button>
        </form>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <input
          className="search-input"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Active pairings table */}
      <p className="section-title" style={{ marginBottom: "0.75rem" }}>
        Active Pairings ({activePairings.length})
      </p>
      {activePairings.length === 0 ? (
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>No active pairings match your filters.</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th className="th">Mentee</th>
                <th className="th">Role</th>
                <th className="th">Mentor</th>
                <th className="th">Since</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activePairings.map((p) => (
                <tr key={p.id}>
                  <td className="td">
                    <div style={{ fontWeight: 500 }}>{p.menteeName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{p.menteeEmail}</div>
                  </td>
                  <td className="td">
                    <span className="pill">{formatRole(p.menteeRole)}</span>
                  </td>
                  <td className="td">
                    <div style={{ fontWeight: 500 }}>{p.mentorName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{p.mentorEmail}</div>
                  </td>
                  <td className="td" style={{ whiteSpace: "nowrap" }}>
                    {new Date(p.startDate).toLocaleDateString()}
                  </td>
                  <td className="td">
                    <button
                      className="button outline small"
                      disabled={isPending}
                      onClick={() => handleEnd(p.id, p.menteeName)}
                    >
                      End
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inactive/completed pairings */}
      {inactivePairings.length > 0 && (
        <>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            Past Pairings ({inactivePairings.length})
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th className="th">Mentee</th>
                  <th className="th">Role</th>
                  <th className="th">Mentor</th>
                  <th className="th">Status</th>
                  <th className="th">Since</th>
                </tr>
              </thead>
              <tbody>
                {inactivePairings.map((p) => (
                  <tr key={p.id} style={{ opacity: 0.65 }}>
                    <td className="td">{p.menteeName}</td>
                    <td className="td">
                      <span className="pill">{formatRole(p.menteeRole)}</span>
                    </td>
                    <td className="td">{p.mentorName}</td>
                    <td className="td">
                      <span className={`pill ${p.status === "PAUSED" ? "pill-pending" : "pill-declined"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="td">{new Date(p.startDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatRole(role: string) {
  const map: Record<string, string> = {
    INSTRUCTOR: "Instructor",
    CHAPTER_LEAD: "Chapter President",
    ADMIN: "Global Leadership",
    STAFF: "Global Leadership",
    MENTOR: "Mentor",
    STUDENT: "Student",
  };
  return map[role] ?? role;
}
