import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { ProgressBar, GoalProgressDisplay } from "@/components/progress-bar";
import {
  getMonthlyCycleLabel,
  PROGRESS_STATUS_META,
} from "@/lib/mentorship-review-helpers";
import { prisma } from "@/lib/prisma";
import { formatEnum, formatEnumStripPrefix } from "@/lib/format-utils";

const TONE_STYLES = {
  neutral: { background: "#e2e8f0", color: "#334155" },
  warning: { background: "#fef3c7", color: "#92400e" },
  success: { background: "#dcfce7", color: "#166534" },
  danger: { background: "#fee2e2", color: "#991b1b" },
} as const;

export default async function MenteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: menteeId } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];

  if (!userId) {
    redirect("/login");
  }

  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const isAdmin = roles.includes("ADMIN");

  if (!isMentor && !isChapterLead && !isAdmin) {
    redirect("/");
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

  const accessMentorship = await prisma.mentorship.findFirst({
    where: {
      menteeId,
      status: "ACTIVE",
      ...(isAdmin
        ? {}
        : {
            OR: [{ mentorId: userId }, { chairId: userId }],
          }),
    },
    select: { id: true },
  });

  if (!accessMentorship) {
    redirect("/mentorship/mentees");
  }

  const [mentee, activeMentorship, currentMonthReview, latestApprovedReview, achievementPoints] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: menteeId },
        include: {
          roles: true,
          chapter: true,
          profile: true,
          goals: {
            include: {
              template: true,
              progress: {
                orderBy: { createdAt: "desc" },
                include: {
                  submittedBy: { select: { name: true } },
                },
              },
            },
            orderBy: { template: { sortOrder: "asc" } },
          },
          reflectionSubmissions: {
            include: {
              form: true,
              responses: {
                include: {
                  question: true,
                },
              },
            },
            orderBy: { submittedAt: "desc" },
            take: 5,
          },
          courses: true,
          trainings: {
            include: { module: true },
          },
          approvals: {
            include: { levels: true },
          },
        },
      }),
      prisma.mentorship.findFirst({
        where: {
          menteeId,
          status: "ACTIVE",
        },
        include: {
          mentor: { select: { id: true, name: true, email: true } },
          chair: { select: { id: true, name: true, email: true } },
          track: { select: { id: true, name: true } },
          checkIns: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),
      prisma.monthlyGoalReview.findFirst({
        where: {
          mentorshipId: accessMentorship.id,
          month: normalizedMonth,
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
          reflectionSubmission: {
            include: {
              responses: {
                include: { question: true },
                orderBy: {
                  question: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      }),
      prisma.monthlyGoalReview.findFirst({
        where: {
          menteeId,
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
        where: { userId: menteeId },
        _sum: { points: true },
      }),
    ]);

  if (!mentee) {
    notFound();
  }

  const currentMonthReflection =
    currentMonthReview?.reflectionSubmission ??
    mentee.reflectionSubmissions.find((submission) => {
      const submissionMonth = new Date(submission.month);
      return (
        submissionMonth >= normalizedMonth && submissionMonth < nextMonth
      );
    }) ??
    null;

  const cycleLabel = getMonthlyCycleLabel({
    hasReflection: Boolean(currentMonthReflection),
    reviewStatus: currentMonthReview?.status ?? null,
  });
  const displayedReview = currentMonthReview ?? latestApprovedReview;

  const goalsForDisplay = mentee.goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    timetable: goal.timetable,
    latestStatus: goal.progress[0]?.status ?? null,
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/mentorship/mentees"
            style={{ color: "var(--muted)", fontSize: 13 }}
          >
            &larr; Back to Mentees
          </Link>
          <h1 className="page-title">{mentee.name}</h1>
          <p style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>
            Current cycle first, legacy history second.
          </p>
        </div>
        <Link
          href={`/mentorship/reviews/${menteeId}`}
          className="button small secondary"
          style={{ textDecoration: "none" }}
        >
          Open Monthly Review
        </Link>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="section-title">Profile</div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Email:</strong> {mentee.email}
            </p>
            {mentee.phone && (
              <p style={{ margin: "0 0 4px" }}>
                <strong>Phone:</strong> {mentee.phone}
              </p>
            )}
            <p style={{ margin: "0 0 4px" }}>
              <strong>Role:</strong> {formatEnum(mentee.primaryRole)}
            </p>
            {mentee.chapter && (
              <p style={{ margin: "0 0 4px" }}>
                <strong>Chapter:</strong> {mentee.chapter.name}
              </p>
            )}
          </div>
          {mentee.profile?.bio && (
            <div style={{ marginTop: 16 }}>
              <strong>Bio:</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                {mentee.profile.bio}
              </p>
            </div>
          )}
          {mentee.profile?.curriculumUrl && (
            <div style={{ marginTop: 12 }}>
              <a
                href={mentee.profile.curriculumUrl}
                target="_blank"
                className="link"
              >
                View Curriculum &rarr;
              </a>
            </div>
          )}
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              Mentorship Structure
            </div>
            <span className="pill" style={TONE_STYLES[cycleLabel.tone]}>
              {cycleLabel.label}
            </span>
          </div>

          {activeMentorship ? (
            <>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Mentor:</strong> {activeMentorship.mentor.name}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Mentor Committee Chair:</strong>{" "}
                {activeMentorship.chair?.name || "Not assigned"}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Track:</strong>{" "}
                {activeMentorship.track?.name || "Not assigned"}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Started:</strong>{" "}
                {new Date(activeMentorship.startDate).toLocaleDateString()}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Kickoff Scheduled:</strong>{" "}
                {activeMentorship.kickoffScheduledAt
                  ? new Date(
                      activeMentorship.kickoffScheduledAt
                    ).toLocaleDateString()
                  : "Not scheduled"}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <strong>Kickoff Completed:</strong>{" "}
                {activeMentorship.kickoffCompletedAt
                  ? new Date(
                      activeMentorship.kickoffCompletedAt
                    ).toLocaleDateString()
                  : "Not completed"}
              </p>
              {activeMentorship.notes && (
                <div style={{ marginTop: 12 }}>
                  <strong>Governance Notes:</strong>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                    {activeMentorship.notes}
                  </p>
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <strong>Total Achievement Points:</strong>{" "}
                {achievementPoints._sum.points ?? 0}
              </div>
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>
              No active mentorship structure has been assigned.
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <div className="section-title" style={{ marginBottom: 6 }}>
              Current Monthly Cycle
            </div>
            <h3 style={{ margin: 0 }}>
              {normalizedMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h3>
          </div>
          <span className="pill" style={TONE_STYLES[cycleLabel.tone]}>
            {cycleLabel.label}
          </span>
        </div>

        <div className="grid three" style={{ marginBottom: 20 }}>
          <div
            style={{
              padding: 14,
              background: "var(--surface-alt)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>
              Monthly Self-Reflection
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
              Monthly Goal Review
            </strong>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {currentMonthReview ? formatEnum(currentMonthReview.status) : "Not started yet"}
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
              Next Step
            </strong>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {currentMonthReview?.status === "PENDING_CHAIR_APPROVAL"
                ? "Chair approval is next."
                : currentMonthReview?.status === "RETURNED"
                  ? "Mentor revisions are needed before approval."
                  : currentMonthReview?.status === "APPROVED"
                    ? "Approved review is ready for the mentee."
                    : currentMonthReflection
                      ? "Mentor review should be drafted next."
                      : "Reflection must be submitted first."}
            </div>
          </div>
        </div>

        {displayedReview ? (
          <>
            {displayedReview.overallStatus && (
              <div style={{ marginBottom: 20 }}>
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
                    {PROGRESS_STATUS_META[displayedReview.overallStatus].label}
                  </span>
                </div>
                <ProgressBar status={displayedReview.overallStatus} />
              </div>
            )}

            <div className="grid two" style={{ marginBottom: 20 }}>
              <div>
                <p style={{ marginTop: 0, fontSize: 13 }}>
                  <strong>Overall Comments:</strong>{" "}
                  {displayedReview.overallComments || "No overall comments recorded."}
                </p>
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>Strengths:</strong>{" "}
                  {displayedReview.strengths || "No strengths recorded."}
                </p>
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>Focus Areas:</strong>{" "}
                  {displayedReview.focusAreas || "No focus areas recorded."}
                </p>
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>Next Month Plan:</strong>{" "}
                  {displayedReview.nextMonthPlan || "No next-month plan recorded."}
                </p>
              </div>
              <div>
                <p style={{ marginTop: 0, fontSize: 13 }}>
                  <strong>Collaboration Notes:</strong>{" "}
                  {displayedReview.collaborationNotes || "No collaboration notes recorded."}
                </p>
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>Promotion Readiness:</strong>{" "}
                  {displayedReview.promotionReadiness || "No promotion note recorded."}
                </p>
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>Character & Culture Points:</strong>{" "}
                  {displayedReview.characterCulturePoints}
                </p>
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>Total Achievement Points:</strong>{" "}
                  {displayedReview.totalAchievementPoints}
                </p>
                {displayedReview.chairDecisionNotes && (
                  <p style={{ marginTop: 12, fontSize: 13 }}>
                    <strong>Chair Decision Notes:</strong>{" "}
                    {displayedReview.chairDecisionNotes}
                  </p>
                )}
              </div>
            </div>

            {displayedReview.goalRatings.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 12px" }}>Goal Ratings</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {displayedReview.goalRatings.map((rating) => (
                    <div
                      key={rating.id}
                      style={{
                        padding: 16,
                        background: "var(--surface-alt)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <strong>{rating.goal.template.title}</strong>
                      <div style={{ marginTop: 10 }}>
                        <ProgressBar status={rating.status} />
                      </div>
                      {rating.comments && (
                        <p style={{ margin: "10px 0 0", fontSize: 13 }}>
                          {rating.comments}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: "var(--muted)" }}>
            No Monthly Goal Review has been recorded yet.
          </p>
        )}
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="section-title">Training & Approvals</div>
          {mentee.trainings.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No training assignments.</p>
          ) : (
            <div className="timeline">
              {mentee.trainings.map((training) => (
                <div key={training.id} className="timeline-item">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <strong>{training.module.title}</strong>
                    <span
                      className={`pill ${
                        training.status === "COMPLETE"
                          ? "pill-success"
                          : training.status === "IN_PROGRESS"
                            ? ""
                            : "pill-declined"
                      }`}
                    >
                      {formatEnum(training.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {mentee.approvals.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <strong>Approved Levels:</strong>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                {mentee.approvals[0].levels.map((level) => (
                  <span
                    key={level.id}
                    className={`pill level-${level.level
                      .replace("LEVEL_", "")
                      .toLowerCase()}`}
                  >
                    {formatEnumStripPrefix(level.level, "LEVEL_")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeMentorship?.checkIns && activeMentorship.checkIns.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <strong>Recent Check-ins:</strong>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {activeMentorship.checkIns.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    style={{
                      padding: 12,
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 12,
                        color: "var(--muted)",
                      }}
                    >
                      <span>
                        {new Date(checkIn.createdAt).toLocaleDateString()}
                      </span>
                      {checkIn.rating && <span>Rating: {checkIn.rating}/5</span>}
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                      {checkIn.notes}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Recent Reflections</div>
          {mentee.reflectionSubmissions.length > 0 ? (
            <div className="timeline">
              {mentee.reflectionSubmissions.map((submission) => (
                <div key={submission.id} className="timeline-item">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong>{submission.form.title}</strong>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {new Date(submission.month).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {submission.responses.slice(0, 3).map((response) => (
                      <div key={response.id} style={{ marginTop: 8 }}>
                        <strong
                          style={{ fontSize: 12, color: "var(--muted)" }}
                        >
                          {response.question.sectionTitle || "Reflection"}:{" "}
                          {response.question.question}
                        </strong>
                        <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                          {response.value.slice(0, 150)}
                          {response.value.length > 150 ? "..." : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>No reflections submitted yet.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Legacy Progress History</div>
        <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13 }}>
          These older progress updates remain visible for continuity, but the
          Monthly Goal Review is now the primary review record.
        </p>

        {mentee.goals.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No goals assigned to this mentee yet.
          </p>
        ) : (
          <>
            <GoalProgressDisplay goals={goalsForDisplay} showOverall={true} />

            <div style={{ marginTop: 32 }}>
              <h4 style={{ margin: "0 0 16px" }}>Goal Details & Comments</h4>
              {mentee.goals.map((goal, index) => (
                <div
                  key={goal.id}
                  style={{
                    padding: 16,
                    marginBottom: 16,
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
                        Goal {index + 1}: {goal.template.title}
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
                  </div>
                  {goal.template.description && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      {goal.template.description}
                    </p>
                  )}

                  {goal.progress.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <strong style={{ fontSize: 13 }}>Progress History:</strong>
                      <div style={{ marginTop: 8 }}>
                        {goal.progress.slice(0, 3).map((update) => (
                          <div
                            key={update.id}
                            style={{
                              padding: 12,
                              marginTop: 8,
                              background: "white",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span className="pill">
                                {PROGRESS_STATUS_META[update.status].label}
                              </span>
                              <span
                                style={{ fontSize: 12, color: "var(--muted)" }}
                              >
                                {new Date(update.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {update.comments && (
                              <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                                {update.comments}
                              </p>
                            )}
                            <p
                              style={{
                                margin: "4px 0 0",
                                fontSize: 11,
                                color: "var(--muted)",
                              }}
                            >
                              By {update.submittedBy.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
