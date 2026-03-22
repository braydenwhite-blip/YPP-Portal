import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getPanelEvents, getAlumniDirectory } from "@/lib/alumni-network-actions";
import Link from "next/link";

export const metadata = { title: "Alumni Network — YPP" };

export default async function AlumniNetworkPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [upcomingEvents, directory] = await Promise.all([
    getPanelEvents({ upcoming: true, limit: 3 }),
    getAlumniDirectory(),
  ]);

  const events = upcomingEvents ?? [];
  const alumni = directory ?? [];

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Alumni Network</h1>
          <p className="page-subtitle">Connect with YPP alumni, attend panels, and get advice</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/alumni-network/events" className="button secondary small">View All Events</Link>
          <Link href="/alumni-network/browse" className="button primary small">Browse Alumni →</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid four" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Alumni in Network</p>
          <p style={{ fontWeight: 800, fontSize: "1.5rem" }}>{alumni.length}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Upcoming Events</p>
          <p style={{ fontWeight: 800, fontSize: "1.5rem" }}>{events.length}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Colleges Represented</p>
          <p style={{ fontWeight: 800, fontSize: "1.5rem" }}>
            {new Set(alumni.map((a) => a.college).filter(Boolean)).size}
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Connect</p>
          <Link href="/alumni-network/browse" className="button primary small" style={{ marginTop: "0.25rem", display: "inline-block" }}>
            Send Intro →
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Upcoming Events */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>Upcoming Panel Events</p>
            <Link href="/alumni-network/events" style={{ fontSize: "0.8rem", color: "var(--ypp-purple-500)" }}>
              View all →
            </Link>
          </div>
          {events.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
              <p>No upcoming events. Check back soon!</p>
            </div>
          ) : (
            events.map((e) => (
              <Link key={e.id} href={`/alumni-network/events/${e.id}`} style={{ textDecoration: "none" }}>
                <div className="card" style={{ marginBottom: "0.75rem", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                    <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{e.title}</p>
                    {e.myRsvpStatus === "GOING" && (
                      <span className="pill" style={{ fontSize: "0.65rem", background: "#dcfce7", color: "#166534" }}>
                        Attending
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                    🏷️ {e.topic}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    📅 {new Date(e.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })} · {e.durationMinutes}min
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                    {e.panelists.length} panelist{e.panelists.length !== 1 ? "s" : ""} · {e.rsvpCount} attending
                    {e.maxAttendees !== null && ` / ${e.maxAttendees} max`}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Alumni Spotlight */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>Alumni Network</p>
            <Link href="/alumni-network/browse" style={{ fontSize: "0.8rem", color: "var(--ypp-purple-500)" }}>
              Browse all →
            </Link>
          </div>
          {alumni.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
              <p>No alumni profiles yet.</p>
            </div>
          ) : (
            alumni.slice(0, 4).map((a) => (
              <div key={a.id} className="card" style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "0.88rem" }}>{a.name}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      🎓 {a.college}{a.yearStarted ? ` · Class of ${a.yearStarted}` : ""}
                    </p>
                    {a.chapterName && (
                      <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>YPP {a.chapterName}</p>
                    )}
                  </div>
                  {a.introStatus === "ACCEPTED" ? (
                    <span className="pill" style={{ fontSize: "0.65rem", background: "#dcfce7", color: "#166534" }}>
                      Connected
                    </span>
                  ) : a.introStatus === "PENDING" ? (
                    <span className="pill" style={{ fontSize: "0.65rem" }}>Pending</span>
                  ) : (
                    <Link href="/alumni-network/browse" className="button secondary small" style={{ fontSize: "0.72rem" }}>
                      Connect
                    </Link>
                  )}
                </div>
                {a.bio && (
                  <p style={{ fontSize: "0.75rem", color: "var(--text)", marginTop: "0.3rem", lineHeight: 1.5 }}>
                    {a.bio.slice(0, 100)}{a.bio.length > 100 ? "…" : ""}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
