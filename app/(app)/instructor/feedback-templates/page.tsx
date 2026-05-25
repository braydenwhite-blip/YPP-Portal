import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CopyFeedbackTemplateButton } from "@/components/instructor/feedback-template-actions";

export default async function FeedbackTemplatesPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor =
    session.user.roles.includes("INSTRUCTOR") ||
    session.user.roles.includes("ADMIN");

  if (!isInstructor) {
    redirect("/");
  }

  // Get user's templates
  const myTemplates = await prisma.feedbackTemplate.findMany({
    where: { instructorId: session.user.id },
    orderBy: { usageCount: "desc" }
  });

  // Get public templates from other instructors
  const publicTemplates = await prisma.feedbackTemplate.findMany({
    where: {
      isPublic: true,
      instructorId: { not: session.user.id }
    },
    include: { instructor: true },
    orderBy: { usageCount: "desc" },
    take: 10
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Feedback Templates</h1>
        </div>
        <Link href="/instructor/feedback-templates/new" className="button primary">
          Create Template
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Save Time with Reusable Feedback</h3>
        <p>
          Create templates for common feedback comments to speed up grading and ensure consistent,
          quality feedback for students. Templates can be made public to help other instructors.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{myTemplates.length}</div>
          <div className="kpi-label">My Templates</div>
        </div>
        <div className="card">
          <div className="kpi">{myTemplates.reduce((sum, t) => sum + t.usageCount, 0)}</div>
          <div className="kpi-label">Total Uses</div>
        </div>
        <div className="card">
          <div className="kpi">{myTemplates.filter(t => t.isPublic).length}</div>
          <div className="kpi-label">Shared Templates</div>
        </div>
      </div>

      {/* My Templates */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">My Templates</div>
        {myTemplates.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <span className="empty-state-icon" aria-hidden="true">{"💬"}</span>
              <p className="empty-state-title">No feedback templates yet</p>
              <p className="empty-state-text">
                Save your go-to comments as templates to grade faster and give
                students consistent, high-quality feedback.
              </p>
              <Link href="/instructor/feedback-templates/new" className="button primary">
                Create your first template
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myTemplates.map(template => (
              <div key={template.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h3>{template.title}</h3>
                      {template.category && (
                        <span className="pill">{template.category}</span>
                      )}
                      {template.isPublic && (
                        <span className="pill success">Public</span>
                      )}
                    </div>
                    <p style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>{template.content}</p>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Used {template.usageCount} times
                    </div>
                  </div>
                  <div style={{ marginLeft: 16, display: "flex", gap: 8 }}>
                    <CopyFeedbackTemplateButton
                      templateId={template.id}
                      content={template.content}
                      variant="secondary"
                    />
                    <Link
                      href={`/instructor/feedback-templates/${template.id}/edit`}
                      className="button secondary small"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Public Templates */}
      {publicTemplates.length > 0 && (
        <div>
          <div className="section-title">Community Templates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {publicTemplates.map(template => (
              <div key={template.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h4>{template.title}</h4>
                      {template.category && (
                        <span className="pill">{template.category}</span>
                      )}
                    </div>
                    <p style={{ whiteSpace: "pre-wrap", fontSize: 14, marginBottom: 8 }}>
                      {template.content}
                    </p>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      By {template.instructor.name} • Used {template.usageCount} times
                    </div>
                  </div>
                  <div style={{ marginLeft: 16 }}>
                    <CopyFeedbackTemplateButton
                      templateId={template.id}
                      content={template.content}
                      variant="primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
