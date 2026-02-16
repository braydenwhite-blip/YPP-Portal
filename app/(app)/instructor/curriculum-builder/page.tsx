import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getInstructorTemplates,
  getInstructorOfferings,
} from "@/lib/class-management-actions";
import Link from "next/link";
import { CurriculumBuilderClient } from "./client";

export default async function CurriculumBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const [templates, offerings] = await Promise.all([
    getInstructorTemplates(session.user.id),
    getInstructorOfferings(session.user.id),
  ]);

  const difficultyLabels: Record<string, string> = {
    LEVEL_101: "101 - Beginner",
    LEVEL_201: "201 - Intermediate",
    LEVEL_301: "301 - Advanced",
    LEVEL_401: "401 - Expert",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor</p>
          <h1 className="page-title">Curriculum Builder</h1>
        </div>
        <Link href="/instructor/curriculum-builder#create" className="button primary">
          + New Curriculum
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {templates.length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Curricula Created</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {templates.filter((t) => t.isPublished).length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Published</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {offerings.length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Active Offerings</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {offerings.reduce((sum, o) => sum + o._count.enrollments, 0)}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Students Enrolled</div>
        </div>
      </div>

      {/* Existing Templates */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-title">Your Curricula</div>
        {templates.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No curricula yet. Create your first curriculum to start building classes!
            </p>
          </div>
        ) : (
          <div className="grid two">
            {templates.map((template) => (
              <div key={template.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>{template.title}</h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                      {template.description.slice(0, 120)}
                      {template.description.length > 120 && "..."}
                    </p>
                  </div>
                  <span
                    className={`pill ${template.isPublished ? "primary" : ""}`}
                    style={!template.isPublished ? { background: "var(--gray-200)" } : {}}
                  >
                    {template.isPublished ? "Published" : "Draft"}
                  </span>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="pill">{template.interestArea}</span>
                  <span className="pill">{difficultyLabels[template.difficultyLevel] || template.difficultyLevel}</span>
                  <span className="pill">{template.durationWeeks} weeks</span>
                  <span className="pill">{template.sessionsPerWeek}x/week</span>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>{template.learningOutcomes.length} outcomes</span>
                  <span>{template._count.offerings} offering{template._count.offerings !== 1 ? "s" : ""}</span>
                  <span>Ideal: {template.idealSize} students</span>
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <Link href={`/instructor/curriculum-builder#edit-${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                    Edit
                  </Link>
                  <Link href={`/lesson-plans?templateId=${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                    Build Lesson Plan
                  </Link>
                  <Link href={`/instructor/class-settings?template=${template.id}`} className="button secondary" style={{ fontSize: 13 }}>
                    Create Offering
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Offerings */}
      {offerings.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">Your Active Offerings</div>
          <div className="grid two">
            {offerings.map((offering) => (
              <Link
                key={offering.id}
                href={`/curriculum/${offering.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <h3>{offering.title}</h3>
                  <span className={`pill ${offering.status === "PUBLISHED" ? "primary" : ""}`}>
                    {offering.status.replace("_", " ")}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                  {new Date(offering.startDate).toLocaleDateString()} - {new Date(offering.endDate).toLocaleDateString()}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="pill">{offering.template.interestArea}</span>
                  <span className="pill">{offering.deliveryMode.replace("_", " ")}</span>
                  <span className="pill">{offering.meetingDays.join(", ")}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  {offering._count.enrollments} / {offering.capacity} enrolled
                  {" | "}
                  {offering._count.sessions} sessions
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Create New Template Form */}
      <div id="create" style={{ marginBottom: 32 }}>
        <div className="section-title">Create New Curriculum</div>
        <CurriculumBuilderClient />
      </div>
    </div>
  );
}
