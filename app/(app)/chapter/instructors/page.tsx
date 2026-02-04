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

    </main>
  );
}
