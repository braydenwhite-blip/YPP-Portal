"use client";

type MissingEntry = {
  mentorshipId: string;
  menteeName: string | null;
  menteeRole: string | null;
  mentorName: string | null;
};

interface Props {
  total: number;
  submitted: number;
  missing: MissingEntry[];
}

export default function ReviewCompletionPanel({ total, submitted, missing }: Props) {
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 100;
  const barColor = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      {/* Summary bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{submitted} / {total} reviews submitted this cycle</span>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: "var(--border)", borderRadius: 99 }}>
          <div style={{ height: 6, width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 0.3s" }} />
        </div>
      </div>

      {missing.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "#166534", background: "#f0fdf4", padding: "0.5rem 0.75rem", borderRadius: 6, margin: 0, border: "1px solid #bbf7d0" }}>
          All active mentorships have submitted a review this cycle.
        </p>
      ) : (
        <div>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 8px" }}>
            {missing.length} mentorship{missing.length > 1 ? "s" : ""} without a review this cycle:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {missing.slice(0, 15).map((m) => (
              <div
                key={m.mentorshipId}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.7rem", background: "var(--surface-alt)", borderRadius: 5, fontSize: "0.82rem" }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{m.menteeName ?? "Unknown"}</span>
                  <span style={{ color: "var(--muted)", marginLeft: 6 }}>{m.menteeRole}</span>
                </div>
                <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Mentor: {m.mentorName}</span>
              </div>
            ))}
            {missing.length > 15 && (
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "4px 0 0" }}>
                …and {missing.length - 15} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
