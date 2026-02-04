import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getCourseDetail, submitCourseFeedback } from "@/lib/student-actions";
import Link from "next/link";

export default async function CourseFeedbackPage({
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

  if (!enrollment || enrollment.status !== "ENROLLED") {
    redirect(`/my-courses/${params.id}`);
  }

  const existingFeedback = course.feedback[0];

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href={`/my-courses/${course.id}`} className="back-link">
            ← Back to Course
          </Link>
          <h1>Feedback for {course.title}</h1>
          <p className="subtitle">
            Help us improve by sharing your experience with this course
          </p>
        </div>
      </div>

      <form action={submitCourseFeedback} className="card feedback-form">
        <input type="hidden" name="courseId" value={course.id} />

        <div className="form-section">
          <h2>Rate This Course</h2>
          <p className="section-desc">
            How would you rate your overall experience?
          </p>
          <div className="rating-input">
            {[1, 2, 3, 4, 5].map((num) => (
              <label key={num} className="rating-option">
                <input
                  type="radio"
                  name="rating"
                  value={num}
                  required
                  defaultChecked={existingFeedback?.rating === num}
                />
                <span className="rating-star">★</span>
                <span className="rating-label">
                  {num === 1 && "Poor"}
                  {num === 2 && "Fair"}
                  {num === 3 && "Good"}
                  {num === 4 && "Very Good"}
                  {num === 5 && "Excellent"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2>Your Comments</h2>
          <p className="section-desc">
            Please share what you liked, what could be improved, and any other
            thoughts about the course.
          </p>
          <textarea
            name="comments"
            rows={6}
            required
            placeholder="Share your thoughts about the course content, instructor, materials, and overall experience..."
            defaultValue={existingFeedback?.comments || ""}
          />
        </div>

        <div className="form-section">
          <h3>Instructor Feedback</h3>
          <p className="section-desc">
            Your feedback about <strong>{course.leadInstructor?.name}</strong>{" "}
            will help them improve their teaching.
          </p>

          <div className="feedback-prompts">
            <div className="prompt">
              <span className="icon">👍</span>
              <span>What did the instructor do well?</span>
            </div>
            <div className="prompt">
              <span className="icon">💡</span>
              <span>Any suggestions for improvement?</span>
            </div>
            <div className="prompt">
              <span className="icon">📚</span>
              <span>Was the material presented clearly?</span>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <Link href={`/my-courses/${course.id}`} className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary">
            {hasGivenFeedback ? "Update Feedback" : "Submit Feedback"}
          </button>
        </div>
      </form>

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
        .subtitle {
          color: var(--muted);
          margin: 0.5rem 0 0;
        }
        .feedback-form {
          max-width: 700px;
          padding: 2rem;
        }
        .form-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid var(--border);
        }
        .form-section:last-of-type {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .form-section h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
        }
        .form-section h3 {
          margin: 0 0 0.5rem 0;
        }
        .section-desc {
          color: var(--muted);
          margin: 0 0 1rem;
          font-size: 0.875rem;
        }
        .rating-input {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .rating-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          padding: 1rem;
          border: 2px solid var(--border);
          border-radius: 0.5rem;
          transition: all 0.2s;
          min-width: 90px;
        }
        .rating-option:hover {
          border-color: var(--primary);
        }
        .rating-option input {
          display: none;
        }
        .rating-option input:checked + .rating-star {
          color: #eab308;
          transform: scale(1.2);
        }
        .rating-option input:checked ~ .rating-label {
          color: var(--primary);
          font-weight: 600;
        }
        .rating-star {
          font-size: 2rem;
          color: var(--border);
          transition: all 0.2s;
        }
        .rating-label {
          font-size: 0.75rem;
          margin-top: 0.5rem;
          color: var(--muted);
        }
        textarea {
          width: 100%;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          font-size: 1rem;
          resize: vertical;
          font-family: inherit;
        }
        textarea:focus {
          outline: none;
          border-color: var(--primary);
        }
        .feedback-prompts {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .prompt {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }
        .prompt .icon {
          font-size: 1.25rem;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </main>
  );
}
