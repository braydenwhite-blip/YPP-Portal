import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { DeleteFeedbackTemplateButton } from "@/components/instructor/feedback-template-actions";

const CATEGORIES = ["Positive", "Constructive", "Technical", "Effort", "Improvement"];

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  fontSize: 14,
} as const;

export default async function EditFeedbackTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const isInstructor = roles.includes("INSTRUCTOR") || roles.includes("ADMIN");
  if (!isInstructor) {
    redirect("/");
  }

  const template = await prisma.feedbackTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    redirect("/instructor/feedback-templates");
  }

  const isOwner = template.instructorId === session.user.id;
  if (!isOwner && !roles.includes("ADMIN")) {
    redirect("/instructor/feedback-templates");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Edit Feedback Template</h1>
          <p className="page-subtitle">
            Update the wording, category, or sharing settings for this
            reusable comment.
          </p>
        </div>
      </div>

      <div className="card">
        <form action="/api/feedback-templates/update" method="POST">
          <input type="hidden" name="templateId" value={template.id} />

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="title" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Template Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              defaultValue={template.title}
              placeholder="e.g., Great effort on debugging"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="category" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Category (Optional)
            </label>
            <select
              id="category"
              name="category"
              defaultValue={template.category ?? ""}
              style={inputStyle}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
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
              defaultValue={template.content}
              placeholder="Write your feedback template here..."
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                defaultChecked={template.isPublic}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14 }}>
                Make this template public (share with other instructors)
              </span>
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="submit" className="button primary">
                Save Changes
              </button>
              <a href="/instructor/feedback-templates" className="button secondary">
                Cancel
              </a>
            </div>
            <DeleteFeedbackTemplateButton templateId={template.id} />
          </div>
        </form>
      </div>
    </div>
  );
}
