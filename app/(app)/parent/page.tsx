import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { submitParentFeedback } from "@/lib/parent-actions";

export default async function ParentPortalPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  const parentLinks = await prisma.parentStudent.findMany({
    where: { parentId: session.user.id },
    include: {
      student: {
        include: {
          enrollments: {
            where: { status: "ENROLLED" },
            include: {
              course: {
                include: {
                  leadInstructor: { select: { name: true, email: true } },
                  chapter: { select: { name: true } }
                }
              }
            }
          },
          chapter: true,
          profile: true,
          goals: {
            include: {
              template: true,
              progress: {
                orderBy: { createdAt: "desc" },
                take: 1
              }
            }
          },
          certificates: {
            include: { template: true },
            orderBy: { issuedAt: "desc" },
            take: 3
          }
        }
      }
    }
  });

  const chapterIds = parentLinks
    .map(p => p.student.chapterId)
    .filter(Boolean) as string[];

  const upcomingEvents = await prisma.event.findMany({
    where: {
      startDate: { gte: new Date() },
      OR: [
        { chapterId: null },
        { chapterId: { in: chapterIds } }
      ],
      isAlumniOnly: false
    },
    include: { chapter: true },
    orderBy: { startDate: "asc" },
    take: 5
  });

  if (parentLinks.length === 0) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Parent Portal</p>
            <h1 className="page-title">Welcome, Parent</h1>
          </div>
        </div>
        <div className="card">
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>
              No students are linked to your account yet. Please contact an administrator
              to link your student&apos;s account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">My Children&apos;s Progress</h1>
        </div>
      </div>

      {parentLinks.map(({ student, relationship }) => (
        <div key={student.id} style={{ marginBottom: 32 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            {student.name} ({relationship})
          </div>

          <div className="grid two">
            <div className="card">
              <h3 style={{ margin: "0 0 12px" }}>Student Info</h3>
              <p style={{ margin: 0 }}>
                <strong>Email:</strong> {student.email}
              </p>
              {student.chapter && (
                <p style={{ margin: "4px 0 0" }}>
                  <strong>Chapter:</strong> {student.chapter.name}
                </p>
              )}
              {student.profile?.school && (
                <p style={{ margin: "4px 0 0" }}>
                  <strong>School:</strong> {student.profile.school}
                </p>
              )}
              {student.profile?.grade && (
                <p style={{ margin: "4px 0 0" }}>
                  <strong>Grade:</strong> {student.profile.grade}
                </p>
              )}
            </div>

            <div className="card">
              <h3 style={{ margin: "0 0 12px" }}>Current Enrollments</h3>
              {student.enrollments.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>Not currently enrolled in any courses.</p>
              ) : (
                <div className="timeline">
                  {student.enrollments.map(enrollment => (
                    <div key={enrollment.id} className="timeline-item">
                      <strong>{enrollment.course.title}</strong>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                        {enrollment.course.format === "LEVELED" && enrollment.course.level
                          ? enrollment.course.level.replace("LEVEL_", "Level ")
                          : enrollment.course.format.replace("_", " ")}
                        {enrollment.course.leadInstructor &&
                          ` · Instructor: ${enrollment.course.leadInstructor.name}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {student.goals.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 12px" }}>Goals Progress</h3>
              <div className="timeline">
                {student.goals.map(goal => (
                  <div key={goal.id} className="timeline-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{goal.template.title}</strong>
                      {goal.progress[0] && (
                        <span
                          className={`pill ${
                            goal.progress[0].status === "ON_TRACK"
                              ? "pill-success"
                              : goal.progress[0].status === "BEHIND_SCHEDULE"
                              ? "pill-pending"
                              : goal.progress[0].status === "ABOVE_AND_BEYOND"
                              ? "pill-pathway"
                              : ""
                          }`}
                        >
                          {goal.progress[0].status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {student.certificates.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 12px" }}>Certificates Earned</h3>
              <div className="timeline">
                {student.certificates.map(cert => (
                  <div key={cert.id} className="timeline-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{cert.title}</strong>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(cert.issuedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      {cert.template.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {student.enrollments.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 12px" }}>Submit Feedback</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
                Help us improve by sharing your feedback about your child&apos;s courses.
              </p>
              <form action={submitParentFeedback} className="form-grid">
                <div className="form-row">
                  <label>Select Course</label>
                  <select name="courseId" className="input" required>
                    <option value="">Choose a course...</option>
                    {student.enrollments.map(e => (
                      <option key={e.course.id} value={e.course.id}>
                        {e.course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Rating</label>
                  <select name="rating" className="input">
                    <option value="">Select rating...</option>
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Below Average</option>
                    <option value="1">1 - Poor</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>Comments *</label>
                  <textarea
                    name="comments"
                    className="input"
                    rows={3}
                    required
                    placeholder="Share your thoughts about the course, instructor, or your child's experience..."
                  />
                </div>
                <button type="submit" className="button">
                  Submit Feedback
                </button>
              </form>
            </div>
          )}
        </div>
      ))}

      {upcomingEvents.length > 0 && (
        <div className="card">
          <div className="section-title">Upcoming Events</div>
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Chapter</th>
              </tr>
            </thead>
            <tbody>
              {upcomingEvents.map(event => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{new Date(event.startDate).toLocaleDateString()}</td>
                  <td>{event.chapter?.name || "All Chapters"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/events" className="link" style={{ display: "block", marginTop: 12, fontSize: 13 }}>
            View all events &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
