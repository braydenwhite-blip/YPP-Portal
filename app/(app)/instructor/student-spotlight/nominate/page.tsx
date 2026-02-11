import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NominateStudentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get instructor's students (from courses they teach)
  const courses = await prisma.course.findMany({
    where: { leadInstructorId: session.user.id },
    include: {
      enrollments: {
        where: { status: "ENROLLED" },
        include: { user: true }
      }
    }
  });

  // Flatten to unique students
  const studentMap = new Map();
  courses.forEach(course => {
    course.enrollments.forEach(enrollment => {
      if (!studentMap.has(enrollment.user.id)) {
        studentMap.set(enrollment.user.id, enrollment.user);
      }
    });
  });

  const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Calculate current term
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 4);
  const currentTerm = `${year}-Q${quarter}`;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Nominate Student for Spotlight</h1>
        </div>
      </div>

      <div className="card">
        <h3>Recognize Outstanding Achievement</h3>
        <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
          Nominate a student who has demonstrated exceptional effort, growth, leadership, or achievement.
          Be specific about what makes them stand out.
        </p>

        <form action="/api/student-spotlight/nominate" method="POST">
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="studentId" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Select Student *
            </label>
            <select
              id="studentId"
              name="studentId"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">Choose a student</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="term" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Term *
            </label>
            <input
              type="text"
              id="term"
              name="term"
              required
              defaultValue={currentTerm}
              placeholder="e.g., 2026-Q1"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            />
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              Current term is {currentTerm}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="reason" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Why They Deserve Recognition *
            </label>
            <textarea
              id="reason"
              name="reason"
              required
              rows={10}
              placeholder="Describe what makes this student exceptional. Consider:

- What specific achievements or improvements have they made?
- How have they demonstrated leadership or helped others?
- What challenges have they overcome?
- How have they gone above and beyond expectations?
- What impact have they had on the class or community?

Be specific and provide examples that illustrate why this student deserves recognition."
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
              Submit Nomination
            </button>
            <a href="/instructor/student-spotlight" className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
