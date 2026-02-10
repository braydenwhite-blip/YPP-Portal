import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AssignmentDetailPage({
  params
}: {
  params: { id: string; assignmentId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.assignmentId },
    include: {
      course: {
        include: { leadInstructor: true }
      },
      submissions: {
        include: {
          student: true,
          gradedBy: true
        },
        orderBy: { submittedAt: "desc" }
      }
    }
  });

  if (!assignment || assignment.courseId !== params.id) {
    redirect(`/courses/${params.id}/assignments`);
  }

  const isInstructor =
    assignment.course.leadInstructorId === session.user.id || session.user.primaryRole === "ADMIN";

  const userSubmission = assignment.submissions.find(s => s.studentId === session.user.id);

  const isOverdue =
    assignment.dueDate !== null && assignment.dueDate < new Date() && !userSubmission?.submittedAt;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link
              href={`/courses/${params.id}/assignments`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Assignments
            </Link>
          </p>
          <h1 className="page-title">{assignment.title}</h1>
        </div>
      </div>

      <div className="grid two" style={{ gap: 24 }}>
        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Assignment details */}
          <div className="card">
            <h3>Assignment Details</h3>
            <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{assignment.description}</p>

            {assignment.instructions && (
              <div style={{ marginTop: 16, padding: 12, backgroundColor: "var(--accent-bg)", borderRadius: 6 }}>
                <strong>Instructions:</strong>
                <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{assignment.instructions}</p>
              </div>
            )}

            {assignment.attachmentUrl && (
              <div style={{ marginTop: 16 }}>
                <a
                  href={assignment.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                >
                  Download Attachment ↗
                </a>
              </div>
            )}

            <div className="grid three" style={{ marginTop: 20 }}>
              <div>
                <div className="kpi-label">Type</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                  {assignment.type.replace("_", " ")}
                </div>
              </div>
              {assignment.maxPoints && (
                <div>
                  <div className="kpi-label">Points</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{assignment.maxPoints}</div>
                </div>
              )}
              {assignment.dueDate && (
                <div>
                  <div className="kpi-label">Due Date</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: isOverdue ? "var(--error-color)" : "inherit" }}>
                    {new Date(assignment.dueDate).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Student: Submission form */}
          {!isInstructor && (
            <div className="card">
              <h3>Your Submission</h3>

              {userSubmission?.status === "GRADED" ? (
                <div>
                  <div style={{ padding: 16, backgroundColor: "var(--success-bg)", borderRadius: 6, marginTop: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "var(--success-color)" }}>
                      {userSubmission.grade}/{assignment.maxPoints || "?"} points
                    </div>
                    {userSubmission.feedback && (
                      <div style={{ marginTop: 12 }}>
                        <strong>Instructor Feedback:</strong>
                        <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{userSubmission.feedback}</p>
                      </div>
                    )}
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                      Graded on {new Date(userSubmission.gradedAt!).toLocaleString()} by{" "}
                      {userSubmission.gradedBy?.name || "Instructor"}
                    </div>
                  </div>
                  {userSubmission.submissionUrl && (
                    <div style={{ marginTop: 12 }}>
                      <strong>Your submission:</strong> <a href={userSubmission.submissionUrl} target="_blank" rel="noopener noreferrer">View ↗</a>
                    </div>
                  )}
                  {userSubmission.submissionText && (
                    <div style={{ marginTop: 12 }}>
                      <strong>Your submission:</strong>
                      <p style={{ marginTop: 8, whiteSpace: "pre-wrap", padding: 12, backgroundColor: "var(--accent-bg)", borderRadius: 6 }}>
                        {userSubmission.submissionText}
                      </p>
                    </div>
                  )}
                </div>
              ) : userSubmission?.status === "SUBMITTED" ? (
                <div style={{ marginTop: 12, padding: 16, backgroundColor: "var(--accent-bg)", borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, color: "var(--primary-color)" }}>✓ Submitted</div>
                  <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                    Submitted on {new Date(userSubmission.submittedAt!).toLocaleString()}
                  </p>
                  {userSubmission.submissionUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={userSubmission.submissionUrl} target="_blank" rel="noopener noreferrer">View your submission ↗</a>
                    </div>
                  )}
                  {userSubmission.submissionText && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Your submission:</div>
                      <p style={{ whiteSpace: "pre-wrap" }}>{userSubmission.submissionText}</p>
                    </div>
                  )}
                </div>
              ) : (
                <form action="/api/assignments/submit" method="POST" style={{ marginTop: 12 }}>
                  <input type="hidden" name="assignmentId" value={assignment.id} />

                  <div style={{ marginBottom: 16 }}>
                    <label htmlFor="submissionUrl" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                      Submission URL (optional)
                    </label>
                    <input
                      type="url"
                      id="submissionUrl"
                      name="submissionUrl"
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
                      Link to Google Doc, GitHub repo, or other online submission
                    </p>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label htmlFor="submissionText" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                      Text Submission (optional)
                    </label>
                    <textarea
                      id="submissionText"
                      name="submissionText"
                      placeholder="Type your submission here..."
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

                  {isOverdue && assignment.allowLateSubmission && (
                    <div style={{ padding: 12, backgroundColor: "var(--warning-bg)", color: "var(--warning-color)", borderRadius: 6, marginBottom: 16 }}>
                      ⚠️ This assignment is overdue, but late submissions are allowed.
                    </div>
                  )}

                  {isOverdue && !assignment.allowLateSubmission && (
                    <div style={{ padding: 12, backgroundColor: "var(--error-bg)", color: "var(--error-color)", borderRadius: 6, marginBottom: 16 }}>
                      ❌ This assignment is overdue and no longer accepts submissions.
                    </div>
                  )}

                  <button
                    type="submit"
                    className="button primary"
                    disabled={isOverdue && !assignment.allowLateSubmission}
                    style={{ width: "100%" }}
                  >
                    Submit Assignment
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Instructor: All submissions */}
          {isInstructor && (
            <div className="card">
              <h3>Submissions ({assignment.submissions.length})</h3>

              {assignment.submissions.length === 0 ? (
                <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>No submissions yet.</p>
              ) : (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                  {assignment.submissions.map(submission => (
                      <Link
                        key={submission.id}
                      href={`/courses/${params.id}/assignments/${assignment.id}/grade/${submission.id}`}
                        className="card"
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                        border: "1px solid var(--border-color)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{submission.student.name}</div>
                          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                            {submission.submittedAt
                              ? `Submitted ${new Date(submission.submittedAt).toLocaleString()}`
                              : "Not submitted"}
                          </div>
                        </div>
                        <div>
                          {submission.status === "GRADED" ? (
                            <span className="pill success">
                              {submission.grade}/{assignment.maxPoints || "?"} pts
                            </span>
                          ) : submission.status === "SUBMITTED" ? (
                            <span className="pill primary">Needs Grading</span>
                          ) : (
                            <span className="pill">Not Submitted</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div className="card">
            <h3>Assignment Info</h3>
            <div style={{ marginTop: 12, fontSize: 14 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Course:</strong> {assignment.course.title}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Created by:</strong> {assignment.course.leadInstructor?.name || "Unknown"}
              </div>
              {assignment.allowLateSubmission && (
                <div style={{ marginTop: 12, padding: 8, backgroundColor: "var(--accent-bg)", borderRadius: 4, fontSize: 12 }}>
                  ✓ Late submissions allowed
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
