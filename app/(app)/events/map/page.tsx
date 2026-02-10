import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterEventsForMap } from "@/lib/real-world-actions";
import Link from "next/link";

export default async function ChapterEventsMapPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const chapters = await getChapterEventsForMap();

  const regionColors: Record<string, string> = {
    Northeast: "#3b82f6",
    Southeast: "#16a34a",
    Midwest: "#d97706",
    Southwest: "#ef4444",
    West: "#7c3aed",
    Northwest: "#06b6d4",
    International: "#ec4899",
  };

  // Group by region
  const byRegion = chapters.reduce<Record<string, typeof chapters>>((acc, ch) => {
    const region = ch.region || "Other";
    if (!acc[region]) acc[region] = [];
    acc[region].push(ch);
    return acc;
  }, {});

  const totalEvents = chapters.reduce((sum, ch) => sum + ch.events.length, 0);
  const totalMembers = chapters.reduce((sum, ch) => sum + ch._count.users, 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/events" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Events
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Chapter Events Map</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            See what&apos;s happening across all YPP chapters
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Chapters</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{chapters.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Regions</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{Object.keys(byRegion).length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Upcoming Events</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{totalEvents}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Members</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{totalMembers}</div>
        </div>
      </div>

      {/* Visual map (region cards) */}
      {Object.entries(byRegion).map(([region, regionChapters]) => {
        const color = regionColors[region] || "#6b7280";

        return (
          <div key={region} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
              <h2 style={{ fontSize: 16, margin: 0 }}>{region}</h2>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {regionChapters.length} chapter{regionChapters.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid three">
              {regionChapters.map((chapter) => (
                <div key={chapter.id} className="card" style={{ borderTop: `3px solid ${color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{chapter.name}</h4>
                      {chapter.city && (
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {chapter.city}{chapter.region ? `, ${chapter.region}` : ""}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {chapter._count.users} members
                    </span>
                  </div>

                  {chapter.partnerSchool && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                      Partner: {chapter.partnerSchool}
                    </div>
                  )}

                  {/* Upcoming events */}
                  {chapter.events.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        Upcoming Events
                      </div>
                      {chapter.events.map((event) => (
                        <div
                          key={event.id}
                          style={{
                            padding: "6px 8px",
                            background: "var(--surface-alt)",
                            borderRadius: "var(--radius-sm)",
                            marginBottom: 4,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{event.title}</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                            {new Date(event.startDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                            {event.location && ` | ${event.location}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
                      No upcoming events
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {chapters.length === 0 && (
        <div className="card">
          <h3>No Chapters Yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>Chapter data will appear here once chapters are created.</p>
        </div>
      )}
    </div>
  );
}
