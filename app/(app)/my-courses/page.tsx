import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyCourses } from "@/lib/student-actions";
import Link from "next/link";

export default async function MyCoursesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { current, completed, dropped } = await getMyCourses();

  return (
    <main className="main-content my-courses-page">
      <div className="page-header">
        <h1>My Courses</h1>
        <Link href="/curriculum" className="btn btn-secondary">
          Browse Courses
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{current.length}</span>
          <span className="stat-label">Currently Enrolled</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completed.length}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{current.length + completed.length}</span>
          <span className="stat-label">Total Courses</span>
        </div>
      </div>

      {/* Current Courses */}
      <section className="courses-section">
        <h2>Currently Enrolled ({current.length})</h2>
        {current.length === 0 ? (
          <div className="card">
            <p className="empty">You're not enrolled in any courses yet.</p>
            <Link href="/curriculum" className="btn btn-primary">
              Browse Available Courses
            </Link>
          </div>
        ) : (
          <div className="courses-grid">
            {current.map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/my-courses/${enrollment.course.id}`}
                className="course-card"
              >
                <div className="course-format">{enrollment.course.format}</div>
                <h3>{enrollment.course.title}</h3>
                <p className="course-description">
                  {enrollment.course.description.slice(0, 100)}...
                </p>
                <div className="course-meta">
                  {enrollment.course.leadInstructor && (
                    <span className="instructor">
                      {enrollment.course.leadInstructor.name}
                    </span>
                  )}
                  {enrollment.course.chapter && (
                    <span className="chapter">
                      {enrollment.course.chapter.name}
                    </span>
                  )}
                </div>
                <div className="course-footer">
                  <span className="enrolled-count">
                    {enrollment.course._count.enrollments} students
                  </span>
                  <span className="enrolled-date">
                    Enrolled{" "}
                    {new Date(enrollment.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Completed Courses */}
      {completed.length > 0 && (
        <section className="courses-section">
          <h2>Completed ({completed.length})</h2>
          <div className="courses-grid">
            {completed.map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/my-courses/${enrollment.course.id}`}
                className="course-card completed"
              >
                <div className="completed-badge">✓ Completed</div>
                <h3>{enrollment.course.title}</h3>
                <div className="course-meta">
                  {enrollment.course.leadInstructor && (
                    <span className="instructor">
                      {enrollment.course.leadInstructor.name}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Dropped Courses */}
      {dropped.length > 0 && (
        <section className="courses-section">
          <h2>Dropped ({dropped.length})</h2>
          <div className="dropped-list">
            {dropped.map((enrollment) => (
              <div key={enrollment.id} className="dropped-item">
                <span>{enrollment.course.title}</span>
                <span className="dropped-date">
                  Dropped {new Date(enrollment.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`

        .my-courses-page .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .my-courses-page .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .my-courses-page .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1rem;
          text-align: center;
        }
        .my-courses-page .stat-value {
          display: block;
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary);
        }
        .my-courses-page .stat-label {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .my-courses-page .courses-section {
          margin-bottom: 2rem;
        }
        .my-courses-page .courses-section h2 {
          margin: 0 0 1rem 0;
        }
        .my-courses-page .courses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .my-courses-page .course-card {
          display: block;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1.5rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }
        .my-courses-page .course-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .my-courses-page .course-card.completed {
          border-color: #22c55e;
        }
        .my-courses-page .course-format {
          display: inline-block;
          font-size: 0.75rem;
          text-transform: uppercase;
          background: var(--background);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          margin-bottom: 0.5rem;
        }
        .my-courses-page .completed-badge {
          display: inline-block;
          font-size: 0.75rem;
          background: #dcfce7;
          color: #166534;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          margin-bottom: 0.5rem;
        }
        .my-courses-page .course-card h3 {
          margin: 0 0 0.5rem 0;
        }
        .my-courses-page .course-description {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0 0 1rem 0;
        }
        .my-courses-page .course-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .my-courses-page .instructor,
        .my-courses-page .chapter {
          font-size: 0.75rem;
          background: var(--background);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
        }
        .my-courses-page .course-footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--muted);
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .my-courses-page .empty {
          color: var(--muted);
          margin-bottom: 1rem;
        }
        .my-courses-page .dropped-list {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        .my-courses-page .dropped-item {
          display: flex;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          color: var(--muted);
        }
        .my-courses-page .dropped-item:last-child {
          border-bottom: none;
        }
        .my-courses-page .dropped-date {
          font-size: 0.875rem;
        }
      
`}</style>
    </main>
  );
}
