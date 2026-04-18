import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getMyClassesHubData } from "@/lib/student-class-portal";

export const metadata = { title: "Assignments" };

export default async function StudentAssignmentsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const hub = await getMyClassesHubData(session.user.id);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Classes</p>
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">
            Everything instructors have posted for your enrollments—open a row to submit or review feedback.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-classes" className="button secondary">
            My classes
          </Link>
          <Link href="/curriculum" className="button secondary">
            Browse classes
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Due soon</div>
        {hub.dueAssignments.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>
            You are all caught up. When teachers assign work, it will appear here and on{" "}
            <Link href="/my-classes" style={{ color: "var(--ypp-purple)" }}>
              My classes
            </Link>
            .
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {hub.dueAssignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/curriculum/${assignment.offeringId}/assignments/${assignment.id}`}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{assignment.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {assignment.offeringTitle}
                    </div>
                    {assignment.submissionStatus ? (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                        Status: {assignment.submissionStatus}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12 }}>
                    <div
                      style={{
                        color: assignment.isOverdue ? "#dc2626" : "var(--text-secondary)",
                        fontWeight: 600,
                      }}
                    >
                      {assignment.isOverdue ? "Overdue" : "Due"}
                    </div>
                    <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                      {assignment.dueAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        Class details and the full schedule for each offering are on{" "}
        <Link href="/my-classes" style={{ color: "var(--ypp-purple)" }}>
          My classes
        </Link>{" "}
        and each class page under Browse classes.
      </p>
    </div>
  );
}
