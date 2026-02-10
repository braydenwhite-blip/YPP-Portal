import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyTimeline } from "@/lib/engagement-actions";
import Link from "next/link";

const ENTRY_TYPE_ICONS: Record<string, string> = {
  STARTED_PASSION: "★",
  FIRST_VIDEO: "▶",
  COMPLETED_MODULE: "◆",
  EARNED_BADGE: "◇",
  PRACTICE_MILESTONE: "◎",
  SKILL_UNLOCKED: "⊕",
  JOINED_GROUP: "⊞",
  CREATED_PROJECT: "◐",
  RECEIVED_FEEDBACK: "◑",
  COMPETITION_ENTERED: "◉",
  LEVEL_UP: "▲",
  STREAK_MILESTONE: "≡",
  CUSTOM: "○",
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  STARTED_PASSION: "#7c3aed",
  FIRST_VIDEO: "#3b82f6",
  COMPLETED_MODULE: "#16a34a",
  EARNED_BADGE: "#d97706",
  PRACTICE_MILESTONE: "#ec4899",
  SKILL_UNLOCKED: "#06b6d4",
  JOINED_GROUP: "#8b5cf6",
  CREATED_PROJECT: "#f59e0b",
  RECEIVED_FEEDBACK: "#10b981",
  COMPETITION_ENTERED: "#ef4444",
  LEVEL_UP: "#7c3aed",
  STREAK_MILESTONE: "#d97706",
  CUSTOM: "#6b7280",
};

export default async function PassionTimelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const timelineEntries = await getMyTimeline();
  const entries = timelineEntries as any[];

  // Group entries by month
  const grouped: Record<string, any[]> = {};
  entries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  });
  const months = Object.keys(grouped).sort().reverse();

  const totalXp = entries.reduce((sum: number, e: any) => sum + (e.xpAwarded || 0), 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">My Learning Journey</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Your passion timeline and milestones
          </p>
        </div>
        <Link href="/profile" className="button secondary">My Profile</Link>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{entries.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Milestones</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{totalXp}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>XP Earned on Journey</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{months.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Months Active</div>
        </div>
      </div>

      {/* Timeline */}
      {entries.length > 0 ? (
        <div style={{ position: "relative", paddingLeft: 32 }}>
          {/* Vertical line */}
          <div style={{
            position: "absolute",
            left: 11,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--gray-200)",
          }} />

          {months.map((monthKey) => {
            const monthEntries = grouped[monthKey];
            const [year, month] = monthKey.split("-");
            const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

            return (
              <div key={monthKey} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  marginLeft: 12,
                }}>
                  {monthLabel}
                </div>
                {monthEntries.map((entry: any) => {
                  const color = ENTRY_TYPE_COLORS[entry.entryType] || "#6b7280";
                  const icon = ENTRY_TYPE_ICONS[entry.entryType] || "○";
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        alignItems: "start",
                        gap: 16,
                        marginBottom: 12,
                        position: "relative",
                      }}
                    >
                      {/* Dot on timeline */}
                      <div style={{
                        position: "absolute",
                        left: -32,
                        top: 8,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: `${color}20`,
                        border: `2px solid ${color}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        zIndex: 1,
                      }}>
                        {icon}
                      </div>

                      <div className="card" style={{ flex: 1, borderLeft: `3px solid ${color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span className="pill" style={{ background: `${color}15`, color, fontSize: 11 }}>
                                {entry.entryType.replace(/_/g, " ")}
                              </span>
                              {entry.xpAwarded > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706" }}>
                                  +{entry.xpAwarded} XP
                                </span>
                              )}
                            </div>
                            <h4 style={{ margin: "4px 0 2px" }}>{entry.title}</h4>
                            {entry.description && (
                              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                                {entry.description}
                              </p>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", marginLeft: 12 }}>
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {entry.passionTimeline && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
                            Passion: {entry.passionTimeline.title || entry.passionTimeline.passionId}
                          </div>
                        )}
                        {entry.milestoneLevel != null && entry.milestoneLevel > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <span className="pill" style={{ fontSize: 10, background: "#fef3c7", color: "#92400e" }}>
                              Milestone Level {entry.milestoneLevel}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>★</div>
          <h3>Your journey starts here</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            As you explore passions, complete challenges, and earn badges, your timeline will fill up with milestones!
          </p>
          <Link href="/challenges" className="button primary" style={{ marginTop: 12 }}>
            Start a Challenge
          </Link>
        </div>
      )}
    </div>
  );
}
