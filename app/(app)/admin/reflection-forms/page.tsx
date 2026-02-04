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

    </main>
  );
}
