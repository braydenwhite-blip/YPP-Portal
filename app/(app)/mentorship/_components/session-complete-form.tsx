import { completeMentorshipSession } from "@/lib/mentorship-hub-actions";

/**
 * Session completion (Calm Mentorship, Phase 6) — a calm, two-field close: a
 * short "what happened" recap (private to the mentor and support circle) and one
 * optional commitment that becomes a tracked action item. Marking complete is
 * idempotent. The mentee sees the session as completed and any shared
 * commitment, but never the private recap.
 */
export function SessionCompleteForm({
  sessionId,
  menteeId,
  menteeName,
  mentorUserId,
  sessionTitle,
  menteeAttended,
}: {
  sessionId: string;
  menteeId: string;
  menteeName: string;
  mentorUserId: string;
  sessionTitle: string;
  menteeAttended: boolean;
}) {
  return (
    <details className="card" style={{ display: "grid", gap: 4 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.95rem", listStyle: "revert" }}>
        Complete this session
      </summary>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
        Close out {sessionTitle ? `“${sessionTitle}”` : "this session"} with a
        short recap and, if it helps, one next step.
      </p>
      <form action={completeMentorshipSession} className="form-grid" style={{ marginTop: 12 }}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="menteeId" value={menteeId} />
        <div className="form-row">
          <label htmlFor={`complete-recap-${sessionId}`}>
            What happened{" "}
            <span className="muted" style={{ fontWeight: 400 }}>
              · private to you &amp; the circle
            </span>
          </label>
          <textarea
            id={`complete-recap-${sessionId}`}
            name="notes"
            className="input"
            rows={3}
            placeholder="A few lines on how it went — the mentee won't see this."
          />
        </div>
        <div className="form-row" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id={`complete-attended-${sessionId}`}
            name="menteeAttended"
            value="true"
            defaultChecked={menteeAttended}
          />
          <label htmlFor={`complete-attended-${sessionId}`} style={{ margin: 0 }}>
            Mentee attended
          </label>
        </div>
        <div className="form-row">
          <label htmlFor={`complete-commitment-${sessionId}`}>One commitment (optional)</label>
          <input
            id={`complete-commitment-${sessionId}`}
            name="commitmentTitle"
            className="input"
            placeholder="The single next step from this session"
          />
        </div>
        <div className="form-row">
          <label htmlFor={`complete-owner-${sessionId}`}>Who owns it?</label>
          <select
            id={`complete-owner-${sessionId}`}
            name="commitmentOwnerId"
            className="input"
            defaultValue={menteeId}
          >
            <option value={menteeId}>{menteeName}</option>
            <option value={mentorUserId}>Me (mentor)</option>
            <option value="">Shared</option>
          </select>
        </div>
        <button type="submit" className="button primary small">
          Mark complete
        </button>
      </form>
    </details>
  );
}
