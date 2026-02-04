import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAlumniEvents,
  rsvpToAlumniEvent,
  canAccessAlumniDirectory,
} from "@/lib/alumni-actions";
import Link from "next/link";

export default async function AlumniEventsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const hasAccess = await canAccessAlumniDirectory();

  if (!hasAccess) {
    return (
      <main className="main-content">
        <h1>Alumni Events</h1>
        <div className="card locked">
          <div className="lock-icon">🔒</div>
          <h2>Access Required</h2>
          <p>
            Alumni Events are available to members who have earned at least a{" "}
            <strong>Bronze Award</strong>.
          </p>
          <Link href="/alumni" className="btn btn-primary">
            Learn More
          </Link>
        </div>

        <style jsx>{`
          .locked {
            text-align: center;
            padding: 3rem;
            max-width: 500px;
            margin: 2rem auto;
          }
          .lock-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .locked h2 {
            margin: 0 0 1rem;
          }
          .locked p {
            color: var(--muted);
            margin: 0 0 1.5rem;
          }
        `}</style>
      </main>
    );
  }

  const events = await getAlumniEvents();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/alumni" className="back-link">
            ← Back to Alumni Directory
          </Link>
          <h1>Alumni Events</h1>
          <p className="subtitle">Exclusive events for YPP alumni</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">📅</div>
          <h2>No Upcoming Events</h2>
          <p>
            There are no alumni events scheduled at this time. Check back soon!
          </p>
        </div>
      ) : (
        <div className="events-list">
          {events.map((event) => {
            const userRsvp = event.rsvps[0];
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);

            return (
              <div key={event.id} className="card event-card">
                <div className="event-date">
                  <span className="day">{startDate.getDate()}</span>
                  <span className="month">
                    {startDate.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="year">{startDate.getFullYear()}</span>
                </div>

                <div className="event-details">
                  <div className="event-header">
                    <h3>{event.title}</h3>
                    <span className="event-type">{event.eventType}</span>
                  </div>

                  <p className="description">{event.description}</p>

                  <div className="event-meta">
                    <div className="meta-item">
                      <span className="icon">🕐</span>
                      <span>
                        {startDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {endDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {event.location && (
                      <div className="meta-item">
                        <span className="icon">📍</span>
                        <span>{event.location}</span>
                      </div>
                    )}
                    {event.chapter && (
                      <div className="meta-item">
                        <span className="icon">🏠</span>
                        <span>{event.chapter.name}</span>
                      </div>
                    )}
                    <div className="meta-item">
                      <span className="icon">👥</span>
                      <span>{event._count.rsvps} attending</span>
                    </div>
                  </div>

                  <div className="rsvp-section">
                    <span className="rsvp-label">RSVP:</span>
                    <div className="rsvp-buttons">
                      <form action={rsvpToAlumniEvent.bind(null, event.id, "GOING")}>
                        <button
                          type="submit"
                          className={`rsvp-btn ${userRsvp?.status === "GOING" ? "active" : ""}`}
                        >
                          Going
                        </button>
                      </form>
                      <form action={rsvpToAlumniEvent.bind(null, event.id, "MAYBE")}>
                        <button
                          type="submit"
                          className={`rsvp-btn ${userRsvp?.status === "MAYBE" ? "active" : ""}`}
                        >
                          Maybe
                        </button>
                      </form>
                      <form action={rsvpToAlumniEvent.bind(null, event.id, "NOT_GOING")}>
                        <button
                          type="submit"
                          className={`rsvp-btn ${userRsvp?.status === "NOT_GOING" ? "active" : ""}`}
                        >
                          Can't Go
                        </button>
                      </form>
                    </div>
                  </div>

                  {event.meetingUrl && userRsvp?.status === "GOING" && (
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      className="join-btn"
                    >
                      Join Event →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .page-header {
          margin-bottom: 2rem;
        }
        .back-link {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.875rem;
        }
        .back-link:hover {
          color: var(--primary);
        }
        .subtitle {
          color: var(--muted);
          margin: 0.5rem 0 0;
        }
        .empty {
          text-align: center;
          padding: 3rem;
          max-width: 500px;
          margin: 2rem auto;
        }
        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .empty h2 {
          margin: 0 0 1rem;
        }
        .empty p {
          color: var(--muted);
          margin: 0;
        }
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .event-card {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
        }
        @media (max-width: 640px) {
          .event-card {
            flex-direction: column;
          }
        }
        .event-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 80px;
          padding: 1rem;
          background: var(--primary);
          color: white;
          border-radius: 0.5rem;
        }
        .event-date .day {
          font-size: 2rem;
          font-weight: 700;
          line-height: 1;
        }
        .event-date .month {
          font-size: 0.875rem;
          text-transform: uppercase;
        }
        .event-date .year {
          font-size: 0.75rem;
          opacity: 0.8;
        }
        .event-details {
          flex: 1;
        }
        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        .event-header h3 {
          margin: 0;
        }
        .event-type {
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          background: var(--background);
          border-radius: 1rem;
          text-transform: uppercase;
        }
        .description {
          color: var(--muted);
          margin: 0 0 1rem;
        }
        .event-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }
        .rsvp-section {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
        }
        .rsvp-label {
          font-weight: 600;
          font-size: 0.875rem;
        }
        .rsvp-buttons {
          display: flex;
          gap: 0.5rem;
        }
        .rsvp-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border);
          background: white;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        .rsvp-btn:hover {
          border-color: var(--primary);
        }
        .rsvp-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .join-btn {
          display: inline-block;
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: var(--primary);
          color: white;
          text-decoration: none;
          border-radius: 0.5rem;
          font-weight: 500;
        }
        .join-btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </main>
  );
}
