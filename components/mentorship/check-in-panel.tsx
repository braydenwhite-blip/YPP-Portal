import type { CheckInView } from "@/lib/mentorship-checkin-actions";
import {
  postMenteeCheckIn,
  respondToMenteeCheckIn,
} from "@/lib/mentorship-checkin-actions";

type Props = {
  checkIns: CheckInView[];
  /** "mentee" shows the post form; "mentor" shows the respond form. */
  viewer: "mentee" | "mentor";
  menteeName?: string;
};

const RATING_LABEL: Record<number, string> = {
  1: "Stuck",
  2: "Slow going",
  3: "Steady",
  4: "Good momentum",
  5: "Flying",
};

function ratingColor(rating: number): string {
  if (rating <= 2) return "#ef4444";
  if (rating === 3) return "#f59e0b";
  return "#22c55e";
}

export function CheckInPanel({ checkIns, viewer, menteeName }: Props) {
  return (
    <section id="check-ins" className="card" style={{ scrollMarginTop: 80 }}>
      <div className="section-title">Progress check-ins</div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
        {viewer === "mentee"
          ? "Post a quick progress update between monthly reviews so your mentor can spot blockers early."
          : `Lightweight progress notes ${menteeName ?? "your mentee"} posts between full reviews.`}
      </p>

      {viewer === "mentee" && (
        <form action={postMenteeCheckIn} className="form-grid" style={{ marginBottom: 18 }}>
          <div className="form-row">
            <label
              htmlFor="checkin-notes"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
            >
              How is it going?
            </label>
            <textarea
              id="checkin-notes"
              name="notes"
              className="input"
              rows={3}
              required
              placeholder="A line or two on progress, wins, or where you're stuck."
            />
          </div>
          <div className="form-row">
            <label
              htmlFor="checkin-rating"
              style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
            >
              Momentum (optional)
            </label>
            <select id="checkin-rating" name="rating" className="input" defaultValue="">
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5 — {RATING_LABEL[n]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="button primary small">
            Post check-in
          </button>
        </form>
      )}

      {checkIns.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
          No check-ins yet.
          {viewer === "mentee"
            ? " Your first one starts the thread."
            : " They'll appear here as soon as one is posted."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {checkIns.map((checkIn) => (
            <div
              key={checkIn.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                background: "var(--surface-alt)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {new Date(checkIn.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {checkIn.rating != null && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: ratingColor(checkIn.rating) + "22",
                      color: ratingColor(checkIn.rating),
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {checkIn.rating}/5 · {RATING_LABEL[checkIn.rating]}
                  </span>
                )}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55 }}>
                {checkIn.notes}
              </p>

              {checkIn.mentorResponse ? (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                    }}
                  >
                    Mentor response
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55 }}>
                    {checkIn.mentorResponse}
                  </p>
                </div>
              ) : checkIn.acknowledgedAt ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#16a34a",
                    fontWeight: 600,
                  }}
                >
                  Acknowledged by your mentor
                </div>
              ) : viewer === "mentor" ? (
                <form
                  action={respondToMenteeCheckIn}
                  style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <input type="hidden" name="checkInId" value={checkIn.id} />
                  <textarea
                    name="response"
                    className="input"
                    rows={2}
                    placeholder="Reply, or leave blank to just acknowledge."
                  />
                  <button type="submit" className="button secondary small" style={{ alignSelf: "flex-start" }}>
                    Send response
                  </button>
                </form>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                  Waiting on your mentor.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
