import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getGoalsForMentee } from "@/lib/mentorship-gr-binding";
import { MENTORSHIP_RESOURCE_TYPE_META } from "@/lib/mentorship-hub";
import { nextActionForInstructorMentee } from "@/lib/instructor-mentee-next-action";
import { getLeadershipContext } from "@/lib/leadership-context";
import { RoleStrip } from "@/components/leadership-pathway/role-strip";
import { CycleHeroCard } from "./cycle-hero-card";
import { EmptyStateEditorial } from "./empty-state-editorial";

const TIER_THRESHOLDS = [
  { tier: "BRONZE", pts: 175, label: "Bronze", color: "#92400e", bg: "#fef3c7" },
  { tier: "SILVER", pts: 350, label: "Silver", color: "#374151", bg: "#f3f4f6" },
  { tier: "GOLD", pts: 700, label: "Gold", color: "#78350f", bg: "#fef9c3" },
  { tier: "LIFETIME", pts: 1800, label: "Lifetime", color: "#4c1d95", bg: "#f5f3ff" },
] as const;

const RATING_LABEL: Record<string, string> = {
  BEHIND_SCHEDULE: "Behind",
  GETTING_STARTED: "Getting started",
  ACHIEVED: "Achieved",
  ABOVE_AND_BEYOND: "Above & beyond",
};

const RATING_COLOR: Record<string, string> = {
  BEHIND_SCHEDULE: "#ef4444",
  GETTING_STARTED: "#f59e0b",
  ACHIEVED: "#22c55e",
  ABOVE_AND_BEYOND: "#a855f7",
};

type Props = { userId: string };

async function loadMenteeDashboardData(userId: string) {
  const resourceSelect = {
    id: true,
    type: true,
    title: true,
    description: true,
    url: true,
    createdBy: { select: { name: true } },
    mentee: { select: { id: true, name: true } },
  } as const;

  const [mentorship, pointSummary, goals, resourcesToMe] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        id: true,
        cycleStage: true,
        kickoffCompletedAt: true,
        mentor: { select: { id: true, name: true, email: true } },
        goalReviews: {
          where: { status: "APPROVED" },
          orderBy: { cycleNumber: "desc" },
          take: 4,
          select: {
            id: true,
            cycleNumber: true,
            cycleMonth: true,
            overallRating: true,
            overallComments: true,
            planOfAction: true,
            releasedToMenteeAt: true,
            goalRatings: {
              select: {
                rating: true,
                comments: true,
                goal: { select: { title: true } },
              },
            },
          },
        },
      },
    }),
    prisma.achievementPointSummary.findUnique({
      where: { userId },
      select: { totalPoints: true, currentTier: true },
    }),
    getGoalsForMentee(userId),
    prisma.mentorshipResource.findMany({
      where: {
        isPublished: true,
        OR: [
          { menteeId: userId },
          { mentorship: { menteeId: userId } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: resourceSelect,
    }),
  ]);

  return { mentorship, pointSummary, goals, resourcesToMe };
}


function AwardBar({ totalPoints, currentTier }: { totalPoints: number; currentTier: string | null }) {
  const nextTier = TIER_THRESHOLDS.find((t) => t.pts > totalPoints);
  const pct = nextTier ? Math.min(100, (totalPoints / nextTier.pts) * 100) : 100;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
        <span>
          {currentTier ? (
            <strong style={{ color: TIER_THRESHOLDS.find((t) => t.tier === currentTier)?.color }}>
              {TIER_THRESHOLDS.find((t) => t.tier === currentTier)?.label} Award
            </strong>
          ) : (
            <span style={{ color: "var(--muted)" }}>No tier yet</span>
          )}
        </span>
        <span style={{ color: "var(--muted)" }}>
          {totalPoints} pts{nextTier ? ` / ${nextTier.pts} for ${nextTier.label}` : " — Lifetime"}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--border, #e2e8f0)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--ypp-purple-600, #6b21c8)",
            borderRadius: 999,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export async function MenteeDashboard({ userId }: Props) {
  const [{ mentorship, pointSummary, goals, resourcesToMe }, leadership] =
    await Promise.all([
      loadMenteeDashboardData(userId),
      getLeadershipContext(userId),
    ]);

  if (!mentorship) {
    return (
      <EmptyStateEditorial
        title="Your pairing is on the way."
        body="You haven't been paired with an instructor mentor yet. Reach out to your chapter leadership and they'll match you. Until then, the leadership pathway is the same rubric you'll grow against."
        link={{ label: "See the leadership pathway", href: "/leadership-pathway" }}
      />
    );
  }

  const latestApprovedReview = mentorship.goalReviews[0] ?? null;
  const historyReviews = mentorship.goalReviews.slice(1);

  const nextAction = nextActionForInstructorMentee({
    hasMentor: true,
    cycleStage: mentorship.cycleStage ?? null,
    kickoffCompletedAt: mentorship.kickoffCompletedAt ?? null,
    hasGoals: goals.length > 0,
    hasReleasedReview: !!latestApprovedReview?.releasedToMenteeAt,
  });

  const stageAccent = leadership?.stage?.color.accent ?? undefined;
  const mentorForHero = leadership?.primaryMentor
    ? {
        name: leadership.primaryMentor.name,
        email: leadership.primaryMentor.email,
        roleLabel: leadership.primaryMentor.roleLabel,
      }
    : mentorship.mentor
      ? {
          name: mentorship.mentor.name,
          email: mentorship.mentor.email,
          roleLabel: null,
        }
      : null;

  return (
    <div style={{ display: "grid", gap: 32 }}>
      {leadership?.stageId && (
        <RoleStrip
          stageId={leadership.stageId}
          nextStageId={leadership.nextStageId}
          mentorName={leadership.primaryMentor?.name ?? null}
          mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
          showActions={false}
        />
      )}

      <CycleHeroCard
        action={nextAction}
        cycleStage={mentorship.cycleStage ?? null}
        mentor={mentorForHero}
        accentColor={stageAccent}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Goals — left column */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "20px 22px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            This month&apos;s goals
          </h3>
          {goals.length === 0 ? (
            <p
              style={{
                margin: "12px 0 0",
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              No goals are set yet. Your mentor will work with you to add goals
              to your Goals &amp; Resources document — once they&apos;re in
              place, they&apos;ll appear here with your progress and ratings.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "14px 0 0",
                display: "grid",
                gap: 10,
              }}
            >
              {goals.map((goal) => {
                const rating = latestApprovedReview?.goalRatings.find(
                  (gr) => gr.goal?.title === goal.title
                );
                return (
                  <li
                    key={goal.id}
                    style={{
                      padding: "10px 14px",
                      background: "var(--bg-2)",
                      borderLeft: rating
                        ? `3px solid ${RATING_COLOR[rating.rating]}`
                        : "3px solid var(--border)",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{goal.title}</div>
                      {goal.description && (
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
                          {goal.description}
                        </div>
                      )}
                    </div>
                    {rating && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: RATING_COLOR[rating.rating] + "22",
                          color: RATING_COLOR[rating.rating],
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {RATING_LABEL[rating.rating]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ marginTop: 14 }}>
            <Link
              href="/my-program/gr"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              Open Goals &amp; Resources →
            </Link>
          </div>
        </section>

        {/* Latest feedback + Resources — right column */}
        <div style={{ display: "grid", gap: 20 }}>
          {latestApprovedReview && (
            <section
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "20px 22px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Latest feedback
                </h3>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {new Date(latestApprovedReview.cycleMonth).toLocaleDateString(
                    "en-US",
                    { month: "long", year: "numeric" }
                  )}
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background:
                      RATING_COLOR[latestApprovedReview.overallRating] + "22",
                    color: RATING_COLOR[latestApprovedReview.overallRating],
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {RATING_LABEL[latestApprovedReview.overallRating]}
                </span>
              </div>
              {latestApprovedReview.overallComments && (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--text)",
                  }}
                >
                  {latestApprovedReview.overallComments}
                </p>
              )}
            </section>
          )}

          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Resources from your mentor
              </h3>
              <Link
                href="/mentor/resources"
                style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
              >
                Browse all →
              </Link>
            </div>
            {resourcesToMe.length === 0 ? (
              <p
                style={{
                  margin: "12px 0 0",
                  color: "var(--muted)",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                Items your mentor attaches to your G&amp;R or sends you directly
                will appear here.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "14px 0 0",
                  display: "grid",
                  gap: 10,
                }}
              >
                {resourcesToMe.map((resource) => (
                  <li
                    key={resource.id}
                    style={{
                      padding: "10px 14px",
                      background: "var(--bg-2)",
                      borderLeft: "3px solid var(--ypp-purple, #6b21c8)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "baseline",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {resource.url ? (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="link"
                          >
                            {resource.title}
                          </a>
                        ) : (
                          resource.title
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: "var(--surface)",
                          color: "var(--muted)",
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {MENTORSHIP_RESOURCE_TYPE_META[resource.type]?.label ??
                          resource.type}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Trajectory subsection — quieter, lower priority */}
      <section style={{ display: "grid", gap: 16 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Your trajectory
        </h3>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "20px 22px",
          }}
        >
          <AwardBar
            totalPoints={pointSummary?.totalPoints ?? 0}
            currentTier={pointSummary?.currentTier ?? null}
          />
        </div>

        {historyReviews.length > 0 && (
          <details
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: "16px 22px",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--muted)",
              }}
            >
              Past reviews ({historyReviews.length})
            </summary>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "14px 0 0",
                display: "grid",
                gap: 12,
              }}
            >
              {historyReviews.map((review) => (
                <li
                  key={review.id}
                  style={{
                    padding: "12px 14px",
                    background: "var(--bg-2)",
                    borderLeft: `3px solid ${RATING_COLOR[review.overallRating]}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>
                      {new Date(review.cycleMonth).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: RATING_COLOR[review.overallRating] + "22",
                        color: RATING_COLOR[review.overallRating],
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {RATING_LABEL[review.overallRating]}
                    </span>
                  </div>
                  {review.overallComments && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 13,
                        color: "var(--muted)",
                        lineHeight: 1.55,
                      }}
                    >
                      {review.overallComments.length > 180
                        ? review.overallComments.slice(0, 177) + "…"
                        : review.overallComments}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

