import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getChairQueue } from "@/lib/goal-review-actions";
import Link from "next/link";

export const metadata = { title: "Chair Approval Queue — Mentorship Program" };

const RATING_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444", bg: "#fef2f2" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706", bg: "#fffbeb" },
  ACHIEVED: { label: "Achieved", color: "#16a34a", bg: "#f0fdf4" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed", bg: "#faf5ff" },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING_CHAIR_APPROVAL: { label: "Pending Approval", cls: "pill pill-pending" },
  CHANGES_REQUESTED: { label: "Changes Requested", cls: "pill pill-declined" },
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_LEAD: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

export default async function ChairQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  // Allow ADMIN + MENTOR (chairs) + CHAPTER_LEAD (chairs) to view
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const queue = await getChairQueue();
  if (!queue) redirect("/");

  const pending = queue.filter((r) => r.status === "PENDING_CHAIR_APPROVAL");
  const changesRequested = queue.filter((r) => r.status === "CHANGES_REQUESTED");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Chair Approval Queue</h1>
          <p className="page-subtitle">Review and approve mentor goal reviews before they are released to mentees</p>
        </div>
        <Link href="/mentorship-program/reviews" className="button ghost small">
          ← Review Queue
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid three" style={{ marginBottom: "1.75rem" }}>
        <div className="card">
          <p className="kpi" style={{ color: pending.length > 0 ? "#d97706" : "inherit" }}>
            {pending.length}
          </p>
          <p className="kpi-label">Pending Approval</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: changesRequested.length > 0 ? "#ef4444" : "inherit" }}>
            {changesRequested.length}
          </p>
          <p className="kpi-label">Changes Requested</p>
        </div>
        <div className="card">
          <p className="kpi">{queue.length}</p>
          <p className="kpi-label">Total in Queue</p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontWeight: 600 }}>Queue is empty</p>
          <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
            No reviews are pending chair approval right now.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {queue.map((item) => {
            const rating = RATING_CONFIG[item.overallRating];
            const status = STATUS_CONFIG[item.status];
            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.9rem 1.1rem",
                  borderLeft: `4px solid ${rating?.color ?? "var(--border)"}`,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600 }}>{item.menteeName}</span>
                    <span className="pill" style={{ fontSize: "0.72rem" }}>
                      {ROLE_LABELS[item.menteeRole] ?? item.menteeRole}
                    </span>
                    {item.isQuarterly && (
                      <span
                        className="pill"
                        style={{
                          fontSize: "0.72rem",
                          background: "var(--ypp-purple-100)",
                          color: "var(--ypp-purple-700)",
                        }}
                      >
                        Quarterly
                      </span>
                    )}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.2rem 0 0" }}>
                    Mentor: {item.mentorName} · Cycle {item.cycleNumber} ·{" "}
                    {new Date(item.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.1rem 0 0" }}>
                    Reflection submitted {new Date(item.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {rating && (
                    <span
                      className="pill"
                      style={{ background: rating.bg, color: rating.color, fontSize: "0.75rem" }}
                    >
                      {rating.label}
                    </span>
                  )}
                  {status && (
                    <span className={status.cls} style={{ fontSize: "0.75rem" }}>
                      {status.label}
                    </span>
                  )}
                  <Link href={`/mentorship-program/chair/${item.id}`} className="button primary small">
                    Review
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
