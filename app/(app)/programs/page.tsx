import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPrograms } from "@/lib/program-actions";
import Link from "next/link";

export default async function ProgramsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const programs = await getPrograms();

  // Group by type
  const passionLabs = programs.filter((p) => p.type === "PASSION_LAB");
  const competitionPrep = programs.filter((p) => p.type === "COMPETITION_PREP");
  const experiences = programs.filter((p) => p.type === "EXPERIENCE");
  const sequences = programs.filter((p) => p.type === "SEQUENCE");

  const programTypeLabels: Record<string, string> = {
    PASSION_LAB: "Passion Labs",
    COMPETITION_PREP: "Competition Prep",
    EXPERIENCE: "Experiences",
    SEQUENCE: "Sequences",
  };

  const programTypeDescriptions: Record<string, string> = {
    PASSION_LAB: "Deep-dive exploration into specific interests and topics",
    COMPETITION_PREP: "Preparation courses for academic and skill competitions",
    EXPERIENCE: "Special events, workshops, and unique activities",
    SEQUENCE: "Multi-course pathways for comprehensive learning",
  };

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Special Programs</h1>
          <p className="subtitle">
            Explore our special programming offerings beyond regular courses
          </p>
        </div>
        <Link href="/programs/my" className="btn btn-secondary">
          My Programs
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{programs.length}</span>
          <span className="stat-label">Total Programs</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{passionLabs.length}</span>
          <span className="stat-label">Passion Labs</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{competitionPrep.length}</span>
          <span className="stat-label">Competition Prep</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{experiences.length}</span>
          <span className="stat-label">Experiences</span>
        </div>
      </div>

      {/* Passion Labs */}
      {passionLabs.length > 0 && (
        <ProgramSection
          title="Passion Labs"
          description={programTypeDescriptions.PASSION_LAB}
          programs={passionLabs}
          color="#7c3aed"
        />
      )}

      {/* Competition Prep */}
      {competitionPrep.length > 0 && (
        <ProgramSection
          title="Competition Prep"
          description={programTypeDescriptions.COMPETITION_PREP}
          programs={competitionPrep}
          color="#dc2626"
        />
      )}

      {/* Experiences */}
      {experiences.length > 0 && (
        <ProgramSection
          title="Experiences"
          description={programTypeDescriptions.EXPERIENCE}
          programs={experiences}
          color="#16a34a"
        />
      )}

      {/* Sequences */}
      {sequences.length > 0 && (
        <ProgramSection
          title="Sequences"
          description={programTypeDescriptions.SEQUENCE}
          programs={sequences}
          color="#2563eb"
        />
      )}

      {programs.length === 0 && (
        <div className="card empty">
          <p>No special programs available at this time. Check back soon!</p>
        </div>
      )}

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .subtitle {
          color: var(--muted);
          margin: 0.5rem 0 0;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1rem;
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary);
        }
        .stat-label {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .empty {
          text-align: center;
          padding: 3rem;
          color: var(--muted);
        }
      `}</style>
    </main>
  );
}

function ProgramSection({
  title,
  description,
  programs,
  color,
}: {
  title: string;
  description: string;
  programs: any[];
  color: string;
}) {
  return (
    <section className="program-section">
      <div className="section-header">
        <div className="section-icon" style={{ backgroundColor: color }} />
        <div>
          <h2>{title}</h2>
          <p className="section-desc">{description}</p>
        </div>
      </div>

      <div className="programs-grid">
        {programs.map((program) => (
          <Link
            key={program.id}
            href={`/programs/${program.id}`}
            className="program-card"
          >
            <div className="program-header">
              <span className="type-badge" style={{ backgroundColor: color }}>
                {program.type.replace("_", " ")}
              </span>
              {program.isVirtual && (
                <span className="virtual-badge">Virtual</span>
              )}
            </div>
            <h3>{program.name}</h3>
            {program.description && (
              <p className="description">
                {program.description.slice(0, 120)}...
              </p>
            )}
            <div className="program-meta">
              <span className="interest">{program.interestArea}</span>
              {program.leader && (
                <span className="leader">Led by {program.leader.name}</span>
              )}
            </div>
            <div className="program-stats">
              <span>{program._count.participants} enrolled</span>
              <span>{program._count.sessions} sessions</span>
            </div>
            {program.sessions.length > 0 && (
              <div className="next-session">
                Next:{" "}
                {new Date(program.sessions[0].scheduledAt).toLocaleDateString()}
              </div>
            )}
          </Link>
        ))}
      </div>

      <style jsx>{`
        .program-section {
          margin-bottom: 3rem;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .section-icon {
          width: 8px;
          height: 48px;
          border-radius: 4px;
        }
        .section-header h2 {
          margin: 0;
        }
        .section-desc {
          margin: 0.25rem 0 0;
          color: var(--muted);
          font-size: 0.875rem;
        }
        .programs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .program-card {
          display: block;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1.5rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }
        .program-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .program-header {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .type-badge {
          font-size: 0.75rem;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          text-transform: uppercase;
        }
        .virtual-badge {
          font-size: 0.75rem;
          background: #dcfce7;
          color: #166534;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
        }
        .program-card h3 {
          margin: 0 0 0.5rem;
        }
        .description {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0 0 1rem;
        }
        .program-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .interest,
        .leader {
          font-size: 0.75rem;
          background: var(--background);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
        }
        .program-stats {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: var(--muted);
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .next-session {
          margin-top: 0.75rem;
          font-size: 0.875rem;
          color: var(--primary);
          font-weight: 500;
        }
      `}</style>
    </section>
  );
}
