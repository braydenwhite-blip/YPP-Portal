import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterInstructors } from "@/lib/chapter-actions";
import Link from "next/link";

export default async function ChapterInstructorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const instructors = await getChapterInstructors();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Back to Dashboard
          </Link>
          <h1>Chapter Instructors</h1>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{instructors.length}</span>
          <span className="stat-label">Total Instructors</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {
              instructors.filter((i) =>
                i.trainings.every((t) => t.status === "COMPLETE")
              ).length
            }
          </span>
          <span className="stat-label">Training Complete</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {instructors.filter((i) => i.courses.length > 0).length}
          </span>
          <span className="stat-label">Teaching Courses</span>
        </div>
      </div>

      {instructors.length === 0 ? (
        <div className="card">
          <p>No instructors in your chapter yet.</p>
        </div>
      ) : (
        <div className="instructors-grid">
          {instructors.map((instructor) => {
            const completedTrainings = instructor.trainings.filter(
              (t) => t.status === "COMPLETE"
            ).length;
            const totalTrainings = instructor.trainings.length;
            const trainingProgress =
              totalTrainings > 0
                ? Math.round((completedTrainings / totalTrainings) * 100)
                : 0;

            // Get latest goal status
            const latestGoalStatus =
              instructor.goals[0]?.progress[0]?.status || null;

            // Check if has recent reflection
            const hasRecentReflection =
              instructor.reflectionSubmissions.length > 0;
            const lastReflection = instructor.reflectionSubmissions[0];

            return (
              <Link
                key={instructor.id}
                href={`/chapter/instructors/${instructor.id}`}
                className="instructor-card"
              >
                <div className="instructor-header">
                  <div className="avatar">
                    {instructor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="instructor-info">
                    <h3>{instructor.name}</h3>
                    <span className="email">{instructor.email}</span>
                  </div>
                </div>

                <div className="instructor-stats">
                  <div className="stat">
                    <span className="label">Training</span>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${trainingProgress}%` }}
                      />
                    </div>
                    <span className="value">{trainingProgress}%</span>
                  </div>

                  <div className="stat">
                    <span className="label">Courses</span>
                    <span className="value">{instructor.courses.length}</span>
                  </div>

                  <div className="stat">
                    <span className="label">Goals</span>
                    <span className="value">{instructor.goals.length}</span>
                  </div>
                </div>

                {latestGoalStatus && (
                  <div className="goal-status">
                    <span className="label">Latest Progress:</span>
                    <span className={`status status-${latestGoalStatus.toLowerCase().replace(/_/g, "-")}`}>
                      {latestGoalStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                )}

                {hasRecentReflection && (
                  <div className="reflection-status">
                    <span className="label">Last Reflection:</span>
                    <span className="date">
                      {new Date(lastReflection!.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="view-details">View Details →</div>
              </Link>
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
        .instructors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .instructor-card {
          display: block;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1.5rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }
        .instructor-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .instructor-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .avatar {
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
        .instructor-info h3 {
          margin: 0 0 0.25rem 0;
        }
        .email {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .instructor-stats {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .stat {
          text-align: center;
        }
        .stat .label {
          display: block;
          font-size: 0.75rem;
          color: var(--muted);
          margin-bottom: 0.25rem;
        }
        .stat .value {
          font-weight: 600;
        }
        .progress-bar {
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          margin: 0.25rem 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--primary);
          border-radius: 3px;
        }
        .goal-status,
        .reflection-status {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }
        .goal-status .label,
        .reflection-status .label {
          color: var(--muted);
        }
        .status {
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .status-on-track {
          background: #dcfce7;
          color: #166534;
        }
        .status-above-and-beyond {
          background: #dbeafe;
          color: #1e40af;
        }
        .status-getting-started {
          background: #fef9c3;
          color: #854d0e;
        }
        .status-behind-schedule {
          background: #fee2e2;
          color: #991b1b;
        }
        .reflection-status .date {
          font-weight: 500;
        }
        .view-details {
          color: var(--primary);
          font-size: 0.875rem;
          font-weight: 600;
          margin-top: 1rem;
        }
      `}</style>
    </main>
  );
}
