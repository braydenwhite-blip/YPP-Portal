import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import {
  getProgramById,
  enrollInProgram,
  withdrawFromProgram,
} from "@/lib/program-actions";
import Link from "next/link";

export default async function ProgramDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { program, isEnrolled } = await getProgramById(params.id);

  if (!program) {
    notFound();
  }

  const typeColors: Record<string, string> = {
    PASSION_LAB: "#7c3aed",
    COMPETITION_PREP: "#dc2626",
    EXPERIENCE: "#16a34a",
    SEQUENCE: "#2563eb",
  };

  const upcomingSessions = program.sessions.filter(
    (s) => new Date(s.scheduledAt) >= new Date()
  );
  const pastSessions = program.sessions.filter(
    (s) => new Date(s.scheduledAt) < new Date()
  );

  return (
    <main className="main-content programs-id-page">
      <div className="page-header">
        <div>
          <Link href="/programs" className="back-link">
            ← Back to Programs
          </Link>
          <div className="badges">
            <span
              className="type-badge"
              style={{ backgroundColor: typeColors[program.type] }}
            >
              {program.type.replace("_", " ")}
            </span>
            {program.isVirtual && (
              <span className="virtual-badge">Virtual</span>
            )}
          </div>
          <h1>{program.name}</h1>
          <p className="interest-area">{program.interestArea}</p>
        </div>
        <div className="header-actions">
          {isEnrolled ? (
            <form action={withdrawFromProgram.bind(null, program.id)}>
              <button type="submit" className="btn btn-danger">
                Withdraw
              </button>
            </form>
          ) : (
            <form action={enrollInProgram.bind(null, program.id)}>
              <button type="submit" className="btn btn-primary">
                Enroll Now
              </button>
            </form>
          )}
        </div>
      </div>

      {isEnrolled && (
        <div className="enrolled-banner">
          ✓ You are enrolled in this program
        </div>
      )}

      <div className="program-grid">
        <div className="main-column">
          {/* Description */}
          <section className="card">
            <h2>About This Program</h2>
            <p className="description">
              {program.description || "No description available."}
            </p>
          </section>

          {/* Upcoming Sessions */}
          <section className="card">
            <h2>Upcoming Sessions ({upcomingSessions.length})</h2>
            {upcomingSessions.length === 0 ? (
              <p className="empty">No upcoming sessions scheduled.</p>
            ) : (
              <div className="sessions-list">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="session-item">
                    <div className="session-date">
                      <span className="day">
                        {new Date(session.scheduledAt).getDate()}
                      </span>
                      <span className="month">
                        {new Date(session.scheduledAt).toLocaleDateString(
                          "en-US",
                          { month: "short" }
                        )}
                      </span>
                    </div>
                    <div className="session-details">
                      <h4>{session.title}</h4>
                      {session.description && (
                        <p className="session-desc">{session.description}</p>
                      )}
                      <div className="session-meta">
                        <span className="time">
                          {new Date(session.scheduledAt).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}
                        </span>
                        <span className="duration">{session.duration} min</span>
                        {session.meetingLink && isEnrolled && (
                          <a
                            href={session.meetingLink}
                            target="_blank"
                            className="meeting-link"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past Sessions */}
          {pastSessions.length > 0 && (
            <section className="card">
              <h2>Past Sessions ({pastSessions.length})</h2>
              <div className="sessions-list past">
                {pastSessions.map((session) => (
                  <div key={session.id} className="session-item past">
                    <div className="session-date past">
                      <span className="day">
                        {new Date(session.scheduledAt).getDate()}
                      </span>
                      <span className="month">
                        {new Date(session.scheduledAt).toLocaleDateString(
                          "en-US",
                          { month: "short" }
                        )}
                      </span>
                    </div>
                    <div className="session-details">
                      <h4>{session.title}</h4>
                      <div className="session-meta">
                        <span className="time">
                          {new Date(session.scheduledAt).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}
                        </span>
                        <span className="duration">{session.duration} min</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="side-column">
          {/* Program Info */}
          <section className="card">
            <h3>Program Info</h3>
            <div className="info-item">
              <span className="label">Participants</span>
              <span className="value">{program._count.participants}</span>
            </div>
            <div className="info-item">
              <span className="label">Total Sessions</span>
              <span className="value">{program.sessions.length}</span>
            </div>
            <div className="info-item">
              <span className="label">Format</span>
              <span className="value">
                {program.isVirtual ? "Virtual" : "In-Person"}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Status</span>
              <span className="value">
                {program.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </section>

          {/* Program Leader */}
          {program.leader && (
            <section className="card">
              <h3>Program Leader</h3>
              <div className="leader-info">
                <div className="avatar">
                  {program.leader.name.charAt(0).toUpperCase()}
                </div>
                <div className="details">
                  <strong>{program.leader.name}</strong>
                  {isEnrolled && (
                    <a href={`mailto:${program.leader.email}`} className="email">
                      {program.leader.email}
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Quick Actions */}
          <section className="card">
            <h3>Quick Links</h3>
            <div className="quick-links">
              <Link href="/programs/my" className="quick-link">
                My Programs
              </Link>
              <Link href="/programs" className="quick-link">
                Browse All
              </Link>
            </div>
          </section>
        </div>
      </div>

      <style>{`

        .programs-id-page .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .programs-id-page .back-link {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.875rem;
        }
        .programs-id-page .back-link:hover {
          color: var(--primary);
        }
        .programs-id-page .badges {
          display: flex;
          gap: 0.5rem;
          margin: 0.5rem 0;
        }
        .programs-id-page .type-badge {
          font-size: 0.75rem;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          text-transform: uppercase;
        }
        .programs-id-page .virtual-badge {
          font-size: 0.75rem;
          background: #dcfce7;
          color: #166534;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
        }
        .programs-id-page .interest-area {
          color: var(--muted);
          margin: 0;
        }
        .programs-id-page .enrolled-banner {
          background: #dcfce7;
          color: #166534;
          padding: 1rem;
          border-radius: 0.5rem;
          text-align: center;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }
        .programs-id-page .program-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .programs-id-page .program-grid {
            grid-template-columns: 1fr;
          }
        }
        .programs-id-page .card {
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .programs-id-page .card h2,
        .programs-id-page .card h3 {
          margin: 0 0 1rem;
        }
        .programs-id-page .description {
          margin: 0;
          line-height: 1.6;
        }
        .programs-id-page .empty {
          color: var(--muted);
          font-style: italic;
        }
        .programs-id-page .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .programs-id-page .session-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .programs-id-page .session-item.past {
          opacity: 0.6;
        }
        .programs-id-page .session-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 60px;
          padding: 0.5rem;
          background: var(--primary);
          color: white;
          border-radius: 0.5rem;
        }
        .programs-id-page .session-date.past {
          background: var(--muted);
        }
        .programs-id-page .session-date .day {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }
        .programs-id-page .session-date .month {
          font-size: 0.75rem;
          text-transform: uppercase;
        }
        .programs-id-page .session-details {
          flex: 1;
        }
        .programs-id-page .session-details h4 {
          margin: 0 0 0.5rem;
        }
        .programs-id-page .session-desc {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0 0 0.5rem;
        }
        .programs-id-page .session-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
        }
        .programs-id-page .time,
        .programs-id-page .duration {
          color: var(--muted);
        }
        .programs-id-page .meeting-link {
          color: var(--primary);
          font-weight: 500;
        }
        .programs-id-page .info-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border);
        }
        .programs-id-page .info-item:last-child {
          border-bottom: none;
        }
        .programs-id-page .info-item .label {
          color: var(--muted);
        }
        .programs-id-page .info-item .value {
          font-weight: 600;
        }
        .programs-id-page .leader-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .programs-id-page .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
        }
        .programs-id-page .leader-info .email {
          display: block;
          font-size: 0.875rem;
          color: var(--primary);
        }
        .programs-id-page .quick-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .programs-id-page .quick-link {
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
          text-decoration: none;
          color: inherit;
          font-weight: 500;
        }
        .programs-id-page .quick-link:hover {
          background: var(--primary);
          color: white;
        }
        .programs-id-page .btn-danger {
          background: #fee2e2;
          color: #991b1b;
          border: none;
        }
        .programs-id-page .btn-danger:hover {
          background: #fecaca;
        }
      
`}</style>
    </main>
  );
}
