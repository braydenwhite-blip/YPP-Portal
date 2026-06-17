import { recordMentorshipSessionCapture } from "@/lib/mentorship-hub-actions";

/**
 * Live capture (Calm Mentorship, Phase 5) — a lightweight in-session surface to
 * jot the agenda, running notes, and attendance while the conversation is still
 * happening, without completing the session. Notes are private to the mentor /
 * support circle; the mentee never sees them. Completing the session (a short
 * shared recap + one commitment) is a separate, deliberate step.
 */
export function SessionLiveCapture({
  sessionId,
  menteeId,
  sessionTitle,
  defaultAgenda,
  defaultNotes,
  menteeAttended,
}: {
  sessionId: string;
  menteeId: string;
  sessionTitle: string;
  defaultAgenda: string | null;
  defaultNotes: string | null;
  menteeAttended: boolean;
}) {
  return (
    <details className="card" style={{ display: "grid", gap: 4 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.95rem", listStyle: "revert" }}>
        Capture this session
      </summary>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
        Jot what you cover with {sessionTitle ? `“${sessionTitle}”` : "this session"}{" "}
        as it happens. Saves your notes and attendance without marking the session
        complete.
      </p>
      <form action={recordMentorshipSessionCapture} className="form-grid" style={{ marginTop: 12 }}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="menteeId" value={menteeId} />
        <div className="form-row">
          <label htmlFor={`capture-agenda-${sessionId}`}>What we&apos;re covering</label>
          <textarea
            id={`capture-agenda-${sessionId}`}
            name="agenda"
            className="input"
            rows={2}
            defaultValue={defaultAgenda ?? ""}
            placeholder="Agenda for this conversation"
          />
        </div>
        <div className="form-row">
          <label htmlFor={`capture-notes-${sessionId}`}>
            Private notes <span className="muted" style={{ fontWeight: 400 }}>· mentor &amp; circle only</span>
          </label>
          <textarea
            id={`capture-notes-${sessionId}`}
            name="notes"
            className="input"
            rows={3}
            defaultValue={defaultNotes ?? ""}
            placeholder="Running notes the mentee won't see"
          />
        </div>
        <div className="form-row" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id={`capture-attended-${sessionId}`}
            name="menteeAttended"
            value="true"
            defaultChecked={menteeAttended}
          />
          <label htmlFor={`capture-attended-${sessionId}`} style={{ margin: 0 }}>
            Mentee attended
          </label>
        </div>
        <button type="submit" className="button secondary small">
          Save notes
        </button>
      </form>
    </details>
  );
}
