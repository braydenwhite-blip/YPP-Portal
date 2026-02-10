import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function LessonPlanTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get all template lesson plans
  const templates = await prisma.lessonPlan.findMany({
    where: { isTemplate: true },
    include: {
      author: true,
      activities: {
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Lesson Plan Templates</h1>
        </div>
        <Link href="/instructor/lesson-plans" className="button secondary">
          My Lesson Plans
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Community Templates</h3>
        <p>
          Browse and clone lesson plans shared by other instructors. Save time and learn from best practices
          across the YPP community.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="card">
          <h3>No Templates Yet</h3>
          <p>
            Be the first to share a lesson plan template! Create a lesson plan and mark it as a template
            to share with other instructors.
          </p>
        </div>
      ) : (
        <div className="grid two">
          {templates.map(template => (
            <div key={template.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <h3>{template.title}</h3>
                  {template.description && (
                    <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
                      {template.description}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <span className="pill">{template.totalMinutes} min</span>
                <span className="pill">{template.activities.length} activities</span>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                By {template.author.name}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Link
                  href={`/instructor/lesson-plans/${template.id}`}
                  className="button secondary"
                  style={{ flex: 1 }}
                >
                  View
                </Link>
                <form action="/api/lesson-plans/clone" method="POST" style={{ flex: 1 }}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <button type="submit" className="button primary" style={{ width: "100%" }}>
                    Clone
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
