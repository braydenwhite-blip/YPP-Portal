import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CoInstructorsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      leadInstructor: true,
      coInstructors: {
        include: { instructor: true }
      }
    }
  });

  if (!course) {
    redirect("/courses");
  }

  const isLead = course.leadInstructorId === session.user.id || session.user.primaryRole === "ADMIN";

  if (!isLead) {
    redirect(`/courses/${params.id}`);
  }

  // Get potential co-instructors (other instructors)
  const potentialCoInstructors = await prisma.user.findMany({
    where: {
      primaryRole: "INSTRUCTOR",
      id: {
        not: session.user.id,
        notIn: course.coInstructors.map(ci => ci.instructorId)
      }
    },
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href={`/courses/${params.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {course.title}
            </Link>
          </p>
          <h1 className="page-title">Co-Instructors</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Team Teaching</h3>
        <p>
          Add co-instructors to collaborate on this course. Co-instructors have access to lesson plans,
          attendance, and can help manage the course.
        </p>
      </div>

      {/* Current co-instructors */}
      {course.coInstructors.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Current Co-Instructors</div>
          <div className="grid two">
            {course.coInstructors.map(coInstructor => (
              <div key={coInstructor.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3>{coInstructor.instructor.name}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      {coInstructor.instructor.email}
                    </div>
                  </div>
                  <span className="pill">{coInstructor.role.replace("_", " ")}</span>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                  Added {new Date(coInstructor.addedAt).toLocaleDateString()}
                </div>
                <form action="/api/courses/remove-co-instructor" method="POST" style={{ marginTop: 12 }}>
                  <input type="hidden" name="coInstructorId" value={coInstructor.id} />
                  <button
                    type="submit"
                    className="button"
                    style={{
                      width: "100%",
                      backgroundColor: "var(--error-bg)",
                      color: "var(--error-color)"
                    }}
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add co-instructor */}
      <div>
        <div className="section-title">Add Co-Instructor</div>
        {potentialCoInstructors.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No available instructors to add as co-instructors.
            </p>
          </div>
        ) : (
          <div className="card">
            <form action="/api/courses/add-co-instructor" method="POST">
              <input type="hidden" name="courseId" value={params.id} />

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="instructorId" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Select Instructor *
                </label>
                <select
                  id="instructorId"
                  name="instructorId"
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
                  <option value="">Choose an instructor...</option>
                  {potentialCoInstructors.map(instructor => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name} ({instructor.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="role" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Role *
                </label>
                <select
                  id="role"
                  name="role"
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
                  <option value="CO_INSTRUCTOR">Co-Instructor</option>
                  <option value="ASSISTANT">Assistant</option>
                </select>
              </div>

              <button type="submit" className="button primary" style={{ width: "100%" }}>
                Add Co-Instructor
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
