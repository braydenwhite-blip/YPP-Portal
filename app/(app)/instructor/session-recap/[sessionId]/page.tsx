import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function SessionRecapPage({ params }: { params: { sessionId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const attendanceSession = await prisma.attendanceSession.findUnique({
    where: { id: params.sessionId },
    include: {
      course: true,
      sessionRecap: true
    }
  });

  if (!attendanceSession) {
    redirect("/courses");
  }

  if (!attendanceSession.course || !attendanceSession.courseId) {
    redirect("/courses");
  }

  const isInstructor =
    attendanceSession.course.leadInstructorId === session.user.id ||
    session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect(`/courses/${attendanceSession.courseId}`);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <a href={`/courses/${attendanceSession.courseId}`} style={{ color: "inherit", textDecoration: "none" }}>
              {attendanceSession.course.title}
            </a>
          </p>
          <h1 className="page-title">Session Recap</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>{attendanceSession.title}</h3>
        <p style={{ color: "var(--text-secondary)" }}>
          {new Date(attendanceSession.date).toLocaleDateString()}
        </p>
      </div>

      <div className="card">
        <h3>{attendanceSession.sessionRecap ? "Edit Session Recap" : "Create Session Recap"}</h3>
        <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>
          Document what was covered, what worked well, and areas for improvement.
          This helps with planning future sessions and tracking progress.
        </p>

        <form action="/api/session-recap/save" method="POST">
          <input type="hidden" name="sessionId" value={params.sessionId} />

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="whatCovered" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              What We Covered *
            </label>
            <textarea
              id="whatCovered"
              name="whatCovered"
              required
              rows={6}
              defaultValue={attendanceSession.sessionRecap?.whatCovered || ""}
              placeholder="Summarize the main topics, activities, and learning objectives covered in this session..."
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

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="whatWorked" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              What Worked Well
            </label>
            <textarea
              id="whatWorked"
              name="whatWorked"
              rows={4}
              defaultValue={attendanceSession.sessionRecap?.whatWorked || ""}
              placeholder="Note successful teaching strategies, student engagement moments, or effective activities..."
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

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="whatToImprove" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Areas for Improvement
            </label>
            <textarea
              id="whatToImprove"
              name="whatToImprove"
              rows={4}
              defaultValue={attendanceSession.sessionRecap?.whatToImprove || ""}
              placeholder="Identify challenges, pacing issues, or topics that need more attention..."
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
            <label htmlFor="nextSteps" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Next Steps
            </label>
            <textarea
              id="nextSteps"
              name="nextSteps"
              rows={4}
              defaultValue={attendanceSession.sessionRecap?.nextSteps || ""}
              placeholder="Plan for the next session, follow-up items, or student needs to address..."
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
              {attendanceSession.sessionRecap ? "Update Recap" : "Save Recap"}
            </button>
            <a href={`/courses/${attendanceSession.courseId}`} className="button secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
