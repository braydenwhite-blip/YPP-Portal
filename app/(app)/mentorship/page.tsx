import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { canAccessMentorship } from "@/lib/mentorship-access";
import { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import { MentorDashboard } from "./_components/mentor-dashboard";
import { MenteeDashboard } from "./_components/mentee-dashboard";

const MENTOR_ROLES = new Set(["MENTOR", "ADMIN", "CHAPTER_PRESIDENT", "STAFF"]);

function isMentorView(roles: string[], primaryRole: string | null) {
  return (
    roles.some((r) => MENTOR_ROLES.has(r)) ||
    (primaryRole && MENTOR_ROLES.has(primaryRole))
  );
}

export default async function MentorshipPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [] } = session.user;

  if (!canAccessMentorship(primaryRole ?? "")) {
    redirect("/my-program?notice=mentorship-not-available");
  }

  const showMentorView = isMentorView(roles, primaryRole ?? null);

  if (showMentorView) {
    const { columns, inactive, total } = await getSimplifiedMentorKanban();
    const pendingReview = columns.find((c) => c.key === "READY_FOR_REVIEW")?.cards.length ?? 0;
    const needsKickoff = columns
      .flatMap((c) => c.cards)
      .filter((c) => c.kickoffPending).length;

    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship</p>
            <h1 className="page-title">Mentor Dashboard</h1>
            <p className="page-subtitle">
              {total} mentee{total !== 1 ? "s" : ""} across all cycles
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {roles.includes("ADMIN") && (
              <Link href="/admin/mentorship" className="button secondary small">
                Admin Oversight →
              </Link>
            )}
          </div>
        </div>

        {pendingReview > 0 && (
          <div
            className="card"
            style={{
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              borderLeft: "4px solid #3b82f6",
              background: "#eff6ff",
            }}
          >
            <div>
              <strong>
                {pendingReview} mentee{pendingReview !== 1 ? "s" : ""} ready for your review
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Their reflections have been submitted and are waiting on your feedback.
              </p>
            </div>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>See "Ready for Review" →</span>
          </div>
        )}

        {needsKickoff > 0 && (
          <div
            className="card"
            style={{
              marginBottom: 20,
              borderLeft: "4px solid #f59e0b",
              background: "#fffbeb",
            }}
          >
            <strong style={{ color: "#92400e" }}>
              {needsKickoff} mentee{needsKickoff !== 1 ? "s" : ""} need a kickoff meeting
            </strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#92400e" }}>
              Schedule and mark the kickoff to unlock the monthly review cycle.
            </p>
          </div>
        )}

        <MentorDashboard columns={columns} inactive={inactive} total={total} />
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">My Mentorship</h1>
          <p className="page-subtitle">Your goals, reflections, feedback, and progress in one place.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/mentorship-program/reviews" className="button secondary small">
            Reflections & Reviews
          </Link>
        </div>
      </div>
      <MenteeDashboard userId={userId} />
    </div>
  );
}
