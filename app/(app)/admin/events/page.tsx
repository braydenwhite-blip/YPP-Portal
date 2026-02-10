import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function EventCalendarManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Get all events
  const events = await prisma.event.findMany({
    include: {
      chapter: true,
      rsvps: {
        include: {
          user: true
        }
      }
    },
    orderBy: { startDate: 'desc' }
  });

  const now = new Date();
  const upcomingEvents = events.filter(e => new Date(e.startDate) >= now);
  const pastEvents = events.filter(e => new Date(e.startDate) < now);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Event Calendar Management</h1>
        </div>
        <Link href="/admin/events/create" className="button primary">
          Create Event
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Manage Organization-Wide Events</h3>
        <p>Create, edit, and track events across all chapters. Monitor registrations and attendance.</p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{events.length}</div>
          <div className="kpi-label">Total Events</div>
        </div>
        <div className="card">
          <div className="kpi">{upcomingEvents.length}</div>
          <div className="kpi-label">Upcoming Events</div>
        </div>
        <div className="card">
          <div className="kpi">{events.reduce((sum, e) => sum + e.rsvps.length, 0)}</div>
          <div className="kpi-label">Total Registrations</div>
        </div>
      </div>

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Upcoming Events</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {upcomingEvents.map(event => {
              return (
                <div key={event.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3>{event.title}</h3>
                        <span className="pill">{event.eventType.replace("_", " ")}</span>
                        {event.isAlumniOnly && <span className="pill">Alumni Only</span>}
                      </div>
                      {event.description && (
                        <p style={{ fontSize: 14, marginBottom: 8 }}>{event.description}</p>
                      )}
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                        📅 {new Date(event.startDate).toLocaleDateString()} at {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {event.location && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                          📍 {event.location}
                        </div>
                      )}
                      {event.chapter && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                          🏢 {event.chapter.name}
                        </div>
                      )}
                      <div style={{ fontSize: 14, marginTop: 8 }}>
                        👥 {event.rsvps.length} registered
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                      <Link href={`/admin/events/${event.id}/edit`} className="button secondary small">
                        Edit
                      </Link>
                      <Link href={`/admin/events/${event.id}/registrations`} className="button primary small">
                        Registrations
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past events */}
      {pastEvents.length > 0 && (
        <div>
          <div className="section-title">Past Events</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pastEvents.slice(0, 10).map(event => (
              <div key={event.id} className="card" style={{ opacity: 0.7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4>{event.title}</h4>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {new Date(event.startDate).toLocaleDateString()} • {event.rsvps.length} RSVPs
                    </div>
                  </div>
                  <Link href={`/admin/events/${event.id}/registrations`} className="button secondary small">
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="card">
          <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            No events created yet. Click "Create Event" to get started!
          </p>
        </div>
      )}
    </div>
  );
}
