import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewFeedbackTemplatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Create Feedback Template</h1>
        </div>
      </div>

      <div className="card">
        <form action="/api/feedback-templates/create" method="POST">
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="title" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Template Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              placeholder="e.g., Great effort on debugging"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="category" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Category (Optional)
            </label>
            <select
              id="category"
              name="category"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">Select category</option>
              <option value="Positive">Positive</option>
              <option value="Constructive">Constructive</option>
              <option value="Technical">Technical</option>
              <option value="Effort">Effort</option>
              <option value="Improvement">Improvement</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="content" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Template Content
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={8}
              placeholder="Write your feedback template here. You can use this for assignments, code reviews, or any student work..."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical"
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14 }}>
                Make this template public (share with other instructors)
              </span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="button primary">
              Create Template
            </button>
            <a href="/instructor/feedback-templates" className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
