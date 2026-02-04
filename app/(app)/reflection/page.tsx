import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActiveReflectionForm, submitReflection, getMyReflections } from "@/lib/reflection-actions";

export default async function ReflectionPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [form, myReflections] = await Promise.all([
    getActiveReflectionForm(),
    getMyReflections(),
  ]);

  // Check if already submitted this month
  const currentMonth = new Date();
  const hasSubmittedThisMonth = myReflections.some((r) => {
    const submissionMonth = new Date(r.month);
    return (
      submissionMonth.getMonth() === currentMonth.getMonth() &&
      submissionMonth.getFullYear() === currentMonth.getFullYear()
    );
  });

  if (!form) {
    return (
      <main className="main-content">
        <h1>Monthly Reflection</h1>
        <div className="card">
          <p>No reflection form is available for your role at this time.</p>
          <p>Please check back later or contact your administrator.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <h1>Monthly Reflection</h1>
      <p className="subtitle">{form.description}</p>

      {hasSubmittedThisMonth ? (
        <div className="card">
          <h2>Already Submitted</h2>
          <p>You have already submitted your reflection for this month.</p>
          <a href="/reflection/history" className="btn btn-secondary">
            View Past Reflections
          </a>
        </div>
      ) : (
        <form action={submitReflection} className="card">
          <input type="hidden" name="formId" value={form.id} />
          <input
            type="hidden"
            name="month"
            value={new Date().toISOString().slice(0, 7)}
          />

          <h2>{form.title}</h2>

          {form.questions.map((question) => (
            <div key={question.id} className="form-group">
              <label>
                {question.question}
                {question.required && <span className="required">*</span>}
              </label>

              {question.type === "TEXT" && (
                <input
                  type="text"
                  name={`question_${question.id}`}
                  required={question.required}
                />
              )}

              {question.type === "TEXTAREA" && (
                <textarea
                  name={`question_${question.id}`}
                  rows={4}
                  required={question.required}
                />
              )}

              {question.type === "RATING_1_5" && (
                <div className="rating-group">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <label key={num} className="rating-option">
                      <input
                        type="radio"
                        name={`question_${question.id}`}
                        value={num}
                        required={question.required}
                      />
                      <span className="rating-label">{num}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === "MULTIPLE_CHOICE" && (
                <div className="choice-group">
                  {question.options.map((option, idx) => (
                    <label key={idx} className="choice-option">
                      <input
                        type="radio"
                        name={`question_${question.id}`}
                        value={option}
                        required={question.required}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Submit Reflection
            </button>
          </div>
        </form>
      )}

      <style jsx>{`
        .subtitle {
          color: var(--muted);
          margin-bottom: 2rem;
        }
        .form-group {
          margin-bottom: 1.5rem;
        }
        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .required {
          color: var(--danger);
          margin-left: 0.25rem;
        }
        input[type="text"],
        textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          font-size: 1rem;
        }
        textarea {
          resize: vertical;
        }
        .rating-group {
          display: flex;
          gap: 1rem;
        }
        .rating-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        }
        .rating-option input {
          margin-bottom: 0.25rem;
        }
        .rating-label {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .rating-option input:checked + .rating-label {
          color: var(--primary);
        }
        .choice-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .choice-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        .form-actions {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </main>
  );
}
