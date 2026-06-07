import type { MentorshipHealth } from "@/lib/people-strategy/mentorship-health";
import { PersonLink } from "@/components/people-strategy/person-link";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

/**
 * Leadership-only mentorship health roll-up on the People Dashboard (#12):
 * active pairings, at-risk pairings (stale check-ins / stalled cycles), and
 * instructors with no mentor. Collapsed by default with a live summary.
 */
export function MentorshipHealthSection({ health }: { health: MentorshipHealth }) {
  const { activePairs, atRisk, unmatchedCount, unmatched, mentorsWithCapacity } = health;
  if (activePairs === 0 && unmatchedCount === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <CollapsibleSection
        title="Mentorship Health"
        summary={`${activePairs} active · ${atRisk.length} at-risk · ${unmatchedCount} unmatched`}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <Stat label="Active pairings" value={activePairs} />
          <Stat label="At risk" value={atRisk.length} accent={atRisk.length > 0} />
          <Stat label="Instructors unmatched" value={unmatchedCount} accent={unmatchedCount > 0} />
        </div>

        {atRisk.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <p style={SUBHEAD}>At-risk pairings</p>
            <ul style={LIST}>
              {atRisk.map((p) => (
                <li key={p.id} style={ROW}>
                  <span style={{ minWidth: 0 }}>
                    <PersonLink id={p.mentorId} style={LINK}>
                      {p.mentorName}
                    </PersonLink>
                    <span style={{ color: "var(--muted)" }}> → </span>
                    <PersonLink id={p.menteeId} style={LINK}>
                      {p.menteeName}
                    </PersonLink>
                  </span>
                  <span style={{ color: "var(--error-color)", fontSize: 12, whiteSpace: "nowrap" }}>
                    {p.reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
            All active pairings have recent check-ins. 🎉
          </p>
        )}

        {unmatched.length > 0 ? (
          <div>
            <p style={SUBHEAD}>
              Instructors without a mentor
              {unmatchedCount > unmatched.length ? ` (showing ${unmatched.length} of ${unmatchedCount})` : ""}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {unmatched.map((m) => (
                <PersonLink
                  key={m.id}
                  id={m.id}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ypp-ink)",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  {m.name}
                </PersonLink>
              ))}
            </div>
          </div>
        ) : null}

        {mentorsWithCapacity.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <p style={SUBHEAD}>Mentors with open capacity</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {mentorsWithCapacity.map((m) => (
                <PersonLink
                  key={m.id}
                  id={m.id}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ypp-ink)",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  {m.name} · {m.openSlots} open
                </PersonLink>
              ))}
            </div>
          </div>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}

const SUBHEAD: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--muted)",
};
const LIST: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const ROW: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "baseline",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 14,
};
const LINK: React.CSSProperties = { fontWeight: 600, color: "var(--ypp-ink)" };

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "10px 14px",
        flex: "1 1 130px",
        minWidth: 120,
        borderLeft: accent ? "3px solid var(--error-color)" : undefined,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: accent ? "var(--error-color)" : "inherit" }}>
        {value}
      </p>
    </div>
  );
}
