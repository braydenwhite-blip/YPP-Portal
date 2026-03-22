import Link from "next/link";

type MemberStats = {
  totalMembers: number;
  totalInstructors: number;
  totalStudents: number;
  totalMentors: number;
  activeThisWeek: number;
  newMembers30d: number;
  inactiveMemberCount: number;
};

type InactiveMember = {
  id: string;
  name: string;
  primaryRole: string;
  updatedAt: Date;
};

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function MemberPulse({
  stats,
  inactiveMembers,
}: {
  stats: MemberStats;
  inactiveMembers: InactiveMember[];
}) {
  const activePercent = stats.totalMembers > 0
    ? Math.round((stats.activeThisWeek / stats.totalMembers) * 100)
    : 0;

  const pulseColor = activePercent >= 70
    ? "#16a34a"
    : activePercent >= 40
    ? "#ca8a04"
    : "#dc2626";

  return (
    <div className="card">
      <h2 style={{ margin: 0 }}>Member Pulse</h2>

      {/* Engagement Ring */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16 }}>
        <div style={{ position: "relative", width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            {/* Background circle */}
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="var(--border)"
              strokeWidth="8"
            />
            {/* Active arc */}
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke={pulseColor}
              strokeWidth="8"
              strokeDasharray={`${(activePercent / 100) * 213.6} 213.6`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: pulseColor }}>{activePercent}%</span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {stats.activeThisWeek} of {stats.totalMembers} active this week
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {stats.totalStudents} students
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {stats.totalInstructors} instructors
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {stats.totalMentors} mentors
            </span>
          </div>
        </div>
      </div>

      {/* Key Numbers */}
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            background: "#dcfce7",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: "#166534" }}>
            +{stats.newMembers30d}
          </div>
          <div style={{ fontSize: 12, color: "#166534" }}>New (30d)</div>
        </div>
        <div
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            background: stats.inactiveMemberCount > 0 ? "#fef3c7" : "#f3f4f6",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: stats.inactiveMemberCount > 0 ? "#92400e" : "var(--text)",
            }}
          >
            {stats.inactiveMemberCount}
          </div>
          <div style={{ fontSize: 12, color: stats.inactiveMemberCount > 0 ? "#92400e" : "var(--muted)" }}>
            Inactive (14d+)
          </div>
        </div>
      </div>

      {/* Inactive members preview */}
      {inactiveMembers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Members needing a nudge
          </p>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {inactiveMembers.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <span>{member.name}</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {daysSince(member.updatedAt)}d ago
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/chapter/students"
            style={{ fontSize: 12, color: "var(--ypp-purple)", marginTop: 8, display: "inline-block" }}
          >
            View all members →
          </Link>
        </div>
      )}
    </div>
  );
}
