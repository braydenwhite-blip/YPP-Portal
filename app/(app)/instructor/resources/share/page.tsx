import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ShareResourcePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get instructor's courses
  const courses = await prisma.course.findMany({
    where: { leadInstructorId: session.user.id },
    orderBy: { title: "asc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Share Resource</h1>
        </div>
      </div>

      <div className="card">
        <h3>Share a New Resource</h3>
        <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
          Upload or link to a resource and optionally set an expiration date for time-sensitive materials.
        </p>

        <form action="/api/resources/create" method="POST">
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="title" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Resource Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              placeholder="e.g., Week 5 Lecture Slides"
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
            <label htmlFor="description" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Brief description of the resource..."
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

          <div className="grid two" style={{ gap: 16, marginBottom: 20 }}>
            <div>
              <label htmlFor="type" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Resource Type *
              </label>
              <select
                id="type"
                name="type"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              >
                <option value="DOCUMENT">Document</option>
                <option value="VIDEO">Video</option>
                <option value="LINK">Link</option>
                <option value="CODE">Code</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="courseId" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Course (Optional)
              </label>
              <select
                id="courseId"
                name="courseId"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              >
                <option value="">General resource</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="url" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Resource URL *
            </label>
            <input
              type="url"
              id="url"
              name="url"
              required
              placeholder="https://..."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            />
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              Link to Google Drive, Dropbox, YouTube, or any other resource
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="expiresAt" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Expiration Date (Optional)
            </label>
            <input
              type="date"
              id="expiresAt"
              name="expiresAt"
              min={new Date().toISOString().split('T')[0]}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            />
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              Leave blank for permanent resources. Set a date for time-sensitive materials.
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                defaultChecked
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14 }}>
                Make this resource publicly accessible to students
              </span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="button primary">
              Share Resource
            </button>
            <a href="/instructor/resources/shared" className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
