import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAllProgramsAdmin,
  createProgram,
  addProgramSession,
} from "@/lib/program-actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminProgramsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    redirect("/");
  }

  const programs = await getAllProgramsAdmin();

  // Get potential leaders (instructors and staff)
  const potentialLeaders = await prisma.user.findMany({
    where: {
      primaryRole: { in: ["INSTRUCTOR", "STAFF", "ADMIN"] },
    },
    select: { id: true, name: true, primaryRole: true },
    orderBy: { name: "asc" },
  });

  const typeColors: Record<string, string> = {
    PASSION_LAB: "#7c3aed",
    COMPETITION_PREP: "#dc2626",
    EXPERIENCE: "#16a34a",
    SEQUENCE: "#2563eb",
  };

  return (
    <main className="main-content admin-programs-page">
      <h1>Manage Special Programs</h1>

      {/* Create Program Form */}
      <section className="card create-section">
        <h2>Create New Program</h2>
        <form action={createProgram}>
          <div className="form-row">
            <div className="form-group">
              <label>Program Name</label>
              <input type="text" name="name" required placeholder="e.g., Math Olympiad Prep" />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select name="type" required>
                <option value="PASSION_LAB">Passion Lab</option>
                <option value="COMPETITION_PREP">Competition Prep</option>
                <option value="EXPERIENCE">Experience</option>
                <option value="SEQUENCE">Sequence</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Interest Area</label>
              <input
                type="text"
                name="interestArea"
                required
                placeholder="e.g., Mathematics"
              />
            </div>
            <div className="form-group">
              <label>Program Leader</label>
              <select name="leaderId">
                <option value="">No leader assigned</option>
                {potentialLeaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name} ({leader.primaryRole})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Describe the program..."
            />
          </div>
          <div className="form-row">
            <label className="checkbox-label">
              <input type="checkbox" name="isVirtual" value="true" defaultChecked />
              Virtual Program
            </label>
            <button type="submit" className="btn btn-primary">
              Create Program
            </button>
          </div>
        </form>
      </section>

      {/* Programs List */}
      <section className="programs-section">
        <h2>All Programs ({programs.length})</h2>
        {programs.length === 0 ? (
          <div className="card">
            <p className="empty">No programs created yet.</p>
          </div>
        ) : (
          <div className="programs-list">
            {programs.map((program) => (
              <div key={program.id} className="card program-card">
                <div className="program-header">
                  <div>
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
                      {!program.isActive && (
                        <span className="inactive-badge">Inactive</span>
                      )}
                    </div>
                    <h3>{program.name}</h3>
                    <p className="interest">{program.interestArea}</p>
                  </div>
                  <div className="stats">
                    <span>{program._count.participants} enrolled</span>
                    <span>{program._count.sessions} sessions</span>
                  </div>
                </div>

                {program.leader && (
                  <p className="leader">Led by: {program.leader.name}</p>
                )}

                {/* Sessions */}
                <div className="sessions-section">
                  <h4>Sessions</h4>
                  {program.sessions.length === 0 ? (
                    <p className="empty-sessions">No sessions scheduled</p>
                  ) : (
                    <div className="sessions-list">
                      {program.sessions.slice(0, 5).map((session) => (
                        <div key={session.id} className="session-item">
                          <span className="session-date">
                            {new Date(session.scheduledAt).toLocaleDateString()}
                          </span>
                          <span className="session-title">{session.title}</span>
                          <span className="session-duration">
                            {session.duration} min
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Session Form */}
                  <details className="add-session">
                    <summary>Add Session</summary>
                    <form
                      action={addProgramSession.bind(null, program.id)}
                      className="session-form"
                    >
                      <div className="form-group">
                        <label>Title</label>
                        <input type="text" name="title" required placeholder="Session title" />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Date & Time</label>
                          <input type="datetime-local" name="scheduledAt" required />
                        </div>
                        <div className="form-group">
                          <label>Duration (minutes)</label>
                          <input
                            type="number"
                            name="duration"
                            defaultValue={60}
                            min={15}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Meeting Link (optional)</label>
                        <input
                          type="url"
                          name="meetingLink"
                          placeholder="https://zoom.us/..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Description (optional)</label>
                        <textarea name="description" rows={2} />
                      </div>
                      <button type="submit" className="btn btn-primary btn-sm">
                        Add Session
                      </button>
                    </form>
                  </details>
                </div>

                <div className="program-actions">
                  <Link href={`/programs/${program.id}`} className="btn btn-sm btn-secondary">
                    View Program
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`

        .admin-programs-page .create-section {
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        .admin-programs-page .create-section h2 {
          margin: 0 0 1rem;
        }
        .admin-programs-page .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          align-items: end;
        }
        .admin-programs-page .form-group {
          margin-bottom: 1rem;
        }
        .admin-programs-page .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        .admin-programs-page input,
        .admin-programs-page textarea,
        .admin-programs-page select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        .admin-programs-page .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        .admin-programs-page .programs-section h2 {
          margin: 0 0 1rem;
        }
        .admin-programs-page .programs-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .admin-programs-page .program-card {
          padding: 1.5rem;
        }
        .admin-programs-page .program-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .admin-programs-page .badges {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .admin-programs-page .type-badge {
          font-size: 0.75rem;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          text-transform: uppercase;
        }
        .admin-programs-page .virtual-badge {
          font-size: 0.75rem;
          background: #dcfce7;
          color: #166534;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
        }
        .admin-programs-page .inactive-badge {
          font-size: 0.75rem;
          background: #fee2e2;
          color: #991b1b;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
        }
        .admin-programs-page .program-card h3 {
          margin: 0;
        }
        .admin-programs-page .interest {
          color: var(--muted);
          font-size: 0.875rem;
          margin: 0.25rem 0 0;
        }
        .admin-programs-page .stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .admin-programs-page .leader {
          font-size: 0.875rem;
          margin: 0 0 1rem;
        }
        .admin-programs-page .sessions-section {
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
          margin-bottom: 1rem;
        }
        .admin-programs-page .sessions-section h4 {
          margin: 0 0 0.75rem;
          font-size: 0.875rem;
        }
        .admin-programs-page .empty-sessions {
          color: var(--muted);
          font-size: 0.875rem;
          font-style: italic;
          margin: 0;
        }
        .admin-programs-page .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .admin-programs-page .session-item {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
          padding: 0.5rem;
          background: white;
          border-radius: 0.25rem;
        }
        .admin-programs-page .session-date {
          color: var(--muted);
          min-width: 100px;
        }
        .admin-programs-page .session-title {
          flex: 1;
          font-weight: 500;
        }
        .admin-programs-page .session-duration {
          color: var(--muted);
        }
        .admin-programs-page .add-session {
          margin-top: 1rem;
        }
        .admin-programs-page .add-session summary {
          cursor: pointer;
          color: var(--primary);
          font-weight: 600;
          font-size: 0.875rem;
        }
        .admin-programs-page .session-form {
          margin-top: 1rem;
          padding: 1rem;
          background: white;
          border-radius: 0.5rem;
        }
        .admin-programs-page .program-actions {
          display: flex;
          gap: 0.5rem;
        }
        .admin-programs-page .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
        .admin-programs-page .empty {
          color: var(--muted);
          font-style: italic;
        }
      
`}</style>
    </main>
  );
}
