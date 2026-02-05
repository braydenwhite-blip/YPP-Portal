import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getCourseDetail, dropCourse } from "@/lib/student-actions";
import Link from "next/link";

export default async function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { course, enrollment, hasGivenFeedback } = await getCourseDetail(
    params.id
  );

  if (!course) {
    notFound();
  }

  const isEnrolled = enrollment?.status === "ENROLLED";

  return (
    <main className="main-content my-courses-id-page">
      <div className="page-header">
        <div>
          <Link href="/my-courses" className="back-link">
            ← Back to My Courses
          </Link>
          <h1>{course.title}</h1>
          <div className="course-badges">
            <span className="format-badge">{course.format}</span>
            {course.level && (
              <span className="level-badge">
                {course.level.replace("LEVEL_", "")}
              </span>
            )}
            {course.isVirtual && <span className="virtual-badge">Virtual</span>}
          </div>
        </div>
        {isEnrolled && (
          <div className="header-actions">
            <Link
              href={`/my-courses/${course.id}/feedback`}
              className="btn btn-secondary"
            >
              {hasGivenFeedback ? "Update Feedback" : "Give Feedback"}
            </Link>
          </div>
        )}
      </div>

      <div className="course-grid">
        <div className="main-column">
          {/* Description */}
          <section className="card">
            <h2>About This Course</h2>
            <p className="description">{course.description}</p>
            {course.interestArea && (
              <div className="interest-area">
                <strong>Interest Area:</strong> {course.interestArea}
              </div>
            )}
          </section>

          {/* Pathways */}
          {course.pathwaySteps.length > 0 && (
            <section className="card">
              <h2>Part of Pathways</h2>
              <div className="pathways-list">
                {course.pathwaySteps.map((step) => (
                  <div key={step.id} className="pathway-item">
                    <span className="pathway-name">{step.pathway.name}</span>
                    <span className="step-number">Step {step.stepOrder}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Classmates */}
          <section className="card">
            <h2>Classmates ({course.enrollments.length})</h2>
            {course.enrollments.length === 0 ? (
              <p className="empty">No other students enrolled yet.</p>
            ) : (
              <div className="classmates-grid">
                {course.enrollments
                  .filter((e) => e.user.id !== session.user.id)
                  .slice(0, 12)
                  .map((e) => (
                    <div key={e.id} className="classmate">
                      <div className="avatar">
                        {e.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="name">{e.user.name}</span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Previous Feedback */}
          {hasGivenFeedback && course.feedback[0] && (
            <section className="card">
              <h2>Your Feedback</h2>
              <div className="feedback-display">
                <div className="rating">
                  Rating:{" "}
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={
                        n <= (course.feedback[0].rating || 0)
                          ? "star filled"
                          : "star"
                      }
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="comments">{course.feedback[0].comments}</p>
                <span className="feedback-date">
                  Submitted{" "}
                  {new Date(course.feedback[0].createdAt).toLocaleDateString()}
                </span>
              </div>
            </section>
          )}
        </div>

        <div className="side-column">
          {/* Enrollment Status */}
          <section className="card">
            <h2>Enrollment Status</h2>
            {enrollment ? (
              <div className="enrollment-status">
                <span
                  className={`status status-${enrollment.status.toLowerCase()}`}
                >
                  {enrollment.status}
                </span>
                <p className="enrolled-date">
                  Since {new Date(enrollment.createdAt).toLocaleDateString()}
                </p>
                {isEnrolled && (
                  <form action={dropCourse.bind(null, course.id)}>
                    <button
                      type="submit"
                      className="btn btn-danger btn-sm"
                      style={{ marginTop: "1rem" }}
                    >
                      Drop Course
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <p className="not-enrolled">You are not enrolled in this course.</p>
            )}
          </section>

          {/* Instructor */}
          {course.leadInstructor && (
            <section className="card">
              <h2>Instructor</h2>
              <div className="instructor-info">
                <div className="avatar large">
                  {course.leadInstructor.name.charAt(0).toUpperCase()}
                </div>
                <div className="details">
                  <strong>{course.leadInstructor.name}</strong>
                  {isEnrolled && (
                    <>
                      <p className="email">{course.leadInstructor.email}</p>
                      {course.leadInstructor.phone && (
                        <p className="phone">{course.leadInstructor.phone}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Chapter */}
          {course.chapter && (
            <section className="card">
              <h2>Chapter</h2>
              <p className="chapter-name">{course.chapter.name}</p>
              {course.chapter.city && (
                <p className="chapter-location">
                  {course.chapter.city}
                  {course.chapter.region && `, ${course.chapter.region}`}
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      <style>{`

        .my-courses-id-page .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .my-courses-id-page .back-link {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.875rem;
        }
        .my-courses-id-page .back-link:hover {
          color: var(--primary);
        }
        .my-courses-id-page .course-badges {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .my-courses-id-page .format-badge,
        .my-courses-id-page .level-badge,
        .my-courses-id-page .virtual-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          text-transform: uppercase;
        }
        .my-courses-id-page .format-badge {
          background: var(--primary);
          color: white;
        }
        .my-courses-id-page .level-badge {
          background: #dbeafe;
          color: #1e40af;
        }
        .my-courses-id-page .virtual-badge {
          background: #dcfce7;
          color: #166534;
        }
        .my-courses-id-page .course-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .my-courses-id-page .course-grid {
            grid-template-columns: 1fr;
          }
        }
        .my-courses-id-page .card {
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .my-courses-id-page .card h2 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
        }
        .my-courses-id-page .description {
          margin: 0 0 1rem;
          line-height: 1.6;
        }
        .my-courses-id-page .interest-area {
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .my-courses-id-page .pathways-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .my-courses-id-page .pathway-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .my-courses-id-page .pathway-name {
          font-weight: 500;
        }
        .my-courses-id-page .step-number {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .my-courses-id-page .classmates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 1rem;
        }
        .my-courses-id-page .classmate {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .my-courses-id-page .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .my-courses-id-page .avatar.large {
          width: 64px;
          height: 64px;
          font-size: 1.5rem;
        }
        .my-courses-id-page .classmate .name {
          font-size: 0.875rem;
        }
        .my-courses-id-page .empty {
          color: var(--muted);
          font-style: italic;
        }
        .my-courses-id-page .feedback-display {
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .my-courses-id-page .rating {
          margin-bottom: 0.5rem;
        }
        .my-courses-id-page .star {
          color: var(--border);
          font-size: 1.25rem;
        }
        .my-courses-id-page .star.filled {
          color: #eab308;
        }
        .my-courses-id-page .comments {
          margin: 0.5rem 0;
        }
        .my-courses-id-page .feedback-date {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .my-courses-id-page .enrollment-status {
          text-align: center;
        }
        .my-courses-id-page .status {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 1rem;
          font-weight: 600;
        }
        .my-courses-id-page .status-enrolled {
          background: #dcfce7;
          color: #166534;
        }
        .my-courses-id-page .status-completed {
          background: #dbeafe;
          color: #1e40af;
        }
        .my-courses-id-page .status-dropped {
          background: #fee2e2;
          color: #991b1b;
        }
        .my-courses-id-page .enrolled-date {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .my-courses-id-page .not-enrolled {
          color: var(--muted);
        }
        .my-courses-id-page .instructor-info {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        .my-courses-id-page .instructor-info .details {
          flex: 1;
        }
        .my-courses-id-page .instructor-info .email,
        .my-courses-id-page .instructor-info .phone {
          margin: 0.25rem 0 0;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .my-courses-id-page .chapter-name {
          font-weight: 600;
          margin: 0;
        }
        .my-courses-id-page .chapter-location {
          margin: 0.25rem 0 0;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .my-courses-id-page .btn-danger {
          background: #fee2e2;
          color: #991b1b;
          border: none;
        }
        .my-courses-id-page .btn-danger:hover {
          background: #fecaca;
        }
        .my-courses-id-page .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
      
`}</style>
    </main>
  );
}
