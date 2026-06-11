// Student Advisor dashboard — the advisor's caseload: assigned students,
// advising status, follow-up flags, and last check-in, with each row linking
// to the full advising workspace.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { isLeadershipRolesEnabled } from "@/lib/feature-flags";
import { loadAdvisorDashboard } from "@/lib/leadership/queries";
import { AdvisingStatusPill, formatLeadershipDate } from "@/components/leadership/ui";

export const dynamic = "force-dynamic";

export default async function MyAdviseesPage() {
  if (!isLeadershipRolesEnabled()) redirect("/");
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const { assignments } = await loadAdvisorDashboard(userId);
  const followUps = assignments.filter(
    (a) => a.needsFollowUp || a.advisingStatus === "NEEDS_ATTENTION",
  );

  return (
    <div>
      <p className="badge">Student Advisor</p>
      <h1 className="page-title">My Advisees</h1>
      <p className="page-subtitle">
        Students assigned to you for advising. Log check-ins, recommend next steps, and flag
        anyone who needs follow-up — this work counts toward your leadership record and reviews.
      </p>

      <div className="grid four instructor-ops-metrics" style={{ marginBottom: 16 }}>
        <Metric label="Assigned students" value={String(assignments.length)} />
        <Metric label="Need follow-up" value={String(followUps.length)} />
        <Metric
          label="Engaged"
          value={String(assignments.filter((a) => a.advisingStatus === "ENGAGED").length)}
        />
        <Metric
          label="Ready for next step"
          value={String(assignments.filter((a) => a.advisingStatus === "READY_FOR_NEXT").length)}
        />
      </div>

      {assignments.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            You don&apos;t have any advisees yet. Admins assign Student Advisors from the{" "}
            <strong>Leadership Roles</strong> dashboard — once assigned, your students show up
            here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/my-advisees/${assignment.id}`}
              className="card"
              style={{
                padding: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <strong>{assignment.student.name}</strong>
                <div style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
                  {assignment.student.chapter?.name ?? "No chapter"}
                  {assignment.student.profile?.grade ? ` · Grade ${assignment.student.profile.grade}` : ""}
                  {assignment.student.profile?.interests?.length
                    ? ` · ${assignment.student.profile.interests.slice(0, 3).join(", ")}`
                    : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
                  {assignment._count.notes} notes · {assignment._count.recommendations}{" "}
                  recommendations · Last check-in:{" "}
                  {assignment.lastCheckInAt
                    ? formatLeadershipDate(assignment.lastCheckInAt)
                    : "never"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {assignment.needsFollowUp && (
                  <span className="pill pill-small pill-attention">Follow-up</span>
                )}
                <AdvisingStatusPill status={assignment.advisingStatus} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card instructor-ops-metric">
      <span className="kpi">{value}</span>
      <span className="kpi-label">{label}</span>
    </div>
  );
}
