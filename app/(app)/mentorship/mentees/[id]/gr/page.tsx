import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { hasMentorshipMenteeAccess } from "@/lib/mentorship-access";
import { prisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/format-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import type { GoalRatingColor, GRTimePhase } from "@prisma/client";
import { ProposeChangeForm } from "./propose-change-form";

export const metadata = { title: "Mentee G&R — Mentor View" };

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  GLOBAL_LEADERSHIP: "Global Leadership",
};

const TIME_PHASE_LABELS: Record<GRTimePhase, string> = {
  MONTHLY: "This cycle (monthly)",
  FIRST_MONTH: "First month",
  FIRST_QUARTER: "First quarter (90 days)",
  LONG_TERM: "Long-term",
  FULL_YEAR: "Long-term",
};

// Which phases count as "near-term and primary" vs "long-term, collapsed".
const PRIMARY_PHASES: GRTimePhase[] = ["MONTHLY", "FIRST_MONTH", "FIRST_QUARTER"];
const LONG_TERM_PHASES: GRTimePhase[] = ["LONG_TERM", "FULL_YEAR"];

const DOC_STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#f1f5f9", fg: "#475569", label: "Draft" },
  PENDING_APPROVAL: { bg: "#fef9c3", fg: "#854d0e", label: "Pending approval" },
  ACTIVE: { bg: "#dcfce7", fg: "#166534", label: "Active" },
  COMPLETED: { bg: "#e0e7ff", fg: "#3730a3", label: "Completed" },
};

type PageProps = { params: Promise<{ id: string }> };

export default async function MentorMenteeGRPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewerId = session.user.id;
  const viewerRoles = session.user.roles ?? [];
  const { id: menteeId } = await params;

  // Mentee viewing themselves should use their own G&R page instead.
  if (viewerId === menteeId) {
    redirect("/my-program/gr");
  }

  const hasAccess = await hasMentorshipMenteeAccess(viewerId, viewerRoles, menteeId);
  if (!hasAccess) notFound();

  const [mentee, mentorship, doc] = await Promise.all([
    prisma.user.findUnique({
      where: { id: menteeId },
      select: { id: true, name: true, email: true, primaryRole: true },
    }),
    prisma.mentorship.findFirst({
      where: { menteeId, status: "ACTIVE" },
      select: {
        id: true,
        cycleStage: true,
        kickoffCompletedAt: true,
        mentor: { select: { id: true, name: true, email: true } },
        chair: { select: { id: true, name: true } },
      },
    }),
    prisma.gRDocument.findFirst({
      where: { userId: menteeId, status: { in: ["DRAFT", "PENDING_APPROVAL", "ACTIVE"] } },
      include: {
        template: { select: { title: true, roleType: true } },
        goals: {
          where: { lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] } },
          orderBy: [{ timePhase: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { sortOrder: "asc" }],
        },
        successCriteria: { orderBy: { timePhase: "asc" } },
        resources: {
          include: { resource: { select: { title: true, url: true, description: true } } },
          orderBy: { sortOrder: "asc" },
        },
        plansOfAction: { orderBy: { cycleNumber: "desc" }, take: 1 },
      },
    }),
  ]);

  if (!mentee) notFound();

  const isAdmin = viewerRoles.includes("ADMIN");
  const isChapterPresident = viewerRoles.includes("CHAPTER_PRESIDENT");
  const backHref = `/mentorship/mentees/${menteeId}`;

  // Latest released review (for ratings context on goals)
  const latestReview = doc
    ? await prisma.mentorGoalReview.findFirst({
        where: {
          mentorshipId: doc.mentorshipId,
          releasedToMenteeAt: { not: null },
        },
        orderBy: { cycleMonth: "desc" },
        select: {
          id: true,
          cycleMonth: true,
          overallRating: true,
          overallComments: true,
          planOfAction: true,
          goalRatings: {
            select: { grDocumentGoalId: true, rating: true, comments: true },
          },
        },
      })
    : null;

  const ratingByGoalId: Record<string, { rating: GoalRatingColor; comments: string | null }> = {};
  for (const r of latestReview?.goalRatings ?? []) {
    if (r.grDocumentGoalId) {
      ratingByGoalId[r.grDocumentGoalId] = { rating: r.rating, comments: r.comments };
    }
  }

  type DocGoal = NonNullable<typeof doc>["goals"][number];
  const goalsByPhase: Record<GRTimePhase, DocGoal[]> = {
    MONTHLY: [],
    FIRST_MONTH: [],
    FIRST_QUARTER: [],
    LONG_TERM: [],
    FULL_YEAR: [],
  };
  if (doc) {
    for (const g of doc.goals) {
      goalsByPhase[g.timePhase].push(g);
    }
  }
  const primaryGoals = PRIMARY_PHASES.flatMap((p) => goalsByPhase[p]);
  const longTermGoals = LONG_TERM_PHASES.flatMap((p) => goalsByPhase[p]);

  const menteeRoleLabel = mentee.primaryRole ? ROLE_LABELS[mentee.primaryRole] ?? formatEnum(mentee.primaryRole) : "—";
  const menteeName = mentee.name ?? mentee.email ?? "this mentee";

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={backHref} style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to {menteeName}
          </Link>
          <p className="badge">Mentor view</p>
          <h1 className="page-title">{menteeName}'s Goals &amp; Resources</h1>
          <p className="page-subtitle">
            {menteeRoleLabel}
            {mentorship?.mentor?.name ? ` · Mentored by ${mentorship.mentor.name}` : " · No active pairing"}
            {mentorship?.chair?.name ? ` · Chair ${mentorship.chair.name}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={backHref} className="button secondary small">
            Back to mentee
          </Link>
          {isAdmin && (
            <Link href="/admin/mentorship?tab=templates" className="button secondary small">
              Edit G&amp;R (admin) →
            </Link>
          )}
          <Link
            href="#propose-change"
            className="button primary small"
            aria-disabled={!doc}
            style={!doc ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          >
            Propose change
          </Link>
        </div>
      </div>

      {!doc ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>No G&amp;R has been created for this mentee yet.</h3>
          <p style={{ color: "var(--muted)", maxWidth: 520, margin: "0 auto 1.25rem" }}>
            A Goals &amp; Resources document is assigned at kickoff. Once it's in
            place you'll be able to see the mentee's 90-day, annual, and
            multi-year goals here, along with the latest plan of action.
          </p>
          {isAdmin ? (
            <Link href="/admin/mentorship?tab=templates" className="button primary">
              Assign a G&amp;R template →
            </Link>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              An admin will assign a G&amp;R template to this mentee.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Document summary */}
          <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 4 }}>
                Template
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{doc.template.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
                Role start · {new Date(doc.roleStartDate).toLocaleDateString()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                className="badge"
                style={{
                  background: DOC_STATUS_STYLE[doc.status]?.bg ?? "#f1f5f9",
                  color: DOC_STATUS_STYLE[doc.status]?.fg ?? "#475569",
                }}
              >
                {DOC_STATUS_STYLE[doc.status]?.label ?? doc.status}
              </span>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                {doc.goals.length} active goal{doc.goals.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {/* Role mission */}
          {doc.roleMission && (
            <div className="card">
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6 }}>
                Role mission
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{doc.roleMission}</p>
            </div>
          )}

          {/* Near-term goals (monthly + first month + first quarter) — primary focus */}
          <GoalsBlock
            heading="Near-term goals"
            subtitle="Monthly, first-month, and first-quarter goals -- what the mentee is working on right now."
            goals={primaryGoals}
            ratingByGoalId={ratingByGoalId}
            primary
          />

          {/* Long-term goals collapsed */}
          {longTermGoals.length > 0 && (
            <details className="card">
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.95rem" }}>
                Long-term goals ({longTermGoals.length})
              </summary>
              <div style={{ marginTop: 14 }}>
                <GoalsBlock
                  heading="Long-term"
                  goals={longTermGoals}
                  ratingByGoalId={ratingByGoalId}
                  flat
                />
              </div>
            </details>
          )}

          {/* Success criteria */}
          {doc.successCriteria.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Success criteria</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {doc.successCriteria.map((sc) => (
                  <div
                    key={sc.id}
                    style={{
                      padding: "0.6rem 0.8rem",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md, 8px)",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                      {TIME_PHASE_LABELS[sc.timePhase]}
                    </div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{sc.criteria}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest plan of action */}
          {doc.plansOfAction[0] && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>Plan of action</div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Cycle {doc.plansOfAction[0].cycleNumber} · updated{" "}
                  {new Date(doc.plansOfAction[0].updatedAt).toLocaleDateString()}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {doc.plansOfAction[0].content}
              </p>
            </div>
          )}

          {/* Resources */}
          {doc.resources.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Resources</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {doc.resources.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "0.6rem 0.8rem",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md, 8px)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {r.resource.url ? (
                        <a href={r.resource.url} target="_blank" rel="noreferrer" className="link">
                          {r.resource.title}
                        </a>
                      ) : (
                        r.resource.title
                      )}
                    </div>
                    {r.resource.description && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                        {r.resource.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest review context */}
          {latestReview && (() => {
            const ratingCopy = getGoalRatingCopy(latestReview.overallRating);
            return (
            <div className="card" style={{ borderLeft: `3px solid ${ratingCopy.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>Latest released review</div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {new Date(latestReview.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.72rem",
                    padding: "2px 9px",
                    borderRadius: 999,
                    background: ratingCopy.background,
                    color: ratingCopy.color,
                    fontWeight: 700,
                  }}
                >
                  Overall - {ratingCopy.label}
                </span>
              </div>
              {latestReview.overallComments && (
                <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                  {latestReview.overallComments}
                </p>
              )}
              {latestReview.planOfAction && (
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                  <strong style={{ color: "inherit" }}>Plan for next cycle:</strong> {latestReview.planOfAction}
                </p>
              )}
            </div>
            );
          })()}

          {/* Propose a G&R change */}
          <details id="propose-change" className="card" style={{ scrollMarginTop: 80 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.95rem" }}>
              Propose a G&amp;R change
            </summary>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Suggest a new goal, an edit to an existing one, or removal of a goal that's no
              longer relevant. An admin reviews every proposal before it changes the document.
            </p>
            <ProposeChangeForm
              documentId={doc.id}
              goals={doc.goals.map((g) => ({
                id: g.id,
                title: g.title,
                timePhase: TIME_PHASE_LABELS[g.timePhase] ?? g.timePhase,
              }))}
              sourceReviewId={latestReview?.id ?? null}
            />
          </details>
        </div>
      )}

      {isChapterPresident && !isAdmin && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 18 }}>
          You're viewing this G&amp;R as chapter leadership. Goal edits go through admin or the mentor's monthly review.
        </p>
      )}
    </div>
  );
}

type GoalRow = {
  id: string;
  title: string;
  description: string;
  priority: string;
  progressState: string;
  timePhase: GRTimePhase;
  dueDate: Date | null;
};

function GoalsBlock({
  heading,
  subtitle,
  goals,
  ratingByGoalId,
  primary,
  flat,
}: {
  heading: string;
  subtitle?: string;
  goals: GoalRow[];
  ratingByGoalId: Record<string, { rating: GoalRatingColor; comments: string | null }>;
  primary?: boolean;
  flat?: boolean;
}) {
  const containerClass = flat ? "" : "card";

  if (goals.length === 0) {
    return (
      <div className={containerClass}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{heading}</div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
          No goals at this time horizon yet.
        </p>
      </div>
    );
  }

  return (
    <div className={containerClass} style={primary ? { borderLeft: "4px solid var(--ypp-purple, #6b21c8)" } : undefined}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>{heading}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {goals.map((g) => {
          const r = ratingByGoalId[g.id];
          const ratingCopy = r ? getGoalRatingCopy(r.rating) : null;
          return (
            <div
              key={g.id}
              style={{
                padding: "0.7rem 0.9rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-md, 8px)",
                borderLeft: ratingCopy ? `3px solid ${ratingCopy.color}` : "3px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{g.title}</div>
                  {g.description && (
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                      {g.description}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  {r && (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: ratingCopy?.background,
                        color: ratingCopy?.color,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ratingCopy?.label}
                    </span>
                  )}
                  <span className="pill" style={{ fontSize: "0.65rem" }}>
                    {TIME_PHASE_LABELS[g.timePhase] ?? g.timePhase}
                  </span>
                  <span className="pill" style={{ fontSize: "0.65rem" }}>
                    {formatEnum(g.progressState)}
                  </span>
                  {g.dueDate && (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      Due {new Date(g.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {r?.comments && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5, fontStyle: "italic" }}>
                  Mentor note: {r.comments}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
