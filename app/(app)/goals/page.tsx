import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { ProgressBar, GoalProgressDisplay } from "@/components/progress-bar";
import { PROGRESS_STATUS_META } from "@/lib/mentorship-review-helpers";
import { prisma } from "@/lib/prisma";

const TONE_STYLES = {
  neutral: { background: "#e2e8f0", color: "#334155" },
  warning: { background: "#fef3c7", color: "#92400e" },
  success: { background: "#dcfce7", color: "#166534" },
} as const;

export default async function GoalsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

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

  const [user, goals, progressHistory, currentMonthReflection, currentMonthReview, latestApprovedReview, totalAchievementPoints] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: true,
          chapter: true,
          menteePairs: {
            where: { status: "ACTIVE" },
            include: {
              mentor: {
                select: { id: true, name: true, email: true, phone: true },
              },
              chair: {
                select: { id: true, name: true },
              },
              track: {
                select: { id: true, name: true },
              },
            },
            take: 1,
          },
        },
      }),
      prisma.goal.findMany({
        where: { userId },
        include: {
          template: true,
          progress: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              submittedBy: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { template: { sortOrder: "asc" } },
      }),
      prisma.progressUpdate.findMany({
        where: {
          forUserId: userId,
        },
        include: {
          goal: {
            include: { template: true },
          },
          submittedBy: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.reflectionSubmission.findFirst({
        where: {
          userId,
          month: {
            gte: normalizedMonth,
            lt: nextMonth,
          },
        },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.monthlyGoalReview.findFirst({
        where: {
          menteeId: userId,
          month: normalizedMonth,
        },
        select: {
          id: true,
          status: true,
          publishedAt: true,
          overallStatus: true,
          totalAchievementPoints: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.monthlyGoalReview.findFirst({
        where: {
          menteeId: userId,
          status: "APPROVED",
        },
        include: {
          goalRatings: {
            include: {
              goal: {
                include: { template: true },
              },
            },
            orderBy: {
              goal: {
                template: {
                  sortOrder: "asc",
                },
              },
            },
          },
        },
        orderBy: [{ month: "desc" }, { publishedAt: "desc" }],
      }),
      prisma.achievementPointLedger.aggregate({
        where: { userId },
        _sum: { points: true },
      }),
    ]);

  if (!user) {
    redirect("/login");
  }

  const roles = user.roles.map((role) => role.role);
  const isInstructor = roles.includes("INSTRUCTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const mentor = user.menteePairs[0]?.mentor ?? null;
  const chair = user.menteePairs[0]?.chair ?? null;
  const track = user.menteePairs[0]?.track ?? null;

  const goalsWithProgress = goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    description: goal.template.description,
    timetable: goal.timetable,
    targetDate: goal.targetDate,
    latestStatus: goal.progress[0]?.status ?? null,
    latestComments: goal.progress[0]?.comments ?? null,
    lastUpdatedAt: goal.progress[0]?.createdAt ?? null,
    lastUpdatedBy: goal.progress[0]?.submittedBy?.name ?? null,
  }));

  const monthlyCycle =
    currentMonthReview?.status === "APPROVED"
      ? { label: "Approved Review Ready", tone: "success" as const }
      : currentMonthReflection
        ? { label: "Monthly Review In Progress", tone: "warning" as const }
        : { label: "Reflection Not Started", tone: "neutral" as const };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Goals & Progress</p>
          <h1 className="page-title">My Goals</h1>
          <p style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>
            Approved Monthly Goal Reviews appear here alongside your goals and
            next-month action plan.
          </p>
        </div>
        <div
          className="badge"
          style={{ background: "#e0e7ff", color: "#3730a3" }}
        >
          {isInstructor
            ? "Instructor"
            : isChapterLead
              ? "Chapter President"
              : "Leadership"}{" "}
          Goals
        </div>
      </div>

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
              Step 1: Monthly Self-Reflection. Step 2: mentor Monthly Goal Review.
              Step 3: chair approval. Only approved reviews are shown below.
            </p>
          </div>
          <span className="pill" style={TONE_STYLES[monthlyCycle.tone]}>
            {monthlyCycle.label}
          </span>
        </div>

        <div className="grid four" style={{ marginTop: 16 }}>
          <div
            style={{
              padding: 14,
              background: "var(--surface-alt)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>
              Reflection
            </strong>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {currentMonthReflection
                ? `Submitted ${new Date(
                    currentMonthReflection.submittedAt
                  ).toLocaleDateString()}`
                : "Not submitted yet"}
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
              Review Status
            </strong>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {currentMonthReview?.status === "APPROVED"
                ? "Approved"
                : currentMonthReflection
                  ? "Under review"
                  : "Waiting on reflection"}
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
              Track
            </strong>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {track?.name || "Not assigned"}
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
              Achievement Points
            </strong>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {totalAchievementPoints._sum.points ?? 0} total
            </div>
          </div>
        </div>
      </div>

      {mentor && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">My Mentorship Team</div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0 }}>{mentor.name}</h3>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "var(--muted)",
                  fontSize: 14,
                }}
              >
                Mentor · {mentor.email}
                {mentor.phone && ` · ${mentor.phone}`}
              </p>
            </div>
            {chair && (
              <div>
                <h3 style={{ margin: 0 }}>{chair.name}</h3>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "var(--muted)",
                    fontSize: 14,
                  }}
                >
                  Mentor Committee Chair
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid two">
        <div className="card">
          <div className="section-title">Goal Snapshot</div>
          {goalsWithProgress.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              No goals have been assigned yet. Your mentor or admin will assign
              goals based on your role.
            </p>
          ) : (
            <>
              <GoalProgressDisplay
                goals={goalsWithProgress.map((goal) => ({
                  id: goal.id,
                  title: goal.title,
                  timetable: goal.timetable,
                  latestStatus: goal.latestStatus,
                }))}
                showOverall={true}
              />

              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: "0 0 12px" }}>Goal Details</h4>
                {goalsWithProgress.map((goal, index) => (
                  <div
                    key={goal.id}
                    style={{
                      padding: 16,
                      marginBottom: 12,
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <strong>
                          Goal {index + 1}: {goal.title}
                        </strong>
                        {goal.timetable && (
                          <span
                            style={{
                              marginLeft: 8,
                              color: "var(--muted)",
                              fontSize: 13,
                            }}
                          >
                            (By {goal.timetable})
                          </span>
                        )}
                      </div>
                      {goal.latestStatus && (
                        <span className="pill">
                          {PROGRESS_STATUS_META[goal.latestStatus].label}
                        </span>
                      )}
                    </div>
                    {goal.description && (
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "var(--muted)",
                          fontSize: 13,
                        }}
                      >
                        {goal.description}
                      </p>
                    )}
                    {goal.latestComments && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "white",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 13,
                        }}
                      >
                        <strong>Latest Legacy Feedback:</strong>
                        <p style={{ margin: "4px 0 0" }}>{goal.latestComments}</p>
                        {goal.lastUpdatedBy && goal.lastUpdatedAt && (
                          <p
                            style={{
                              margin: "8px 0 0",
                              color: "var(--muted)",
                              fontSize: 12,
                            }}
                          >
                            {goal.lastUpdatedBy} ·{" "}
                            {new Date(goal.lastUpdatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="section-title">Approved Monthly Goal Review</div>
          {!latestApprovedReview ? (
            <div>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>
                No approved Monthly Goal Review has been released yet.
              </p>
              <a
                href="/reflection"
                className="button small"
                style={{ display: "inline-block", textDecoration: "none" }}
              >
                Submit Monthly Self-Reflection
              </a>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <strong>
                    {new Date(latestApprovedReview.month).toLocaleDateString(
                      "en-US",
                      {
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Published{" "}
                    {latestApprovedReview.publishedAt
                      ? new Date(
                          latestApprovedReview.publishedAt
                        ).toLocaleDateString()
                      : "recently"}
                  </div>
                </div>
                <span className="pill" style={TONE_STYLES.success}>
                  Approved
                </span>
              </div>

              {latestApprovedReview.overallStatus && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    <strong>Overall Progress</strong>
                    <span style={{ color: "var(--muted)" }}>
                      {PROGRESS_STATUS_META[latestApprovedReview.overallStatus].label}
                    </span>
                  </div>
                  <ProgressBar status={latestApprovedReview.overallStatus} />
                </div>
              )}

              <p style={{ marginTop: 0, fontSize: 13 }}>
                <strong>Overall Comments:</strong>{" "}
                {latestApprovedReview.overallComments || "No summary recorded."}
              </p>
              <p style={{ marginTop: 12, fontSize: 13 }}>
                <strong>Strengths:</strong>{" "}
                {latestApprovedReview.strengths || "No strengths recorded."}
              </p>
              <p style={{ marginTop: 12, fontSize: 13 }}>
                <strong>Focus Areas:</strong>{" "}
                {latestApprovedReview.focusAreas || "No focus areas recorded."}
              </p>
              <p style={{ marginTop: 12, fontSize: 13 }}>
                <strong>Next Month Plan:</strong>{" "}
                {latestApprovedReview.nextMonthPlan || "No plan recorded."}
              </p>

              {latestApprovedReview.goalRatings.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <strong style={{ display: "block", marginBottom: 10 }}>
                    Goal Ratings
                  </strong>
                  <div style={{ display: "grid", gap: 10 }}>
                    {latestApprovedReview.goalRatings.map((rating) => (
                      <div
                        key={rating.id}
                        style={{
                          padding: 12,
                          background: "var(--surface-alt)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {rating.goal.template.title}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <ProgressBar status={rating.status} />
                        </div>
                        {rating.comments && (
                          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                            {rating.comments}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
                Achievement points from this review:{" "}
                {latestApprovedReview.totalAchievementPoints}
              </div>
            </>
          )}

          <div className="section-title" style={{ marginTop: 24 }}>
            Legacy Progress History
          </div>
          {progressHistory.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              No legacy progress updates yet.
            </p>
          ) : (
            <div className="timeline">
              {progressHistory.map((update) => (
                <div key={update.id} className="timeline-item">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>
                      {update.goal.template.title}
                    </strong>
                    <span className="pill" style={{ fontSize: 10 }}>
                      {PROGRESS_STATUS_META[update.status].label}
                    </span>
                  </div>
                  {update.comments && (
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      {update.comments}
                    </p>
                  )}
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 11,
                      color: "var(--muted)",
                    }}
                  >
                    By {update.submittedBy.name} ·{" "}
                    {new Date(update.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
