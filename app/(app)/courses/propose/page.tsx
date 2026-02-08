import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ProposeCourse Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/courses");
  }

  // Get user's proposals
  const proposals = await prisma.courseProposal.findMany({
    where: { proposedById: session.user.id },
    include: {
      reviewedBy: true,
      approvedCourse: true
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Course Proposals</h1>
        </div>
        <Link href="/courses/propose/new" className="button primary">
          Propose New Course
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Propose a Course</h3>
        <p>
          Have an idea for a new course? Submit a proposal to have it reviewed by the curriculum team.
          Include detailed information about the course content, target audience, and learning outcomes.
        </p>
      </div>

      {proposals.length === 0 ? (
        <div className="card">
          <h3>No Proposals Yet</h3>
          <p>Submit your first course proposal to expand the YPP curriculum!</p>
          <Link href="/courses/propose/new" className="button primary" style={{ marginTop: 12 }}>
            Propose a Course
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {proposals.map(proposal => (
            <div key={proposal.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <h3>{proposal.title}</h3>
                  <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                    {proposal.description.slice(0, 150)}
                    {proposal.description.length > 150 && "..."}
                  </p>
                </div>
                <div>
                  {proposal.status === "APPROVED" && (
                    <span className="pill success">Approved</span>
                  )}
                  {proposal.status === "PENDING" && (
                    <span className="pill">Pending</span>
                  )}
                  {proposal.status === "UNDER_REVIEW" && (
                    <span className="pill primary">Under Review</span>
                  )}
                  {proposal.status === "REJECTED" && (
                    <span className="pill" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-color)" }}>
                      Rejected
                    </span>
                  )}
                  {proposal.status === "REVISION_REQUESTED" && (
                    <span className="pill" style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-color)" }}>
                      Needs Revision
                    </span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="pill">{proposal.interestArea}</span>
                {proposal.level && (
                  <span className="pill">{proposal.level.replace("LEVEL_", "")}</span>
                )}
                <span className="pill">{proposal.format.replace("_", " ")}</span>
              </div>

              {proposal.reviewedBy && (
                <div style={{ marginTop: 12, padding: 12, backgroundColor: "var(--accent-bg)", borderRadius: 6 }}>
                  <strong>Review from {proposal.reviewedBy.name}:</strong>
                  <p style={{ marginTop: 4 }}>{proposal.reviewNotes || "No notes provided"}</p>
                </div>
              )}

              {proposal.approvedCourse && (
                <Link
                  href={`/courses/${proposal.approvedCourseId}`}
                  className="button primary"
                  style={{ marginTop: 12, display: "inline-block" }}
                >
                  View Approved Course
                </Link>
              )}

              <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                Submitted {new Date(proposal.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
