"use client";

type NoteDistribution = {
  STRONG_YES: number;
  YES: number;
  MAYBE: number;
  NO: number;
};

export default function RecommendationDistributionChart({
  hireCount,
  rejectCount,
  noteCounts,
}: {
  hireCount: number;
  rejectCount: number;
  noteCounts: NoteDistribution;
}) {
  const totalDecisions = hireCount + rejectCount;
  const totalNotes = noteCounts.STRONG_YES + noteCounts.YES + noteCounts.MAYBE + noteCounts.NO;

  function Bar({
    label,
    count,
    total,
    color,
  }: {
    label: string;
    count: number;
    total: number;
    color: string;
  }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 140, fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>{label}</div>
        <div
          style={{
            flex: 1,
            background: "var(--border)",
            borderRadius: 4,
            height: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              background: color,
              height: "100%",
              borderRadius: 4,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ width: 48, fontSize: 13, fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
          {count}
          <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 3 }}>({pct}%)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 14 }}>Recommendation Distribution</strong>
        <span style={{ marginLeft: 8, fontSize: 13, color: "var(--muted)" }}>
          {totalDecisions} pending decision{totalDecisions !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Hire / Reject split */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>
          Reviewer Decisions
        </div>
        <Bar label="Hire" count={hireCount} total={totalDecisions} color="#16a34a" />
        <Bar label="Reject" count={rejectCount} total={totalDecisions} color="#dc2626" />
      </div>

      {/* Interview note recommendation breakdown */}
      {totalNotes > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>
            Interview Note Recommendations ({totalNotes} notes)
          </div>
          <Bar label="Strong Yes" count={noteCounts.STRONG_YES} total={totalNotes} color="#15803d" />
          <Bar label="Yes" count={noteCounts.YES} total={totalNotes} color="#16a34a" />
          <Bar label="Maybe" count={noteCounts.MAYBE} total={totalNotes} color="#d97706" />
          <Bar label="No" count={noteCounts.NO} total={totalNotes} color="#dc2626" />
        </div>
      )}

      {totalNotes === 0 && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          No interview notes with recommendations attached to pending items.
        </p>
      )}
    </div>
  );
}
