import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getActivityFeed,
  getRecentActivitySummary,
  EVENT_CATEGORIES,
} from "@/lib/activity-events";
import { ActivityFeedList } from "./client";

export default async function ActivityFeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [events, summary] = await Promise.all([
    getActivityFeed(session.user.id, 50),
    getRecentActivitySummary(session.user.id),
  ]);

  // Group events by category for filtering
  const categorized = events.map((e) => ({
    ...e,
    category: (EVENT_CATEGORIES as Record<string, string>)[e.type] ?? "social",
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Activity Feed</h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 2,
            }}
          >
            Your journey across the portal
          </p>
        </div>
        <Link href="/" className="button secondary">
          Dashboard
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
            This Week
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {summary.totalThisWeek}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>events</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
            This Month
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>
            {summary.totalThisMonth}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>events</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
            Most Active
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#16a34a",
              textTransform: "capitalize",
            }}
          >
            {summary.mostActiveArea ?? "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>area</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
            Breakdown
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, fontSize: 12 }}>
            <span title="Learning">📚 {summary.byCategory.learning}</span>
            <span title="Achievement">🏆 {summary.byCategory.achievement}</span>
            <span title="Social">🤝 {summary.byCategory.social}</span>
          </div>
        </div>
      </div>

      {/* Feed with client-side filtering */}
      <ActivityFeedList events={categorized} />
    </div>
  );
}
