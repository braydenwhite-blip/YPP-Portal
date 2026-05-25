import {
  bulkSuggestInstructors,
  createAssignment,
} from "@/lib/workshop-opportunity-actions";
import type { SuggestedInstructor } from "@/lib/workshop-opportunity-queries";

export default function SuggestedInstructorsPanel({
  opportunityId,
  suggestions,
}: {
  opportunityId: string;
  suggestions: SuggestedInstructor[];
}) {
  if (suggestions.length === 0) {
    return (
      <div className="empty">
        <p>No instructor candidates found.</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          Anyone with an INSTRUCTOR role or a submitted application will appear here.
        </p>
      </div>
    );
  }

  const topUnassignedIds = suggestions
    .filter((s) => !s.alreadyAssigned)
    .slice(0, 5)
    .map((s) => s.id);

  return (
    <div>
      {topUnassignedIds.length > 0 && (
        <form
          action={bulkSuggestInstructors}
          style={{ marginBottom: 12 }}
        >
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="instructorIds" value={topUnassignedIds.join(",")} />
          <button type="submit" className="button small">
            Shortlist top {topUnassignedIds.length} as SUGGESTED
          </button>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="card"
            style={{
              padding: 12,
              opacity: s.alreadyAssigned ? 0.55 : 1,
              borderLeft:
                s.score.total >= 6
                  ? "3px solid #16a34a"
                  : s.score.total >= 3
                  ? "3px solid #2563eb"
                  : s.score.total < 0
                  ? "3px solid #b91c1c"
                  : "3px solid transparent",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {s.email}
                  {(s.city || s.state) && ` · ${[s.city, s.state].filter(Boolean).join(", ")}`}
                </div>
                <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <span className="pill pill-small">score {s.score.total}</span>
                  {s.applicationStatus && (
                    <span
                      className={`pill pill-small ${
                        s.applicationStatus === "APPROVED"
                          ? "pill-success"
                          : "pill-info"
                      }`}
                    >
                      {s.applicationStatus.toLowerCase()}
                    </span>
                  )}
                  {s.hasApprovedProposal && (
                    <span className="pill pill-small pill-purple">has proposal</span>
                  )}
                  {s.activeAssignmentCount > 0 && (
                    <span className="pill pill-small">
                      {s.activeAssignmentCount} active
                    </span>
                  )}
                  {s.alreadyAssigned && (
                    <span className="pill pill-small pill-declined">already on this</span>
                  )}
                </div>
              </div>
              {!s.alreadyAssigned && (
                <form action={createAssignment}>
                  <input type="hidden" name="opportunityId" value={opportunityId} />
                  <input type="hidden" name="instructorId" value={s.id} />
                  <input type="hidden" name="status" value="SUGGESTED" />
                  <button type="submit" className="button small">
                    Add
                  </button>
                </form>
              )}
            </div>

            {s.score.reasons.length > 0 && (
              <details style={{ fontSize: 11, marginTop: 6 }}>
                <summary style={{ cursor: "pointer", color: "var(--text-secondary)" }}>
                  Why this score?
                </summary>
                <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                  {s.score.reasons.map((r, i) => (
                    <li
                      key={i}
                      style={{
                        color:
                          r.delta > 0
                            ? "#15803d"
                            : r.delta < 0
                            ? "#b91c1c"
                            : "var(--text-secondary)",
                      }}
                    >
                      {r.label} ({r.delta > 0 ? "+" : ""}
                      {r.delta})
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
