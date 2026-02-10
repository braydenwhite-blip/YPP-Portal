import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NewSubstituteRequestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
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
          <h1 className="page-title">Request Substitute</h1>
        </div>
      </div>

      <div className="card">
        <h3>Request a Substitute Instructor</h3>
        <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
          Submit a request for substitute coverage. An admin will assign a qualified instructor to cover your session.
        </p>

        <form action="/api/substitute-request/create" method="POST">
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="courseId" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Course *
            </label>
            <select
              id="courseId"
              name="courseId"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">Select a course</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid two" style={{ gap: 16, marginBottom: 20 }}>
            <div>
              <label htmlFor="sessionDate" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Session Date *
              </label>
              <input
                type="date"
                id="sessionDate"
                name="sessionDate"
                required
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>

            <div>
              <label htmlFor="sessionTime" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Session Time *
              </label>
              <input
                type="time"
                id="sessionTime"
                name="sessionTime"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="reason" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Reason (Optional)
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={4}
              placeholder="Brief explanation for needing a substitute (optional)"
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

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="button primary">
              Submit Request
            </button>
            <a href="/instructor/substitute-request" className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
