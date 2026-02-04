import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getInstructorDetail } from "@/lib/chapter-actions";
import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";

export default async function InstructorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const instructor = await getInstructorDetail(params.id);

  if (!instructor) {
    notFound();
  }

  // Calculate training progress
  const completedTrainings = instructor.trainings.filter(
    (t) => t.status === "COMPLETE"
  ).length;
  const totalTrainings = instructor.trainings.length;
  const trainingPercent =
    totalTrainings > 0
      ? Math.round((completedTrainings / totalTrainings) * 100)
      : 0;

  // Get approved levels
  const approvedLevels = instructor.approvals[0]?.levels || [];

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter/instructors" className="back-link">
            ← Back to Instructors
          </Link>
          <h1>{instructor.name}</h1>
          <p className="subtitle">
            {instructor.primaryRole} |{" "}
            {instructor.chapter?.name || "No Chapter"}
          </p>
        </div>
        <Link
          href={`/mentorship/feedback/${instructor.id}`}
          className="btn btn-primary"
        >
          Submit Feedback
        </Link>
      </div>

      <div className="instructor-grid">
        <div className="main-column">
          {/* Profile Card */}
          <section className="card">
            <h2>Profile Information</h2>
            <div className="profile-info">
              <p>
                <strong>Email:</strong> {instructor.email}
              </p>
              {instructor.phone && (
                <p>
                  <strong>Phone:</strong> {instructor.phone}
                </p>
              )}
              {instructor.profile?.school && (
                <p>
                  <strong>School:</strong> {instructor.profile.school}
                </p>
              )}
              {instructor.profile?.grade && (
                <p>
                  <strong>Grade:</strong> {instructor.profile.grade}
                </p>
              )}
            </div>
            {instructor.profile?.bio && (
              <div className="bio">
                <strong>Bio:</strong>
                <p>{instructor.profile.bio}</p>
              </div>
            )}
            {instructor.profile?.curriculumUrl && (
              <a
                href={instructor.profile.curriculumUrl}
                target="_blank"
                className="curriculum-link"
              >
                View Curriculum →
              </a>
            )}
          </section>

          {/* Goals & Progress */}
          <section className="card">
            <h2>Goals & Progress</h2>
            {instructor.goals.length === 0 ? (
              <p className="empty">No goals assigned</p>
            ) : (
              <div className="goals-list">
                {instructor.goals.map((goal) => {
                  const latestProgress = goal.progress[0];
                  return (
                    <div key={goal.id} className="goal-item">
                      <div className="goal-header">
                        <h4>{goal.template.title}</h4>
                        {goal.targetDate && (
                          <span className="target">
                            Due:{" "}
                            {new Date(goal.targetDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {goal.template.description && (
                        <p className="goal-desc">{goal.template.description}</p>
                      )}
                      {latestProgress && (
                        <div className="progress-section">
                          <ProgressBar
                            status={latestProgress.status}
                            showLabels
                          />
                          {latestProgress.comments && (
                            <p className="comment">{latestProgress.comments}</p>
                          )}
                          <p className="progress-meta">
                            Updated{" "}
                            {new Date(
                              latestProgress.createdAt
                            ).toLocaleDateString()}{" "}
                            by {latestProgress.submittedBy.name}
                          </p>
                        </div>
                      )}

                      {/* Progress History */}
                      {goal.progress.length > 1 && (
                        <details className="history">
                          <summary>
                            View History ({goal.progress.length} updates)
                          </summary>
                          <div className="history-list">
                            {goal.progress.slice(1).map((update) => (
                              <div key={update.id} className="history-item">
                                <span
                                  className={`status status-${update.status.toLowerCase().replace(/_/g, "-")}`}
                                >
                                  {update.status.replace(/_/g, " ")}
                                </span>
                                <span className="date">
                                  {new Date(
                                    update.createdAt
                                  ).toLocaleDateString()}
                                </span>
                                {update.comments && (
                                  <p className="history-comment">
                                    {update.comments}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Reflections */}
          <section className="card">
            <h2>Reflections</h2>
            {instructor.reflectionSubmissions.length === 0 ? (
              <p className="empty">No reflections submitted</p>
            ) : (
              <div className="reflections-list">
                {instructor.reflectionSubmissions.map((reflection) => (
                  <details key={reflection.id} className="reflection-item">
                    <summary>
                      <span>{reflection.form.title}</span>
                      <span className="date">
                        {new Date(reflection.month).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </summary>
                    <div className="reflection-content">
                      {reflection.responses.map((resp) => (
                        <div key={resp.id} className="response">
                          <p className="question">{resp.question.question}</p>
                          <p className="answer">
                            {resp.question.type === "RATING_1_5" ? (
                              <span className="rating">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <span
                                    key={n}
                                    className={
                                      n <= parseInt(resp.value)
                                        ? "star filled"
                                        : "star"
                                    }
                                  >
                                    ★
                                  </span>
                                ))}
                                ({resp.value}/5)
                              </span>
                            ) : (
                              resp.value
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="side-column">
          {/* Training Progress */}
          <section className="card">
            <h2>Training Progress</h2>
            <div className="training-circle">
              <div
                className="circle"
                style={
                  { "--progress": `${trainingPercent}%` } as React.CSSProperties
                }
              >
                <span className="percent">{trainingPercent}%</span>
              </div>
              <p className="training-label">
                {completedTrainings} of {totalTrainings} modules
              </p>
            </div>
            <div className="training-list">
              {instructor.trainings.map((t) => (
                <div key={t.id} className="training-item">
                  <span
                    className={`dot ${t.status.toLowerCase().replace("_", "-")}`}
                  />
                  <span className="title">{t.module.title}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Approved Levels */}
          {approvedLevels.length > 0 && (
            <section className="card">
              <h2>Approved Levels</h2>
              <div className="levels">
                {approvedLevels.map((level) => (
                  <span key={level.id} className="level-badge">
                    {level.level.replace("LEVEL_", "")}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Courses */}
          <section className="card">
            <h2>Courses ({instructor.courses.length})</h2>
            {instructor.courses.length === 0 ? (
              <p className="empty">No courses yet</p>
            ) : (
              <ul className="courses-list">
                {instructor.courses.map((c) => (
                  <li key={c.id}>
                    <span className="course-title">{c.title}</span>
                    <span className="enrolled">
                      {c.enrollments.length} enrolled
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Mentor */}
          {instructor.menteePairs.length > 0 && (
            <section className="card">
              <h2>Assigned Mentor</h2>
              {instructor.menteePairs.map((m) => (
                <div key={m.id} className="mentor-info">
                  <strong>{m.mentor.name}</strong>
                  <p>{m.mentor.email}</p>
                </div>
              ))}
            </section>
          )}

          {/* Awards */}
          {instructor.awards.length > 0 && (
            <section className="card">
              <h2>Awards</h2>
              <ul className="awards-list">
                {instructor.awards.map((a) => (
                  <li key={a.id}>
                    <span className="award-name">{a.name}</span>
                    <span className="award-date">
                      {new Date(a.awardedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

    </main>
  );
}
