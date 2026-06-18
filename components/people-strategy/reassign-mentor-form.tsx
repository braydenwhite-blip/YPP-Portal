"use client";

import { reassignPrimaryMentorFromForm } from "@/lib/mentorship-reassign-actions";

/**
 * Reassign-mentor form (Phase 4 surface). Posts to the non-destructive
 * `reassignPrimaryMentorFromForm` server action, which preserves the mentee's
 * account, notes, and reviews and records the change in the mentor history.
 * Admin/officer-gated by the caller.
 */
export function ReassignMentorForm({
  menteeId,
  candidates,
}: {
  menteeId: string;
  candidates: Array<{ id: string; name: string }>;
}) {
  return (
    <section className="card" style={{ padding: "16px 18px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Reassign mentor</h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
        Transfer this person to a new primary mentor. Nothing is deleted — the
        previous mentorship is kept as history.
      </p>
      <form action={reassignPrimaryMentorFromForm} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="hidden" name="menteeId" value={menteeId} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          New mentor
          <select name="newMentorId" required defaultValue="" style={{ display: "block", width: "100%", marginTop: 4 }}>
            <option value="" disabled>
              Select a mentor…
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Focus area
          <select name="focusArea" defaultValue="" style={{ display: "block", width: "100%", marginTop: 4 }}>
            <option value="">General / primary</option>
            <option value="INSTRUCTION">Instruction development</option>
            <option value="LEADERSHIP">Organizational leadership</option>
          </select>
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Reason (optional)
          <input name="reason" type="text" style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>

        <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          <input name="isTemporary" type="checkbox" />
          Temporary assignment
        </label>

        <button type="submit" className="btn" style={{ alignSelf: "flex-start" }}>
          Reassign mentor
        </button>
      </form>
    </section>
  );
}
