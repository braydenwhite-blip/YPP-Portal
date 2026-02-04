import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getReflectionForms,
  createReflectionForm,
  addReflectionQuestion,
  createDefaultReflectionForms,
} from "@/lib/reflection-actions";
import { prisma } from "@/lib/prisma";

export default async function ReflectionFormsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    redirect("/");
  }

  const forms = await getReflectionForms();

  return (
    <main className="main-content">
      <div className="page-header">
        <h1>Manage Reflection Forms</h1>
        <div className="header-actions">
          <form action={createDefaultReflectionForms}>
            <button type="submit" className="btn btn-secondary">
              Create Default Forms
            </button>
          </form>
        </div>
      </div>

      <div className="section">
        <h2>Create New Form</h2>
        <form action={createReflectionForm} className="card form-card">
          <div className="form-row">
            <div className="form-group">
              <label>Title</label>
              <input type="text" name="title" required placeholder="Monthly Reflection" />
            </div>
            <div className="form-group">
              <label>Role Type</label>
              <select name="roleType" required>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="CHAPTER_LEAD">Chapter President</option>
                <option value="STUDENT">Student</option>
                <option value="MENTOR">Mentor</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              rows={2}
              placeholder="A brief description of this reflection form"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Create Form
          </button>
        </form>
      </div>

      <div className="section">
        <h2>Existing Forms</h2>
        {forms.length === 0 ? (
          <div className="card">
            <p>No reflection forms created yet. Create one above or use the default forms.</p>
          </div>
        ) : (
          <div className="forms-list">
            {forms.map((form) => (
              <div key={form.id} className="card form-item">
                <div className="form-header">
                  <div>
                    <h3>{form.title}</h3>
                    <p className="form-meta">
                      Role: <strong>{form.roleType}</strong> |{" "}
                      {form._count.submissions} submissions |{" "}
                      {form.isActive ? (
                        <span className="status active">Active</span>
                      ) : (
                        <span className="status inactive">Inactive</span>
                      )}
                    </p>
                  </div>
                </div>

                {form.description && (
                  <p className="description">{form.description}</p>
                )}

                <div className="questions-section">
                  <h4>Questions ({form.questions.length})</h4>
                  <div className="questions-list">
                    {form.questions.map((q, idx) => (
                      <div key={q.id} className="question-item">
                        <span className="q-number">{idx + 1}.</span>
                        <div className="q-content">
                          <p className="q-text">{q.question}</p>
                          <span className="q-type">
                            {q.type.replace("_", " ")}
                            {q.required && " (Required)"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <details className="add-question">
                    <summary>Add Question</summary>
                    <form action={addReflectionQuestion.bind(null, form.id)} className="add-q-form">
                      <div className="form-group">
                        <label>Question Text</label>
                        <input type="text" name="question" required />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Type</label>
                          <select name="type" required>
                            <option value="TEXT">Short Text</option>
                            <option value="TEXTAREA">Long Text</option>
                            <option value="RATING_1_5">Rating (1-5)</option>
                            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>
                            <input type="checkbox" name="required" value="true" defaultChecked />{" "}
                            Required
                          </label>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Options (for multiple choice, comma-separated)</label>
                        <input type="text" name="options" placeholder="Option 1, Option 2, Option 3" />
                      </div>
                      <button type="submit" className="btn btn-primary btn-sm">
                        Add Question
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .section {
          margin-bottom: 2rem;
        }
        .section h2 {
          margin-bottom: 1rem;
        }
        .form-card {
          padding: 1.5rem;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        input[type="text"],
        textarea,
        select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        .forms-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .form-item {
          padding: 1.5rem;
        }
        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        .form-header h3 {
          margin: 0 0 0.5rem 0;
        }
        .form-meta {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .status {
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
        }
        .status.active {
          background: #dcfce7;
          color: #166534;
        }
        .status.inactive {
          background: #fee2e2;
          color: #991b1b;
        }
        .description {
          color: var(--muted);
          margin-bottom: 1rem;
        }
        .questions-section {
          border-top: 1px solid var(--border);
          padding-top: 1rem;
          margin-top: 1rem;
        }
        .questions-section h4 {
          margin: 0 0 1rem 0;
        }
        .questions-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .question-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .q-number {
          font-weight: 600;
          color: var(--muted);
        }
        .q-text {
          margin: 0 0 0.25rem 0;
          font-weight: 500;
        }
        .q-type {
          font-size: 0.75rem;
          color: var(--muted);
          text-transform: uppercase;
        }
        .add-question {
          margin-top: 1rem;
        }
        .add-question summary {
          cursor: pointer;
          color: var(--primary);
          font-weight: 600;
        }
        .add-q-form {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
      `}</style>
    </main>
  );
}
