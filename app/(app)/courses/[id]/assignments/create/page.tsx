import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CreateAssignmentPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: { leadInstructor: true }
  });

  if (!course) {
    redirect("/courses");
  }

  const isInstructor = course.leadInstructorId === session.user.id || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect(`/courses/${params.id}`);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href={`/courses/${params.id}/assignments`} style={{ color: "inherit", textDecoration: "none" }}>
              Assignments
            </Link>
          </p>
          <h1 className="page-title">Create Assignment</h1>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/assignments/create" method="POST">
            <input type="hidden" name="courseId" value={params.id} />

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="title" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Assignment Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="e.g., React Final Project"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="description" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                required
                placeholder="Describe what students need to do..."
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="instructions" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Detailed Instructions (Optional)
              </label>
              <textarea
                id="instructions"
                name="instructions"
                placeholder="Step-by-step instructions..."
                style={{
                  width: "100%",
                  minHeight: 150,
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div className="grid two" style={{ marginBottom: 20 }}>
              <div>
                <label htmlFor="type" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Assignment Type *
                </label>
                <select
                  id="type"
                  name="type"
                  required
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14,
                    backgroundColor: "var(--bg-primary)"
                  }}
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="GROUP">Group</option>
                  <option value="PEER_REVIEW">Peer Review</option>
                </select>
              </div>

              <div>
                <label htmlFor="maxPoints" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Maximum Points
                </label>
                <input
                  type="number"
                  id="maxPoints"
                  name="maxPoints"
                  min="1"
                  placeholder="100"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="dueDate" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Due Date (Optional)
              </label>
              <input
                type="datetime-local"
                id="dueDate"
                name="dueDate"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="attachmentUrl" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Attachment URL (Optional)
              </label>
              <input
                type="url"
                id="attachmentUrl"
                name="attachmentUrl"
                placeholder="https://..."
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Link to rubric, starter code, or other materials
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="allowLateSubmission"
                  value="true"
                  defaultChecked
                  style={{ marginRight: 8, width: 18, height: 18, cursor: "pointer" }}
                />
                <span style={{ fontWeight: 600 }}>Allow late submissions</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="button primary" style={{ flex: 1 }}>
                Create Assignment
              </button>
              <Link href={`/courses/${params.id}/assignments`} className="button secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
