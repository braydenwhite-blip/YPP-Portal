import Link from "next/link";

type ActionItem = {
  type: string;
  label: string;
  count: number;
  href: string;
  priority: number;
};

type JoinRequest = {
  id: string;
  user: { id: string; name: string; email: string; primaryRole: string };
  createdAt: Date;
};

type PendingApplication = {
  id: string;
  applicant: { id: string; name: string };
  position: { id: string; title: string };
  submittedAt: Date;
};

const TYPE_ICONS: Record<string, string> = {
  join_requests: "🤝",
  applications: "📋",
  inactive_members: "⚠️",
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  join_requests: { bg: "#ede9fe", text: "#6d28d9" },
  applications: { bg: "#e0f2fe", text: "#075985" },
  inactive_members: { bg: "#fef3c7", text: "#92400e" },
};

export function ActionCenter({
  actionItems,
  pendingJoinRequests,
  pendingApplications,
}: {
  actionItems: ActionItem[];
  pendingJoinRequests: JoinRequest[];
  pendingApplications: PendingApplication[];
}) {
  if (actionItems.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <p style={{ fontSize: 24, marginBottom: 8 }}>✅</p>
        <p style={{ fontWeight: 600 }}>All caught up!</p>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          No pending items need your attention right now.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Needs Your Attention</h2>
        <span
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {actionItems.reduce((sum, a) => sum + a.count, 0)}
        </span>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {actionItems.map((item) => {
          const colors = TYPE_COLORS[item.type] ?? { bg: "#f3f4f6", text: "#374151" };
          return (
            <Link
              key={item.type}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 10,
                background: colors.bg,
                color: colors.text,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                transition: "opacity 0.15s",
              }}
            >
              <span>
                {TYPE_ICONS[item.type] ?? "📌"} {item.label}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {item.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Preview of join requests */}
      {pendingJoinRequests.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Pending Join Requests
          </p>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingJoinRequests.slice(0, 3).map((req) => (
              <div
                key={req.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--ypp-purple)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {req.user.name.charAt(0)}
                </div>
                <span>{req.user.name}</span>
                <span style={{ color: "var(--muted)" }}>{req.user.email}</span>
              </div>
            ))}
            {pendingJoinRequests.length > 3 && (
              <Link href="/chapter/settings" style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
                +{pendingJoinRequests.length - 3} more
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Preview of applications */}
      {pendingApplications.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Recent Applications
          </p>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingApplications.slice(0, 3).map((app) => (
              <div key={app.id} style={{ fontSize: 13 }}>
                <strong>{app.applicant.name}</strong>
                <span style={{ color: "var(--muted)" }}> for {app.position.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
