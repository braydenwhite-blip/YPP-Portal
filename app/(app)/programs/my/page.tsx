import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyPrograms, withdrawFromProgram } from "@/lib/program-actions";
import Link from "next/link";

export default async function MyProgramsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const enrollments = await getMyPrograms();

  const typeColors: Record<string, string> = {
    PASSION_LAB: "#7c3aed",
    COMPETITION_PREP: "#dc2626",
    EXPERIENCE: "#16a34a",
    SEQUENCE: "#2563eb",
  };

  return (
    <main className="main-content programs-my-page">
      <div className="page-header">
        <div>
          <h1>My Programs</h1>
          <p className="subtitle">
            Programs you're currently enrolled in
          </p>
        </div>
        <Link href="/programs" className="btn btn-secondary">
          Browse Programs
        </Link>
      </div>

      {enrollments.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">📚</div>
          <h2>No Programs Yet</h2>
          <p>
            You haven't enrolled in any special programs. Browse our offerings
            to find something that interests you!
          </p>
          <Link href="/programs" className="btn btn-primary">
            Browse Programs
          </Link>
        </div>
      ) : (
        <div className="programs-list">
          {enrollments.map((enrollment) => {
            const program = enrollment.program;
            const nextSession = program.sessions[0];

            return (
              <div key={enrollment.id} className="card program-card">
                <div className="program-header">
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
                  <form
                    action={withdrawFromProgram.bind(null, program.id)}
                  >
                    <button type="submit" className="btn btn-sm btn-danger">
                      Withdraw
                    </button>
                  </form>
                </div>

                <Link href={`/programs/${program.id}`} className="program-link">
                  <h3>{program.name}</h3>
                </Link>

                <p className="interest">{program.interestArea}</p>

                {program.leader && (
                  <p className="leader">Led by {program.leader.name}</p>
                )}

                <div className="program-stats">
                  <span>{program._count.sessions} sessions</span>
                  <span>
                    Enrolled{" "}
                    {new Date(enrollment.enrolledAt).toLocaleDateString()}
                  </span>
                </div>

                {nextSession && (
                  <div className="next-session">
                    <h4>Next Session</h4>
                    <div className="session-info">
                      <div className="session-date">
                        <span className="day">
                          {new Date(nextSession.scheduledAt).getDate()}
                        </span>
                        <span className="month">
                          {new Date(nextSession.scheduledAt).toLocaleDateString(
                            "en-US",
                            { month: "short" }
                          )}
                        </span>
                      </div>
                      <div className="session-details">
                        <strong>{nextSession.title}</strong>
                        <span className="time">
                          {new Date(nextSession.scheduledAt).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}{" "}
                          • {nextSession.duration} min
                        </span>
                        {nextSession.meetingLink && (
                          <a
                            href={nextSession.meetingLink}
                            target="_blank"
                            className="join-btn"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <Link
                  href={`/programs/${program.id}`}
                  className="view-details"
                >
                  View Program Details →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <style>{`

        .programs-my-page .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .programs-my-page .subtitle {
          color: var(--muted);
          margin: 0.5rem 0 0;
        }
        .programs-my-page .empty {
          text-align: center;
          padding: 3rem;
          max-width: 500px;
          margin: 2rem auto;
        }
        .programs-my-page .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .programs-my-page .empty h2 {
          margin: 0 0 1rem;
        }
        .programs-my-page .empty p {
          color: var(--muted);
          margin: 0 0 1.5rem;
        }
        .programs-my-page .programs-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .programs-my-page .program-card {
          padding: 1.5rem;
        }
        .programs-my-page .program-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .programs-my-page .badges {
          display: flex;
          gap: 0.5rem;
        }
        .programs-my-page .type-badge {
          font-size: 0.75rem;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          text-transform: uppercase;
        }
        .programs-my-page .virtual-badge {
          font-size: 0.75rem;
          background: #dcfce7;
          color: #166534;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
        }
        .programs-my-page .program-link {
          text-decoration: none;
          color: inherit;
        }
        .programs-my-page .program-link:hover h3 {
          color: var(--primary);
        }
        .programs-my-page .program-card h3 {
          margin: 0 0 0.5rem;
          transition: color 0.2s;
        }
        .programs-my-page .interest {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0 0 0.5rem;
        }
        .programs-my-page .leader {
          font-size: 0.875rem;
          margin: 0 0 1rem;
        }
        .programs-my-page .program-stats {
          display: flex;
          gap: 2rem;
          font-size: 0.875rem;
          color: var(--muted);
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }
        .programs-my-page .next-session {
          margin: 1rem 0;
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .programs-my-page .next-session h4 {
          margin: 0 0 0.75rem;
          font-size: 0.875rem;
          color: var(--muted);
          text-transform: uppercase;
        }
        .programs-my-page .session-info {
          display: flex;
          gap: 1rem;
        }
        .programs-my-page .session-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 50px;
          padding: 0.5rem;
          background: var(--primary);
          color: white;
          border-radius: 0.5rem;
        }
        .programs-my-page .session-date .day {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1;
        }
        .programs-my-page .session-date .month {
          font-size: 0.625rem;
          text-transform: uppercase;
        }
        .programs-my-page .session-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .programs-my-page .session-details .time {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .programs-my-page .join-btn {
          display: inline-block;
          margin-top: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--primary);
          color: white;
          border-radius: 0.25rem;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          width: fit-content;
        }
        .programs-my-page .join-btn:hover {
          background: var(--primary-dark);
        }
        .programs-my-page .view-details {
          display: block;
          margin-top: 1rem;
          color: var(--primary);
          text-decoration: none;
          font-weight: 500;
        }
        .programs-my-page .btn-sm {
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
        }
        .programs-my-page .btn-danger {
          background: #fee2e2;
          color: #991b1b;
          border: none;
        }
        .programs-my-page .btn-danger:hover {
          background: #fecaca;
        }
      
`}</style>
    </main>
  );
}
