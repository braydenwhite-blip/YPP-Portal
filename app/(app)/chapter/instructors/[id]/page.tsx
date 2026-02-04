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
                            showLabel
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

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
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
        .subtitle {
          color: var(--muted);
          margin: 0;
        }
        .instructor-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .instructor-grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .card h2 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
        }
        .empty {
          color: var(--muted);
          font-style: italic;
        }
        .profile-info p {
          margin: 0.5rem 0;
        }
        .bio {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .bio p {
          margin: 0.5rem 0 0;
          color: var(--muted);
        }
        .curriculum-link {
          display: inline-block;
          margin-top: 1rem;
          color: var(--primary);
        }
        .goals-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .goal-item {
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .goal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .goal-header h4 {
          margin: 0;
        }
        .target {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .goal-desc {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0.5rem 0;
        }
        .progress-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .comment {
          font-size: 0.875rem;
          font-style: italic;
          margin: 0.5rem 0;
        }
        .progress-meta {
          font-size: 0.75rem;
          color: var(--muted);
          margin: 0;
        }
        .history {
          margin-top: 1rem;
        }
        .history summary {
          cursor: pointer;
          color: var(--primary);
          font-size: 0.875rem;
        }
        .history-list {
          margin-top: 0.5rem;
        }
        .history-item {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.5rem;
          margin-top: 0.5rem;
          background: white;
          border-radius: 0.25rem;
        }
        .status {
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
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
        .history-comment {
          width: 100%;
          margin: 0;
          font-size: 0.75rem;
          color: var(--muted);
        }
        .reflections-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .reflection-item {
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        .reflection-item summary {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem;
          cursor: pointer;
        }
        .reflection-content {
          padding: 1rem;
          border-top: 1px solid var(--border);
        }
        .response {
          margin-bottom: 1rem;
        }
        .question {
          font-weight: 600;
          font-size: 0.875rem;
          margin: 0 0 0.25rem;
        }
        .answer {
          margin: 0;
          font-size: 0.875rem;
        }
        .rating {
          display: inline-flex;
          gap: 0.125rem;
        }
        .star {
          color: var(--border);
        }
        .star.filled {
          color: #eab308;
        }
        .training-circle {
          text-align: center;
          margin-bottom: 1rem;
        }
        .circle {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: conic-gradient(
            var(--primary) var(--progress),
            var(--border) var(--progress)
          );
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.5rem;
        }
        .percent {
          background: var(--card-bg);
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
        }
        .training-label {
          color: var(--muted);
          font-size: 0.875rem;
          margin: 0;
        }
        .training-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .training-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot.complete {
          background: #22c55e;
        }
        .dot.in-progress {
          background: #eab308;
        }
        .dot.not-started {
          background: var(--border);
        }
        .levels {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .level-badge {
          background: var(--primary);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          font-weight: 600;
        }
        .courses-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .courses-list li {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border);
        }
        .courses-list li:last-child {
          border-bottom: none;
        }
        .course-title {
          font-weight: 500;
        }
        .enrolled {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .mentor-info p {
          margin: 0.25rem 0 0;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .awards-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .awards-list li {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border);
        }
        .awards-list li:last-child {
          border-bottom: none;
        }
        .award-name {
          font-weight: 500;
        }
        .award-date {
          font-size: 0.75rem;
          color: var(--muted);
        }
      `}</style>
    </main>
  );
}
