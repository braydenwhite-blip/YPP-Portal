import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  getMonthlyCycleLabel,
  REVIEW_STATUS_META,
} from "@/lib/mentorship-review-helpers";
import { prisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/format-utils";

const TONE_STYLES = {
  neutral: { background: "#e2e8f0", color: "#334155" },
  warning: { background: "#fef3c7", color: "#92400e" },
  success: { background: "#dcfce7", color: "#166534" },
  danger: { background: "#fee2e2", color: "#991b1b" },
} as const;

export default async function MentorshipPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isMentor =
    roles.includes("MENTOR") || roles.includes("CHAPTER_LEAD") || isAdmin;
  const isStudent = roles.includes("STUDENT");

  const currentMonth = new Date();
  const normalizedMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );
  const nextMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    1
  );

  const [myMentorships, myMentor, stats, currentStudentReflection, currentStudentReview] =
    await Promise.all([
      isMentor
        ? prisma.mentorship.findMany({
            where: isAdmin
              ? { status: "ACTIVE" }
              : { mentorId: userId, status: "ACTIVE" },
            include: {
              mentee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  reflectionSubmissions: {
                    where: {
                      month: {
                        gte: normalizedMonth,
                        lt: nextMonth,
                      },
                    },
                    orderBy: { submittedAt: "desc" },
                    take: 1,
                  },
                },
              },
              mentor: { select: { id: true, name: true } },
              chair: { select: { id: true, name: true } },
              track: { select: { id: true, name: true } },
              checkIns: { orderBy: { createdAt: "desc" }, take: 1 },
              monthlyReviews: {
                where: { month: normalizedMonth },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            orderBy: { startDate: "desc" },
            take: isAdmin ? 30 : 50,
          })
        : Promise.resolve([]),
      isStudent
        ? prisma.mentorship.findFirst({
            where: { menteeId: userId, status: "ACTIVE" },
            include: {
              mentor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profile: { select: { bio: true } },
                },
              },
              chair: { select: { id: true, name: true } },
              track: { select: { id: true, name: true } },
              checkIns: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          })
        : Promise.resolve(null),
      isAdmin
        ? Promise.all([
            prisma.mentorship.count({ where: { status: "ACTIVE" } }),
            prisma.mentorshipCheckIn.count({
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            }),
            prisma.monthlyGoalReview.count({
              where: {
                month: normalizedMonth,
                status: "PENDING_CHAIR_APPROVAL",
              },
            }),
            prisma.monthlyGoalReview.count({
              where: {
                month: normalizedMonth,
                status: "APPROVED",
              },
            }),
          ]).then(
            ([activePairings, recentCheckins, pendingApprovals, approvedReviews]) => ({
              activePairings,
              recentCheckins,
              pendingApprovals,
              approvedReviews,
            })
          )
        : Promise.resolve(null),
      isStudent
        ? prisma.reflectionSubmission.findFirst({
            where: {
              userId,
              month: {
                gte: normalizedMonth,
                lt: nextMonth,
              },
            },
            orderBy: { submittedAt: "desc" },
          })
        : Promise.resolve(null),
      isStudent
        ? prisma.monthlyGoalReview.findFirst({
            where: {
              menteeId: userId,
              month: normalizedMonth,
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              publishedAt: true,
            },
          })
        : Promise.resolve(null),
    ]);

  const mentorWorkflowStats = isMentor
    ? myMentorships.reduce(
        (totals, pairing) => {
          const review = pairing.monthlyReviews[0] ?? null;
          const hasReflection = pairing.mentee.reflectionSubmissions.length > 0;

          if (review?.status === "PENDING_CHAIR_APPROVAL") {
            totals.pendingChairApproval += 1;
          } else if (review?.status === "APPROVED") {
            totals.approved += 1;
          } else if (review?.status === "RETURNED") {
            totals.returned += 1;
          } else if (hasReflection) {
            totals.needsMentorReview += 1;
          } else {
            totals.awaitingReflection += 1;
          }

          return totals;
        },
        {
          needsMentorReview: 0,
          pendingChairApproval: 0,
          returned: 0,
          approved: 0,
          awaitingReflection: 0,
        }
      )
    : null;

  const studentCycle =
    currentStudentReview?.status === "APPROVED"
      ? { label: "Approved Review Ready", tone: "success" as const }
      : currentStudentReflection
        ? { label: "Mentor Review In Progress", tone: "warning" as const }
        : { label: "Reflection Not Started", tone: "neutral" as const };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Mentorship Dashboard</h1>
          <p className="page-subtitle">
            Your hub for all mentorship activity — track mentees, check-ins, and the monthly reflection cycle from one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isMentor && (
            <Link href="/mentorship/mentees" className="button primary small">
              My Mentees
            </Link>
          )}
          {isMentor && (
            <Link href="/mentorship/reviews" className="button small secondary">
              Chair Review Queue
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/mentorship-program"
              className="button small secondary"
            >
              Mentorship Program
            </Link>
          )}
          {isStudent && (
            <Link href="/reflection" className="button primary small">
              Monthly Self-Reflection
            </Link>
          )}
          {isStudent && (
            <Link href="/my-mentor" className="button small secondary">
              My Mentor
            </Link>
          )}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>Monthly Mentorship Cycle</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Step 1: mentee submits the Monthly Self-Reflection. Step 2: mentor
            completes the Monthly Goal Review. Step 3: Mentor Committee Chair
            approves or returns it. Step 4: the approved review becomes visible
            to the mentee.
          </p>
        </div>
        <div className="card">
          <h3>Quarterly Oversight</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Approved monthly reviews stay connected to committee discussions,
            achievement points, awards, and promotion readiness instead of
            living in separate tools.
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid four" style={{ marginBottom: 24 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{stats.activePairings}</div>
            <div className="kpi-label">Active Pairings</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{stats.recentCheckins}</div>
            <div className="kpi-label">Check-ins (30 Days)</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{stats.pendingApprovals}</div>
            <div className="kpi-label">Chair Approvals Waiting</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{stats.approvedReviews}</div>
            <div className="kpi-label">Approved This Month</div>
          </div>
        </div>
      )}

      {mentorWorkflowStats && (
        <div className="grid four" style={{ marginBottom: 24 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{mentorWorkflowStats.needsMentorReview}</div>
            <div className="kpi-label">Need Mentor Review</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{mentorWorkflowStats.pendingChairApproval}</div>
            <div className="kpi-label">Waiting On Chair</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{mentorWorkflowStats.returned}</div>
            <div className="kpi-label">Returned For Edits</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{mentorWorkflowStats.awaitingReflection}</div>
            <div className="kpi-label">Awaiting Reflection</div>
          </div>
        </div>
      )}

      {isStudent && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div className="section-title" style={{ marginBottom: 8 }}>
                This Month
              </div>
              <h3 style={{ margin: 0 }}>
                {normalizedMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                {currentStudentReflection
                  ? "Your reflection has been submitted. The next step is your mentor's review."
                  : "Start by submitting your Monthly Self-Reflection so your mentor can complete this month's review."}
              </p>
            </div>
            <span
              className="pill"
              style={TONE_STYLES[studentCycle.tone]}
            >
              {studentCycle.label}
            </span>
          </div>

          <div className="grid three" style={{ marginTop: 16 }}>
            <div
              style={{
                padding: 14,
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>
                Step 1
              </strong>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Monthly Self-Reflection
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {currentStudentReflection
                  ? `Submitted ${new Date(
                      currentStudentReflection.submittedAt
                    ).toLocaleDateString()}`
                  : "Not started yet"}
              </div>
            </div>
            <div
              style={{
                padding: 14,
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>
                Step 2
              </strong>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Mentor Monthly Goal Review
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {currentStudentReview?.status === "APPROVED"
                  ? "Approved and published"
                  : currentStudentReflection
                    ? "In progress"
                    : "Waiting on your reflection"}
              </div>
            </div>
            <div
              style={{
                padding: 14,
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>
                Step 3
              </strong>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Your Next Action
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {currentStudentReview?.status === "APPROVED"
                  ? "Open My Goals to view the approved review and next-month plan."
                  : currentStudentReflection
                    ? "Watch for your approved Monthly Goal Review."
                    : "Submit your reflection now."}
              </div>
            </div>
          </div>
        </div>
      )}

      {isStudent && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">My Mentor</div>
          {myMentor ? (
            <Link
              href="/my-mentor"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="card"
                style={{
                  borderLeft: "4px solid var(--ypp-purple)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{myMentor.mentor.name}</h3>
                    <div
                      style={{ fontSize: 13, color: "var(--text-secondary)" }}
                    >
                      {myMentor.mentor.email}
                    </div>
                    {myMentor.track && (
                      <div
                        style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}
                      >
                        Track: {myMentor.track.name}
                      </div>
                    )}
                    {myMentor.chair && (
                      <div
                        style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}
                      >
                        Mentor Committee Chair: {myMentor.chair.name}
                      </div>
                    )}
                    {myMentor.mentor.profile?.bio && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--muted)",
                          marginTop: 8,
                        }}
                      >
                        {myMentor.mentor.profile.bio.length > 120
                          ? `${myMentor.mentor.profile.bio.slice(0, 120)}...`
                          : myMentor.mentor.profile.bio}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      className="pill"
                      style={{ background: "#dcfce7", color: "#166534" }}
                    >
                      Active
                    </span>
                    {myMentor.checkIns[0] && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginTop: 8,
                        }}
                      >
                        Last check-in:{" "}
                        {new Date(
                          myMentor.checkIns[0].createdAt
                        ).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 24 }}>
              <p style={{ color: "var(--text-secondary)" }}>
                No mentor assigned yet. Contact your chapter president or YPP administrator to request a pairing.
              </p>
            </div>
          )}
        </div>
      )}

      {isMentor && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              {isAdmin ? "Active Pairings" : "My Mentees"}
            </div>
            {myMentorships.length > 0 && (
              <Link
                href="/mentorship/mentees"
                className="link"
                style={{ fontSize: 13 }}
              >
                View All &rarr;
              </Link>
            )}
          </div>

          {myMentorships.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 24 }}>
              <p style={{ color: "var(--text-secondary)" }}>
                {isAdmin
                  ? "No active mentorship pairings yet."
                  : "No mentees assigned yet. Your chapter lead will pair you with mentees."}
              </p>
              {isAdmin && (
                <Link
                  href="/admin/mentor-match"
                  className="button primary small"
                  style={{ marginTop: 12 }}
                >
                  Run Mentor Match
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myMentorships.map((pairing) => {
                const lastCheckIn = pairing.checkIns[0];
                const daysSinceCheckIn = lastCheckIn
                  ? Math.floor(
                      (Date.now() - new Date(lastCheckIn.createdAt).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null;
                const currentReview = pairing.monthlyReviews[0] ?? null;
                const hasReflection =
                  pairing.mentee.reflectionSubmissions.length > 0;
                const cycleLabel = getMonthlyCycleLabel({
                  hasReflection,
                  reviewStatus: currentReview?.status ?? null,
                });
                const nextAction =
                  currentReview?.status === "PENDING_CHAIR_APPROVAL"
                    ? "Waiting on chair approval"
                    : currentReview?.status === "APPROVED"
                      ? "Approved and visible to mentee"
                      : currentReview?.status === "RETURNED"
                        ? "Needs mentor revisions"
                        : hasReflection
                          ? "Mentor review should be completed next"
                          : "Waiting on mentee reflection";

                return (
                  <Link
                    key={pairing.id}
                    href={`/mentorship/mentees/${pairing.mentee.id}`}
                    className="card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div>
                        <strong>{pairing.mentee.name}</strong>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--text-secondary)",
                            marginTop: 2,
                          }}
                        >
                          {pairing.mentee.email}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 8,
                          }}
                        >
                          {pairing.track && (
                            <span className="pill">{pairing.track.name}</span>
                          )}
                          {pairing.chair && (
                            <span
                              className="pill"
                              style={{
                                background: "#f3e8ff",
                                color: "#7c3aed",
                              }}
                            >
                              Chair: {pairing.chair.name}
                            </span>
                          )}
                          <span
                            className="pill"
                            style={TONE_STYLES[cycleLabel.tone]}
                          >
                            {cycleLabel.label}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", minWidth: 220 }}>
                        <div
                          style={{ fontSize: 12, color: "var(--muted)" }}
                        >
                          Current month
                        </div>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>
                          {nextAction}
                        </div>
                        {lastCheckIn && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginTop: 6,
                            }}
                          >
                            Last check-in {daysSinceCheckIn} day
                            {daysSinceCheckIn === 1 ? "" : "s"} ago
                          </div>
                        )}
                        {!lastCheckIn && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginTop: 6,
                            }}
                          >
                            No check-in logged yet
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick Links */}
      <div style={{ marginTop: 28 }}>
        <div className="section-title">Quick Links</div>
        <div className="grid three">
          <Link href="/mentor/feedback" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <h4 style={{ margin: "0 0 4px" }}>Feedback Portal</h4>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                {isMentor
                  ? "Review student submissions and provide written feedback."
                  : "Submit your work for review and receive personalized feedback."}
              </p>
            </div>
          </Link>

          {isAdmin && (
            <Link href="/admin/mentor-match" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="card" style={{ cursor: "pointer" }}>
                <h4 style={{ margin: "0 0 4px" }}>Mentor Matching</h4>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                  Run the matching algorithm to pair mentors with students or instructors.
                </p>
              </div>
            </Link>
          )}

          <Link href="/mentor/ask" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <h4 style={{ margin: "0 0 4px" }}>Ask a Mentor</h4>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                Browse answered questions or submit your own to the mentor community.
              </p>
            </div>
          </Link>

          <Link href="/mentor/resources" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <h4 style={{ margin: "0 0 4px" }}>Mentor Resources</h4>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                Curated guides, tools, and videos shared by mentors.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
