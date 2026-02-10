import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSeasonalEvents } from "@/lib/engagement-actions";
import Link from "next/link";

const SEASON_COLORS: Record<string, string> = {
  FALL: "#d97706", WINTER: "#3b82f6", SPRING: "#16a34a", SUMMER: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: "Coming Soon",
  OPEN_FOR_SUBMISSIONS: "Open for Submissions",
  JUDGING: "Judging in Progress",
  VOTING: "Community Voting",
};

export default async function SeasonalEventsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const events = await getSeasonalEvents();
  const eventList = events as any[];

  const activeEvents = eventList.filter((e) => e.status === "OPEN_FOR_SUBMISSIONS" || e.status === "VOTING");
  const upcomingEvents = eventList.filter((e) => e.status === "UPCOMING");
  const judgingEvents = eventList.filter((e) => e.status === "JUDGING");

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Seasonal Events</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Themed competitions and showcases throughout the year
          </p>
        </div>
        <Link href="/competitions" className="button secondary">All Competitions</Link>
      </div>

      {/* Active Events */}
      {activeEvents.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Active Now</h2>
          <div className="grid two">
            {activeEvents.map((event: any) => {
              const color = SEASON_COLORS[event.season] || "#7c3aed";
              const deadline = event.submissionDeadline
                ? new Date(event.submissionDeadline)
                : null;
              const daysLeft = deadline
                ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <div
                  key={event.id}
                  className="card"
                  style={{
                    border: `2px solid ${color}`,
                    background: `linear-gradient(135deg, #fff 80%, ${color}10)`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span className="pill" style={{ background: `${color}15`, color, fontWeight: 600 }}>
                        {event.season}
                      </span>
                      <span className="pill" style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11 }}>
                        {STATUS_LABELS[event.status] || event.status}
                      </span>
                    </div>
                    {daysLeft != null && daysLeft > 0 && (
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {daysLeft} days left
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: "0 0 8px" }}>{event.title}</h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px" }}>
                    {event.description?.slice(0, 150)}{event.description?.length > 150 ? "..." : ""}
                  </p>
                  {event.theme && (
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      <strong>Theme:</strong> {event.theme}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                      <span>{event._count?.entries || 0} entries</span>
                      <span>{event.xpReward} XP reward</span>
                    </div>
                    <Link href={`/competitions/${event.id}`} className="button primary small">
                      {event.status === "VOTING" ? "Vote Now" : "Submit Entry"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Judging Events */}
      {judgingEvents.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Being Judged</h2>
          <div className="grid two">
            {judgingEvents.map((event: any) => {
              const color = SEASON_COLORS[event.season] || "#7c3aed";
              return (
                <div key={event.id} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span className="pill" style={{ background: `${color}15`, color, fontSize: 11 }}>
                      {event.season}
                    </span>
                    <span className="pill" style={{ background: "#fef3c7", color: "#92400e", fontSize: 11 }}>
                      Judging
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 4px" }}>{event.title}</h4>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {event._count?.entries || 0} entries &middot; Results coming soon
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Coming Up</h2>
          <div className="grid two">
            {upcomingEvents.map((event: any) => {
              const color = SEASON_COLORS[event.season] || "#7c3aed";
              return (
                <div key={event.id} className="card" style={{ opacity: 0.8, borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span className="pill" style={{ background: `${color}15`, color, fontSize: 11 }}>
                      {event.season}
                    </span>
                    <span className="pill" style={{ fontSize: 11 }}>Coming Soon</span>
                  </div>
                  <h4 style={{ margin: "0 0 4px" }}>{event.title}</h4>
                  {event.theme && (
                    <div style={{ fontSize: 12, marginBottom: 4 }}>
                      <strong>Theme:</strong> {event.theme}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {event.xpReward} XP reward &middot; Starts {new Date(event.startDate).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {eventList.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>★</div>
          <h3>No seasonal events right now</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Check back soon for exciting themed competitions and showcases!
          </p>
        </div>
      )}
    </div>
  );
}
