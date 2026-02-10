import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAssignmentDetail } from "@/lib/assignment-actions";
import Link from "next/link";
import { SubmissionClient } from "./submission-client";

const typeLabels: Record<string, string> = {
  PRACTICE: "Practice Exercise",
  PROJECT: "Creative Project",
  EXPLORATION: "Open Exploration",
  GROUP: "Group Collaboration",
  REFLECTION: "Reflection",
};

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: offeringId, assignmentId } = await params;
  const assignment = await getAssignmentDetail(assignmentId);

  if (!assignment || assignment.offeringId !== offeringId) {
    return (
      <div>
        <div className="card">
          <h3>Assignment Not Found</h3>
          <Link href={`/classes/${offeringId}/assignments`} className="button primary" style={{ marginTop: 12 }}>
            Back to Assignments
          </Link>
        </div>
      </div>
    );
  }

  const roles = session.user.roles ?? [];
  const isInstructor = assignment.offering.instructorId === session.user.id || roles.includes("ADMIN");
  const mySubmission = assignment.submissions.find((s) => s.student.id === session.user.id);
  const myGroup = assignment.groups.find((g) => g.members.some((m) => m.user.id === session.user.id));

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/classes/${offeringId}/assignments`} style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Assignments
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{assignment.title}</h1>
        </div>
        {isInstructor && (
          <Link href={`/classes/${offeringId}/assignments/${assignmentId}/feedback`} className="button primary">
            Give Feedback
          </Link>
        )}
      </div>

      {/* Assignment Info */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span className="pill primary">{typeLabels[assignment.type] || assignment.type}</span>
          <span className="pill">
            {assignment.gradingStyle === "COMPLETION" ? "Completion Only"
              : assignment.gradingStyle === "FEEDBACK_ONLY" ? "Feedback Only"
              : "Optional Grade"}
          </span>
          <span className="pill">
            {assignment.feedbackStyle === "NARRATIVE" ? "Written Feedback"
              : assignment.feedbackStyle === "CHECKLIST" ? "Checklist"
              : assignment.feedbackStyle === "VIDEO" ? "Video Feedback"
              : "Peer Review"}
          </span>
        </div>

        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>{assignment.description}</p>

        {/* Dates */}
        <div style={{ marginTop: 16, display: "flex", gap: 24, fontSize: 14, color: "var(--text-secondary)" }}>
          {assignment.suggestedDueDate && (
            <div>
              <strong>Aim to finish:</strong>{" "}
              {new Date(assignment.suggestedDueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          )}
          {assignment.hardDeadline && (
            <div>
              <strong>Deadline:</strong>{" "}
              {new Date(assignment.hardDeadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          )}
          <div>Late submissions: {assignment.allowLateSubmissions ? "Always welcome!" : "Check with instructor"}</div>
        </div>

        {/* Encouragement */}
        {assignment.encouragementNote && (
          <div style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "var(--ypp-purple-50)",
            borderRadius: "var(--radius-md)",
            borderLeft: "4px solid var(--ypp-purple)",
            fontSize: 14,
            color: "var(--ypp-purple-800)",
            fontStyle: "italic",
          }}>
            {assignment.encouragementNote}
          </div>
        )}
      </div>

      {/* Instructions */}
      {assignment.instructions && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Instructions</h3>
          <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--text-secondary)" }}>
            {assignment.instructions}
          </div>
        </div>
      )}

      {/* Reference Links & Examples */}
      {(assignment.referenceLinks.length > 0 || assignment.exampleWorkUrls.length > 0) && (
        <div className="card" style={{ marginBottom: 24 }}>
          {assignment.referenceLinks.length > 0 && (
            <div>
              <h4>Helpful Resources</h4>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {assignment.referenceLinks.map((link, i) => (
                  <li key={i}>
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ypp-purple)" }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {assignment.exampleWorkUrls.length > 0 && (
            <div style={{ marginTop: assignment.referenceLinks.length > 0 ? 16 : 0 }}>
              <h4>Example Work</h4>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {assignment.exampleWorkUrls.map((link, i) => (
                  <li key={i}>
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ypp-purple)" }}>
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Group Projects */}
      {assignment.isGroupAssignment && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Groups</h3>
            {!myGroup && (
              <Link
                href={`/classes/${offeringId}/assignments/${assignmentId}/groups`}
                className="button primary"
                style={{ fontSize: 13 }}
              >
                {assignment.allowSelfSelect ? "Form or Join a Group" : "View Groups"}
              </Link>
            )}
          </div>

          {assignment.groups.length === 0 ? (
            <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>
              No groups formed yet. {assignment.allowSelfSelect ? "Be the first to create one!" : "Your instructor will assign groups."}
            </p>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {assignment.groups.map((group) => {
                const isMember = group.members.some((m) => m.user.id === session.user.id);
                return (
                  <Link
                    key={group.id}
                    href={`/classes/${offeringId}/assignments/${assignmentId}/groups?group=${group.id}`}
                    className="card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      padding: "12px 16px",
                      ...(isMember ? { borderColor: "var(--ypp-purple)", borderWidth: 2 } : {}),
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{group.groupName}</strong>
                      {isMember && (
                        <span className="pill primary" style={{ fontSize: 11 }}>Your Group</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {group.members.map((m) => m.user.name).join(", ")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      {group.milestones.length} milestone{group.milestones.length !== 1 ? "s" : ""}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Instructor: View All Submissions */}
      {isInstructor && assignment.submissions.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Submissions ({assignment.submissions.length})</h3>
          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Enjoyment</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {assignment.submissions.map((sub) => (
                <tr key={sub.id}>
                  <td style={{ fontWeight: 500 }}>{sub.student.name}</td>
                  <td>
                    <span className="pill" style={{ fontSize: 11 }}>
                      {sub.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"}
                  </td>
                  <td>
                    {sub.enjoymentRating ? `${"★".repeat(sub.enjoymentRating)}${"☆".repeat(5 - sub.enjoymentRating)}` : "—"}
                  </td>
                  <td>
                    {sub.feedbackGivenAt ? (
                      <span style={{ color: "#16a34a", fontSize: 13 }}>Given</span>
                    ) : sub.status === "SUBMITTED" ? (
                      <Link
                        href={`/classes/${offeringId}/assignments/${assignmentId}/feedback`}
                        style={{ color: "var(--ypp-purple)", fontSize: 13 }}
                      >
                        Give Feedback
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student: My Submission / Feedback */}
      {!isInstructor && (
        <>
          {/* Show received feedback */}
          {mySubmission?.status === "FEEDBACK_GIVEN" && (
            <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid #16a34a" }}>
              <h3 style={{ color: "#16a34a" }}>Instructor Feedback</h3>

              {mySubmission.celebratoryNote && (
                <div style={{
                  marginTop: 12,
                  padding: "12px 16px",
                  background: "#fef3c7",
                  borderRadius: "var(--radius-md)",
                  fontSize: 14,
                }}>
                  {mySubmission.celebratoryNote}
                </div>
              )}

              {mySubmission.instructorFeedback && (
                <div style={{ marginTop: 12 }}>
                  <strong>Feedback:</strong>
                  <p style={{ marginTop: 4, whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>
                    {mySubmission.instructorFeedback}
                  </p>
                </div>
              )}

              {mySubmission.suggestionsForNext && (
                <div style={{ marginTop: 12 }}>
                  <strong>For next time:</strong>
                  <p style={{ marginTop: 4, whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>
                    {mySubmission.suggestionsForNext}
                  </p>
                </div>
              )}

              {mySubmission.completionBadge && (
                <div style={{ marginTop: 12, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 14, color: "#16a34a", fontWeight: 600, textAlign: "center" }}>
                  Completion Badge Earned!
                </div>
              )}
            </div>
          )}

          {/* Submit Work Form */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3>{mySubmission ? "Update Your Submission" : "Submit Your Work"}</h3>
            <SubmissionClient
              assignmentId={assignmentId}
              offeringId={offeringId}
              existingSubmission={mySubmission ? {
                workUrl: mySubmission.workUrl || "",
                workText: mySubmission.workText || "",
                studentReflection: mySubmission.studentReflection || "",
                enjoymentRating: mySubmission.enjoymentRating || 0,
                difficultyRating: mySubmission.difficultyRating || 0,
                whatWentWell: mySubmission.whatWentWell || "",
                whatToImprove: mySubmission.whatToImprove || "",
                wouldRecommend: mySubmission.wouldRecommend,
                status: mySubmission.status,
              } : null}
              groupId={myGroup?.id || null}
            />
          </div>
        </>
      )}
    </div>
  );
}
