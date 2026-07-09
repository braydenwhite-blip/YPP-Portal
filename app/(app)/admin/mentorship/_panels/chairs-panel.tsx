"use client";

import { useTransition, useState } from "react";
import { assignCommitteeChair, removeCommitteeChair } from "@/lib/mentorship-program-actions";

export interface SerializedChair {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleType: string;
  /** The named committee this chair leads — null for legacy rows assigned before the lane split; an admin must explicitly re-pick one. */
  lane: string | null;
  isActive: boolean;
}

export interface SerializedUser {
  id: string;
  name: string;
  email: string;
}

interface Props {
  chairs: SerializedChair[];
  eligibleUsers: SerializedUser[];
}

// The four Role Committees from the Mentorship Process Overview. Officers and
// Global Directors/Managers are distinct committees with distinct chairs, even
// though they share the GLOBAL_LEADERSHIP review-approval lane under the hood.
const COMMITTEE_LANES = [
  { value: "OFFICER", label: "Officers" },
  { value: "GLOBAL_DIRECTOR_MANAGER", label: "Global Directors/Managers" },
  { value: "CHAPTER_PRESIDENT", label: "Chapter Presidents" },
  { value: "INSTRUCTOR", label: "Instructors" },
] as const;

export default function ChairsPanel({ chairs, eligibleUsers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeChairs = chairs.filter((c) => c.isActive);
  // Chairs assigned before the Officer / Global Director-Manager split —
  // they still gate review approval via roleType, but need an admin to pick
  // which of the two committees they actually belong to.
  const needsLaneAssignment = activeChairs.filter((c) => !c.lane);

  function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await assignCommitteeChair(formData);
        setSuccess("Committee Chair assigned.");
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign chair");
      }
    });
  }

  function handleRemove(chairId: string, name: string, laneLabel: string) {
    if (!confirm(`Remove ${name} as Chair for ${laneLabel}?`)) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("chairId", chairId);
    startTransition(async () => {
      try {
        await removeCommitteeChair(formData);
        setSuccess("Chair removed.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove chair");
      }
    });
  }

  return (
    <div>
      {needsLaneAssignment.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem", borderColor: "#f59e0b" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>
            {needsLaneAssignment.length} chair{needsLaneAssignment.length === 1 ? "" : "s"} need
            {needsLaneAssignment.length === 1 ? "s" : ""} a committee assignment
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Assigned before Officers and Global Directors/Managers became separate committees.
            They still approve Global Leadership reviews — re-assign them to Officers or Global
            Directors/Managers below so the committee overview reflects reality.
          </p>
          {needsLaneAssignment.map((c) => (
            <p key={c.id} style={{ fontSize: "0.85rem" }}>
              {c.userName} — currently {c.roleType}
            </p>
          ))}
        </div>
      )}

      {/* Current chairs overview */}
      <div className="grid four" style={{ marginBottom: "1.5rem" }}>
        {COMMITTEE_LANES.map(({ value, label }) => {
          const chair = activeChairs.find((c) => c.lane === value);
          return (
            <div key={value} className="card">
              <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "0.4rem" }}>
                {label}
              </p>
              {chair ? (
                <>
                  <p style={{ fontWeight: 600 }}>{chair.userName}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{chair.userEmail}</p>
                  <button
                    className="button outline small"
                    style={{ marginTop: "0.75rem" }}
                    disabled={isPending}
                    onClick={() => handleRemove(chair.id, chair.userName, label)}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No chair assigned</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Assign form */}
      <div className="card">
        <p className="section-title" style={{ marginBottom: "1rem" }}>
          Assign Committee Chair
        </p>
        <form onSubmit={handleAssign}>
          <div className="form-grid">
            <div className="form-row">
              <label>User</label>
              <select name="userId" required>
                <option value="">— select user —</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Role Committee</label>
              <select name="lane" required>
                <option value="">— select committee —</option>
                {COMMITTEE_LANES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>{error}</p>}
          {success && <p style={{ color: "var(--color-success)", marginTop: "0.5rem" }}>{success}</p>}
          <button className="button primary" type="submit" disabled={isPending} style={{ marginTop: "1rem" }}>
            {isPending ? "Assigning…" : "Assign Chair"}
          </button>
        </form>
      </div>

      {/* History */}
      {chairs.filter((c) => !c.isActive).length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            Past Chairs
          </p>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Committee</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {chairs
                .filter((c) => !c.isActive)
                .map((c) => (
                  <tr key={c.id} style={{ opacity: 0.6 }}>
                    <td className="td">{c.userName}</td>
                    <td className="td">
                      {COMMITTEE_LANES.find((l) => l.value === c.lane)?.label ?? c.roleType}
                    </td>
                    <td className="td">
                      <span className="pill pill-declined">Inactive</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
