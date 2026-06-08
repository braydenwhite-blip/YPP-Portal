"use client";

import { useTransition, useState } from "react";
import { assignCommitteeChair, removeCommitteeChair } from "@/lib/mentorship-program-actions";

export interface SerializedChair {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleType: string;
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

const ROLE_TYPES = [
  { value: "INSTRUCTOR", label: "Instructors" },
  { value: "CHAPTER_PRESIDENT", label: "Chapter Presidents" },
  { value: "GLOBAL_LEADERSHIP", label: "Global Leadership" },
] as const;

export default function ChairsPanel({ chairs, eligibleUsers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeChairs = chairs.filter((c) => c.isActive);

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

  function handleRemove(chairId: string, name: string, roleType: string) {
    if (!confirm(`Remove ${name} as Chair for ${roleType}?`)) return;
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
      {/* Current chairs overview */}
      <div className="grid three" style={{ marginBottom: "1.5rem" }}>
        {ROLE_TYPES.map(({ value, label }) => {
          const chair = activeChairs.find((c) => c.roleType === value);
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
              <label>Role Group</label>
              <select name="roleType" required>
                <option value="">— select role group —</option>
                {ROLE_TYPES.map(({ value, label }) => (
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
                <th className="th">Role Group</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {chairs
                .filter((c) => !c.isActive)
                .map((c) => (
                  <tr key={c.id} style={{ opacity: 0.6 }}>
                    <td className="td">{c.userName}</td>
                    <td className="td">{c.roleType}</td>
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
