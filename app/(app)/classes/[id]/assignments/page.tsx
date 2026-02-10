import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOfferingAssignments } from "@/lib/assignment-actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const typeLabels: Record<string, string> = {
  PRACTICE: "Practice",
  PROJECT: "Project",
  EXPLORATION: "Exploration",
  GROUP: "Group",
  REFLECTION: "Reflection",
};

const typeColors: Record<string, string> = {
  PRACTICE: "#3b82f6",
  PROJECT: "#7c3aed",
  EXPLORATION: "#059669",
  GROUP: "#d97706",
  REFLECTION: "#ec4899",
};

export default async function ClassAssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: offeringId } = await params;

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: {
      instructor: { select: { id: true, name: true } },
      template: { select: { title: true, interestArea: true } },
    },
  });

  if (!offering) redirect("/classes/catalog");

  const roles = session.user.roles ?? [];
  const isInstructor = offering.instructorId === session.user.id || roles.includes("ADMIN");

  const assignments = await getOfferingAssignments(offeringId, session.user.id);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/classes/${offeringId}`} style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; {offering.title}
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Assignments</h1>
        </div>
        {isInstructor && (
          <Link href={`/classes/${offeringId}/assignments/create`} className="button primary">
            + Create Assignment
          </Link>
        )}
      </div>

      {/* Assignment Philosophy Banner */}
      <div className="card" style={{ marginBottom: 24, background: "var(--ypp-purple-50)", borderLeft: "4px solid var(--ypp-purple)" }}>
        <div style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>
          Learning Through Exploration
        </div>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          These assignments are about learning and having fun — not grades or pressure.
          Take your time, experiment, and celebrate what you create!
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="card">
          <h3>No Assignments Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            {isInstructor
              ? "Create your first enjoyment-focused assignment to inspire your students!"
              : "No assignments have been posted yet. Check back soon!"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {assignments.map((assignment) => {
            const mySubmission = assignment.submissions[0];
            const hasSubmitted = mySubmission?.status === "SUBMITTED" || mySubmission?.status === "FEEDBACK_GIVEN";
            const hasFeedback = mySubmission?.status === "FEEDBACK_GIVEN";
            const inProgress = mySubmission?.status === "IN_PROGRESS";

            return (
              <Link
                key={assignment.id}
                href={`/classes/${offeringId}/assignments/${assignment.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3>{assignment.title}</h3>
                      {assignment.isGroupAssignment && (
                        <span className="pill" style={{ fontSize: 11, background: "#fef3c7", color: "#d97706" }}>
                          Group
                        </span>
                      )}
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                      {assignment.description.slice(0, 150)}
                      {assignment.description.length > 150 && "..."}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div style={{ marginLeft: 16, textAlign: "right", flexShrink: 0 }}>
                    {isInstructor ? (
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
                          {assignment._count.submissions}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>submissions</div>
                      </div>
                    ) : hasFeedback ? (
                      <span className="pill" style={{ background: "#f0fdf4", color: "#16a34a", fontWeight: 600 }}>
                        Feedback Ready!
                      </span>
                    ) : hasSubmitted ? (
                      <span className="pill primary">Submitted</span>
                    ) : inProgress ? (
                      <span className="pill" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                        In Progress
                      </span>
                    ) : mySubmission?.completionBadge ? (
                      <span className="pill" style={{ background: "#fef3c7", color: "#d97706" }}>
                        Completed!
                      </span>
                    ) : (
                      <span className="pill" style={{ background: "var(--gray-100)" }}>
                        Not Started
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="pill" style={{
                    background: (typeColors[assignment.type] || "#888") + "15",
                    color: typeColors[assignment.type],
                    fontWeight: 600,
                    fontSize: 12,
                  }}>
                    {typeLabels[assignment.type] || assignment.type}
                  </span>

                  <span className="pill" style={{ fontSize: 12 }}>
                    {assignment.gradingStyle === "COMPLETION"
                      ? "Completion Only"
                      : assignment.gradingStyle === "FEEDBACK_ONLY"
                        ? "Feedback Only"
                        : "Optional Grade"}
                  </span>

                  {assignment.suggestedDueDate && (
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Aim for: {new Date(assignment.suggestedDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>

                {/* Encouragement */}
                {assignment.encouragementNote && (
                  <div style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    background: "var(--ypp-purple-50)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    color: "var(--ypp-purple-800)",
                    fontStyle: "italic",
                  }}>
                    {assignment.encouragementNote}
                  </div>
                )}

                {/* Group info */}
                {assignment.isGroupAssignment && assignment.groups.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    {assignment.groups.length} group{assignment.groups.length !== 1 ? "s" : ""} formed
                    {assignment.groups.some((g) => g.members.some((m) => m.user.id === session.user.id))
                      ? " (you're in a group)"
                      : ""}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
