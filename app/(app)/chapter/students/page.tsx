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

    </main>
  );
}
