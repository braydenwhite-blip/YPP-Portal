import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getPanelEvents } from "@/lib/alumni-network-actions";
import Link from "next/link";
import RsvpClient from "./rsvp-client";

export const metadata = { title: "Alumni Panel Events — YPP" };

export default async function AlumniEventsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN") || roles.includes("STAFF");

  const [upcoming, past] = await Promise.all([
    getPanelEvents({ upcoming: true, limit: 20 }),
    getPanelEvents({ upcoming: false, limit: 10 }),
  ]);

  const upcomingEvents = upcoming ?? [];
  const pastEvents = (past ?? []).filter(
    (e) => new Date(e.scheduledAt) < new Date()
  ).slice(0, 6);

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">Alumni Network</p>
          <h1 className="page-title">Panel Events</h1>
          <p className="page-subtitle">Live sessions with YPP alumni at top colleges</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/alumni-network" className="button secondary small">← Alumni Hub</Link>
          {isAdmin && (
            <Link href="/alumni-network/events/new" className="button primary small">
              Create Event
            </Link>
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--muted)", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            UPCOMING EVENTS
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {upcomingEvents.map((e) => (
              <div key={e.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>{e.title}</p>
                    {e.myRsvpStatus === "GOING" && (
                      <span className="pill" style={{ fontSize: "0.65rem", background: "#dcfce7", color: "#166534" }}>
                        Attending
                      </span>
                    )}
                    {e.isFull && (
                      <span className="pill" style={{ fontSize: "0.65rem", background: "#fef2f2", color: "#dc2626" }}>
                        Full
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                    🏷️ {e.topic} · {e.durationMinutes} min
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                    📅 {new Date(e.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text)", marginBottom: "0.35rem" }}>
                    {e.description.slice(0, 140)}{e.description.length > 140 ? "…" : ""}
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    {e.panelists.length} panelist{e.panelists.length !== 1 ? "s" : ""}:
                    {e.panelists.slice(0, 3).map((p) => ` ${p.name} (${p.college})`).join(",")}
                    {e.panelists.length > 3 ? ` +${e.panelists.length - 3} more` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0 }}>
                  <RsvpClient eventId={e.id} currentStatus={e.myRsvpStatus} isFull={e.isFull} />
                  <Link href={`/alumni-network/events/${e.id}`} className="button secondary small" style={{ textAlign: "center" }}>
                    Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingEvents.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "3rem", marginBottom: "2rem" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎓</p>
          <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>No upcoming events</p>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>Check back soon for alumni panel sessions</p>
        </div>
      )}

      {/* Past Events / Recordings */}
      {pastEvents.length > 0 && (
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--muted)", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            PAST EVENTS
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
            {pastEvents.map((e) => (
              <Link key={e.id} href={`/alumni-network/events/${e.id}`} style={{ textDecoration: "none" }}>
                <div className="card" style={{ cursor: "pointer", opacity: 0.85 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.2rem" }}>{e.title}</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.3rem" }}>
                    {new Date(e.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {e.recording && (
                    <span className="pill" style={{ fontSize: "0.65rem", background: "#dbeafe", color: "#1e40af" }}>
                      📹 Recording Available
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
