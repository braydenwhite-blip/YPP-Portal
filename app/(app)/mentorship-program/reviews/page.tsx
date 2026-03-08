import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMyReviewQueue } from "@/lib/goal-review-actions";
import Link from "next/link";

export const metadata = { title: "Review Queue — Mentorship Program" };

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "pill" },
  PENDING_CHAIR_APPROVAL: { label: "Pending Approval", cls: "pill pill-pending" },
  CHANGES_REQUESTED: { label: "Changes Requested", cls: "pill pill-declined" },
  APPROVED: { label: "Approved", cls: "pill pill-success" },
};

const RATING_CONFIG: Record<string, { label: string; color: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706" },
  ACHIEVED: { label: "Achieved", color: "#16a34a" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed" },
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_LEAD: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

export default async function ReviewQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("MENTOR") && !roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const queue = await getMyReviewQueue();
  if (!queue) redirect("/");

  const pending = queue.filter((m) => m.latestReflection && !m.isReleased && m.reviewStatus !== "APPROVED");
  const completed = queue.filter((m) => !m.latestReflection || m.isReleased || m.reviewStatus === "APPROVED");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Review Queue</h1>
          <p className="page-subtitle">Monthly goal reviews for your assigned mentees</p>
        </div>
        {roles.includes("ADMIN") && (
          <Link href="/mentorship-program/chair" className="button outline small">
            Chair Approval Queue →
          </Link>
        )}
      </div>

      {/* KPI row */}
      <div className="grid three" style={{ marginBottom: "1.75rem" }}>
        <div className="card">
          <p className="kpi">{queue.length}</p>
          <p className="kpi-label">Active Mentees</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: pending.length > 0 ? "#d97706" : "inherit" }}>
            {pending.length}
          </p>
          <p className="kpi-label">Pending Review</p>
        </div>
        <div className="card">
          <p className="kpi">{completed.length}</p>
          <p className="kpi-label">Up to Date</p>
        </div>
      </div>

      {/* Pending reviews */}
      {pending.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            Action Required ({pending.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pending.map((item) => {
              const r = item.latestReflection!;
              const reviewStatus = item.reviewStatus ? STATUS_CONFIG[item.reviewStatus] : null;
              const actionLabel =
                item.reviewStatus === "CHANGES_REQUESTED"
                  ? "Revise Review"
                  : item.reviewStatus === "DRAFT"
                  ? "Continue Review"
                  : "Write Review";

              return (
                <div key={item.mentorshipId} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>{item.menteeName}</span>
                      <span className="pill" style={{ fontSize: "0.72rem" }}>
                        {ROLE_LABELS[item.menteeRole] ?? item.menteeRole}
                      </span>
                      {r.cycleNumber % 3 === 0 && (
                        <span className="pill" style={{ fontSize: "0.72rem", background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)" }}>
                          Quarterly
                        </span>
                      )}
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.2rem 0 0" }}>
                      Cycle {r.cycleNumber} ·{" "}
                      {new Date(r.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })} ·
                      Submitted {new Date(r.submittedAt).toLocaleDateString()}
                    </p>
                    {item.reviewStatus === "CHANGES_REQUESTED" && (
                      <p style={{ color: "#b45309", fontSize: "0.78rem", marginTop: "0.2rem" }}>
                        ⚠ Chair requested changes
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {reviewStatus && (
                      <span className={reviewStatus.cls} style={{ fontSize: "0.75rem" }}>
                        {reviewStatus.label}
                      </span>
                    )}
                    <Link href={`/mentorship-program/reviews/${r.id}`} className="button primary small">
                      {actionLabel}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All mentees */}
      <div>
        <p className="section-title" style={{ marginBottom: "0.75rem" }}>
          All Mentees ({queue.length})
        </p>
        {queue.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ color: "var(--muted)" }}>No active mentees in the program.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th className="th">Mentee</th>
                  <th className="th">Role</th>
                  <th className="th">Latest Cycle</th>
                  <th className="th">Review Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const r = item.latestReflection;
                  const reviewStatus = item.reviewStatus ? STATUS_CONFIG[item.reviewStatus] : null;
                  return (
                    <tr key={item.mentorshipId}>
                      <td className="td">
                        <div style={{ fontWeight: 500 }}>{item.menteeName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{item.menteeEmail}</div>
                      </td>
                      <td className="td">
                        <span className="pill" style={{ fontSize: "0.75rem" }}>
                          {ROLE_LABELS[item.menteeRole] ?? item.menteeRole}
                        </span>
                      </td>
                      <td className="td">
                        {r ? (
                          <div>
                            <span style={{ fontWeight: 500 }}>Cycle {r.cycleNumber}</span>
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {new Date(r.submittedAt).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.85rem" }}>
                            No reflections yet
                          </span>
                        )}
                      </td>
                      <td className="td">
                        {item.isReleased ? (
                          <span className="pill pill-success" style={{ fontSize: "0.75rem" }}>Released</span>
                        ) : reviewStatus ? (
                          <span className={reviewStatus.cls} style={{ fontSize: "0.75rem" }}>
                            {reviewStatus.label}
                          </span>
                        ) : r ? (
                          <span className="pill" style={{ fontSize: "0.75rem", background: "#fef9c3", color: "#854d0e" }}>
                            Needs Review
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>—</span>
                        )}
                      </td>
                      <td className="td">
                        {r && (
                          <Link href={`/mentorship-program/reviews/${r.id}`} className="button ghost small">
                            {item.reviewStatus === "APPROVED" || item.isReleased ? "View" : "Review"}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
