type KpiSnapshot = {
  snapshotDate: Date;
  activeStudents: number;
  activeInstructors: number;
  classesRunningCount: number;
  enrollmentFillPercent: number | null;
  retentionRate: number | null;
  newMembersThisWeek: number;
};

export function GrowthChart({ snapshots }: { snapshots: KpiSnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="card">
        <h2 style={{ margin: 0 }}>Growth Trends</h2>
        <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
          <p>No KPI data yet.</p>
          <p style={{ fontSize: 13 }}>Growth trends will appear here once daily snapshots begin.</p>
        </div>
      </div>
    );
  }

  // Extract data points
  const memberCounts = snapshots.map((s) => s.activeStudents + s.activeInstructors);
  const maxMembers = Math.max(...memberCounts, 1);

  // SVG sparkline dimensions
  const width = 400;
  const height = 100;
  const padding = 4;

  // Build path for member count sparkline
  const points = memberCounts.map((val, i) => {
    const x = padding + (i / Math.max(memberCounts.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - (val / maxMembers) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${width - padding},${height - padding} L${padding},${height - padding} Z`;

  // Compute summary metrics
  const latest = snapshots[snapshots.length - 1];
  const earliest = snapshots[0];
  const memberGrowth = (latest.activeStudents + latest.activeInstructors) - (earliest.activeStudents + earliest.activeInstructors);
  const totalNewMembers = snapshots.reduce((sum, s) => sum + s.newMembersThisWeek, 0);

  return (
    <div className="card">
      <h2 style={{ margin: 0 }}>Growth Trends</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
        Last {snapshots.length} snapshots
      </p>

      {/* Sparkline */}
      <div style={{ marginTop: 16 }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: 100 }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="growth-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ypp-purple)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--ypp-purple)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#growth-gradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--ypp-purple)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Latest point dot */}
          {points.length > 0 && (
            <circle
              cx={parseFloat(points[points.length - 1].split(",")[0])}
              cy={parseFloat(points[points.length - 1].split(",")[1])}
              r="4"
              fill="var(--ypp-purple)"
            />
          )}
        </svg>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: memberGrowth >= 0 ? "#16a34a" : "#dc2626",
            }}
          >
            {memberGrowth >= 0 ? "+" : ""}{memberGrowth}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Net growth</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{totalNewMembers}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>New members</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {latest.retentionRate != null ? `${Math.round(latest.retentionRate)}%` : "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Retention</div>
        </div>
      </div>
    </div>
  );
}
