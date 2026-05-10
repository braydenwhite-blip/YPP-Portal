import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import {
  canAccessMentorship,
  getInstructorMentorshipMembership,
} from "@/lib/mentorship-access";
import { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import { MentorDashboard } from "./_components/mentor-dashboard";
import { MenteeDashboard } from "./_components/mentee-dashboard";

export default async function MentorshipPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [] } = session.user;

  if (!canAccessMentorship(primaryRole ?? "")) {
    redirect("/my-program?notice=mentorship-not-available");
  }

  const isAdmin = roles.includes("ADMIN");
  const membership = await getInstructorMentorshipMembership(userId);
  const showMentorSection = membership.isMentor || isAdmin;
  const showMenteeSection = membership.isMentee;

  // Neither: clear empty state instead of dropping the user on a blank page.
  if (!showMenteeSection && !showMentorSection) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship</p>
            <h1 className="page-title">Instructor Mentorship</h1>
            <p className="page-subtitle">
              Where instructors track the support they receive and the
              instructors they mentor.
            </p>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>You are not currently part of an instructor mentorship relationship.</h3>
          <p style={{ color: "var(--muted)", maxWidth: 520, margin: "0 auto" }}>
            When you are paired with a mentor, or assigned to mentor another
            instructor, this page becomes your home base. Reach out to your
            chapter leadership to get matched.
          </p>
        </div>
      </div>
    );
  }

  // Mentor data is only loaded when the user actually has mentees.
  let mentorBlock: Awaited<ReturnType<typeof getSimplifiedMentorKanban>> | null = null;
  if (showMentorSection) {
    mentorBlock = await getSimplifiedMentorKanban();
  }

  const pendingReview =
    mentorBlock?.columns.find((c) => c.key === "READY_FOR_REVIEW")?.cards.length ?? 0;
  const needsKickoff =
    mentorBlock?.columns
      .flatMap((c) => c.cards)
      .filter((c) => c.kickoffPending).length ?? 0;

  const subtitle = showMenteeSection && showMentorSection
    ? "Your mentor relationships are below — what you're working on with your mentor and the instructors you support."
    : showMenteeSection
      ? "Your goals, reflections, feedback, and progress with your mentor."
      : `${mentorBlock?.total ?? 0} instructor mentee${(mentorBlock?.total ?? 0) === 1 ? "" : "s"} across all cycles`;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Instructor Mentorship</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {roles.includes("ADMIN") && (
            <Link href="/admin/mentorship" className="button secondary small">
              Admin Oversight →
            </Link>
          )}
        </div>
      </div>

      {showMenteeSection && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0 }}>My Mentorship</h2>
            <Link href="/mentorship-program/reviews" className="button secondary small">
              Reflections & Reviews
            </Link>
          </div>
          <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 14, fontSize: 13 }}>
            What you need to do as an instructor being mentored.
          </p>
          <MenteeDashboard userId={userId} />
        </section>
      )}

      {showMentorSection && mentorBlock && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Instructors I Mentor</h2>
            <Link href="/mentorship/mentees" className="button secondary small">
              Open all mentees →
            </Link>
          </div>
          <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 14, fontSize: 13 }}>
            Instructors you are responsible for mentoring this cycle.
          </p>

          {pendingReview > 0 && (
            <div
              className="card"
              style={{
                marginBottom: 16,
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
                  {pendingReview} instructor{pendingReview !== 1 ? "s" : ""} ready for your review
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
                marginBottom: 16,
                borderLeft: "4px solid #f59e0b",
                background: "#fffbeb",
              }}
            >
              <strong style={{ color: "#92400e" }}>
                {needsKickoff} instructor{needsKickoff !== 1 ? "s" : ""} need a kickoff meeting
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#92400e" }}>
                Schedule and mark the kickoff to unlock the monthly review cycle.
              </p>
            </div>
          )}

          <MentorDashboard
            columns={mentorBlock.columns}
            inactive={mentorBlock.inactive}
            total={mentorBlock.total}
          />
        </section>
      )}
    </div>
  );
}
