import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterStudents } from "@/lib/chapter-actions";
import Link from "next/link";

export default async function ChapterStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const students = await getChapterStudents();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Back to Dashboard
          </Link>
          <h1>Chapter Students</h1>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{students.length}</span>
          <span className="stat-label">Total Students</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {students.filter((s) => s.enrollments.length > 0).length}
          </span>
          <span className="stat-label">Enrolled in Courses</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {students.reduce((sum, s) => sum + s.enrollments.length, 0)}
          </span>
          <span className="stat-label">Total Enrollments</span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="card">
          <p>No students in your chapter yet.</p>
        </div>
      ) : (
        <div className="students-table-wrapper">
          <table className="students-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Grade</th>
                <th>School</th>
                <th>Courses</th>
                <th>Mentor</th>
                <th>Recent Feedback</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                  </td>
                  <td>{student.email}</td>
                  <td>{student.profile?.grade || "-"}</td>
                  <td>{student.profile?.school || "-"}</td>
                  <td>
                    {student.enrollments.length > 0 ? (
                      <details className="courses-dropdown">
                        <summary>
                          {student.enrollments.length} course
                          {student.enrollments.length > 1 ? "s" : ""}
                        </summary>
                        <ul>
                          {student.enrollments.map((e) => (
                            <li key={e.id}>
                              {e.course.title}
                              <span className="format">
                                {e.course.format}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <span className="none">None</span>
                    )}
                  </td>
                  <td>
                    {student.menteePairs.length > 0
                      ? student.menteePairs[0].mentor.name
                      : "-"}
                  </td>
                  <td>
                    {student.feedbackGiven.length > 0 ? (
                      <span className="feedback-date">
                        {new Date(
                          student.feedbackGiven[0].createdAt
                        ).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="none">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        .students-table-wrapper {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          overflow-x: auto;
        }
        .students-table {
          width: 100%;
          border-collapse: collapse;
        }
        .students-table th,
        .students-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .students-table th {
          background: var(--background);
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .students-table tr:last-child td {
          border-bottom: none;
        }
        .students-table tr:hover {
          background: var(--background);
        }
        .none {
          color: var(--muted);
          font-style: italic;
        }
        .courses-dropdown {
          position: relative;
        }
        .courses-dropdown summary {
          cursor: pointer;
          color: var(--primary);
        }
        .courses-dropdown ul {
          position: absolute;
          z-index: 10;
          background: white;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.5rem;
          margin: 0.5rem 0 0;
          list-style: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          min-width: 200px;
        }
        .courses-dropdown li {
          padding: 0.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
        }
        .courses-dropdown li:last-child {
          border-bottom: none;
        }
        .format {
          font-size: 0.75rem;
          color: var(--muted);
          background: var(--background);
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
        }
        .feedback-date {
          font-size: 0.875rem;
          color: var(--muted);
        }
      `}</style>
    </main>
  );
}
