import { redirect } from "next/navigation";

import type { GoalRatingColor } from "@prisma/client";

import {
  ButtonLink,
  CardV2,
  StatusBadge,
  buttonVariants,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import GRDocumentView from "@/components/gr/gr-document-view";
import { MilestoneToast } from "@/components/gr/milestone-toast";
import { RoleStrip } from "@/components/leadership-pathway/role-strip";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import { GoalsCalm, type CalmGoal } from "@/components/mentorship/calm";
import { ScheduleSurface } from "@/app/(app)/mentorship/schedule/schedule-surface";
import { getSessionUser } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { getUnseenMilestones } from "@/lib/milestones";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { getLeadershipContext } from "@/lib/leadership-context";
import { getGrowthConnectLine } from "@/lib/growth-model";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getSchedulePageData } from "@/lib/mentorship-scheduling-actions";
import { getMyAwardsData } from "@/lib/award-nomination-actions";
import { TIER_CONFIG } from "@/lib/award-tier-config";
import { isGamificationEnabled } from "@/lib/gamification-gate";
import { createMentorshipRequest } from "@/lib/mentorship-hub-actions";

/**
 * Self-only workspace pieces. The four-section workspace keeps the self POV's
 * extras here: the Goals section (the person's own G&R document), the help
 * card and milestone celebrations on Overview, the recognition collapse
 * (gamification-gated), and the booking surface embedded in Check-ins.
 * Each piece loads its own data, so a tab only pays for what it renders.
 */

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

function SectionIntro({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-ink">{title}</h2>
      {description ? (
        <p className="m-0 mt-1 text-[13px] text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}

/* ---------------------------------- Goals --------------------------------- */

export async function SelfGoalsSection() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login");

  const menteeRoleType = toMenteeRoleType(viewer.primaryRole ?? "");
  const [doc, leadership] = await Promise.all([
    menteeRoleType ? getMyGRDocument() : null,
    getLeadershipContext(viewer.id),
  ]);

  if (!doc) {
    return (
      <div className="flex flex-col gap-4">
        <SectionIntro title="Goals & Responsibilities" />
        {leadership?.stageId && (
          <RoleStrip
            stageId={leadership.stageId}
            nextStageId={leadership.nextStageId}
            mentorName={leadership.primaryMentor?.name ?? null}
            mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
          />
        )}
        <CardV2 padding="lg" className="text-center">
          <p className="m-0 text-[15px] font-semibold text-ink">
            Your goals aren&apos;t set up yet.
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            Once you&apos;re paired with a mentor, the two of you will set goals
            together here. There&apos;s nothing you need to do yet.
          </p>
        </CardV2>
      </div>
    );
  }

  if (doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL") {
    return (
      <div className="flex flex-col gap-4">
        <SectionIntro title="Goals & Responsibilities" />
        <CardV2 padding="lg" className="text-center">
          <StatusBadge tone={doc.status === "PENDING_APPROVAL" ? "warning" : "neutral"}>
            {doc.status === "PENDING_APPROVAL" ? "Being finalized" : "In progress"}
          </StatusBadge>
          <p className="mt-3 text-[15px] font-semibold text-ink">
            Your goals are being prepared.
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            Your mentor is finalizing your goals. You&apos;ll be notified once
            they&apos;re ready.
          </p>
        </CardV2>
      </div>
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    INSTRUCTOR: "Instructor",
    CHAPTER_PRESIDENT: "Chapter President",
    GLOBAL_LEADERSHIP: "Global Leadership",
  };

  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

  const ratingMap: Record<string, string> = {};
  if (doc.latestReview) {
    for (const gr of doc.latestReview.goalRatings) {
      if (gr.grDocumentGoalId) ratingMap[gr.grDocumentGoalId] = gr.rating;
    }
  }

  const serialized = {
    id: doc.id,
    templateTitle: doc.template.title,
    roleType: doc.template.roleType,
    roleMission: doc.roleMission,
    status: doc.status,
    roleStartDate: doc.roleStartDate.toISOString(),
    mentorName: doc.mentorship.mentor.name,
    mentorEmail: doc.mentorship.mentor.email,
    mentorInfo: doc.mentorInfo as Record<string, string> | null,
    officerInfo: doc.officerInfo as Record<string, string> | null,
    goalsByLifecycle: doc.goalsByLifecycle,
    currentPriorities: doc.currentPriorities
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
      .map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        priority: g.priority,
        progressState: g.progressState,
        dueDate: g.dueDate?.toISOString() ?? null,
        isOverdue: g.isOverdue,
        isDueSoon: g.isDueSoon,
        rating: (ratingMap[g.id] ?? null) as GoalRatingColor | null,
      })),
    goals: doc.goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      timePhase: g.timePhase,
      isCustom: g.isCustom,
      lifecycleStatus: g.lifecycleStatus,
      progressState: g.progressState,
      priority: g.priority,
      dueDate: g.dueDate?.toISOString() ?? null,
      completedAt: g.completedAt?.toISOString() ?? null,
      rating: (ratingMap[g.id] ?? null) as GoalRatingColor | null,
      ratingComments:
        doc.latestReview?.goalRatings.find((gr) => gr.grDocumentGoalId === g.id)?.comments ?? null,
      kpiValues: g.kpiValues.map((v) => ({
        value: v.value,
        measuredAt: v.measuredAt.toISOString(),
        notes: v.notes,
      })),
    })),
    successCriteria: doc.successCriteria.map((sc) => ({
      timePhase: sc.timePhase,
      criteria: sc.criteria,
    })),
    resources: doc.resources.map((r) => ({
      title: r.resource.title,
      url: r.resource.url,
      description: r.resource.description,
    })),
    plansOfAction: doc.plansOfAction.map((p) => ({
      cycleNumber: p.cycleNumber,
      content: p.content,
      updatedAt: p.updatedAt.toISOString(),
    })),
    latestReview: doc.latestReview
      ? {
          id: doc.latestReview.id,
          cycleMonth: doc.latestReview.cycleMonth.toISOString(),
          overallRating: doc.latestReview.overallRating,
          overallComments: doc.latestReview.overallComments,
          planOfAction: doc.latestReview.planOfAction,
          isQuarterly: doc.latestReview.isQuarterly,
          projectedFuturePath: doc.latestReview.projectedFuturePath,
          promotionReadiness: doc.latestReview.promotionReadiness,
          releasedToMenteeAt: doc.latestReview.releasedToMenteeAt?.toISOString() ?? null,
          goalRatings: doc.latestReview.goalRatings.map((gr) => ({
            grDocumentGoalId: gr.grDocumentGoalId,
            rating: gr.rating as GoalRatingColor,
            comments: gr.comments ?? null,
          })),
        }
      : null,
    nextMonthGoals: doc.nextMonthGoals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      priority: g.priority,
      dueDate: g.dueDate?.toISOString() ?? null,
    })),
    pastReviews: doc.pastReviews.map((r) => ({
      id: r.id,
      cycleMonth: r.cycleMonth.toISOString(),
      overallRating: r.overallRating,
      overallComments: r.overallComments,
      planOfAction: r.planOfAction,
      isQuarterly: r.isQuarterly,
      releasedToMenteeAt: r.releasedToMenteeAt?.toISOString() ?? null,
      goalRatings: r.goalRatings.map((gr) => ({
        grDocumentGoalId: gr.grDocumentGoalId,
        rating: gr.rating,
        comments: gr.comments,
      })),
      goalSnapshots: r.goalSnapshots.map((s) => ({
        id: s.id,
        grDocumentGoalId: s.grDocumentGoalId,
        title: s.title,
        description: s.description,
        timePhase: s.timePhase,
        priority: s.priority,
        lifecycleStatusAtSnapshot: s.lifecycleStatusAtSnapshot,
        dueDateAtSnapshot: s.dueDateAtSnapshot?.toISOString() ?? null,
      })),
    })),
    roleLabel: ROLE_LABELS[doc.template.roleType] ?? doc.template.roleType,
    ratingHistoryByGoal: doc.ratingHistoryByGoal,
  };

  // Calm lead: the few goals actually in motion, with their released rubric
  // color in supportive language; the full G&R document stays one toggle away.
  const calmGoals: CalmGoal[] = serialized.currentPriorities
    .filter((g) => g.progressState !== "DONE")
    .slice(0, 5)
    .map((g) => ({
      id: g.id,
      title: g.title,
      rating: g.rating,
      meta: g.dueDate
        ? `Due ${new Date(g.dueDate).toLocaleDateString()}`
        : g.progressState
          ? g.progressState.replace(/_/g, " ").toLowerCase()
          : null,
    }));

  return (
    <div className="flex flex-col gap-4">
      <SectionIntro title="Goals & Responsibilities" description={doc.template.title} />

      {leadership?.stageId && (
        <RoleStrip
          stageId={leadership.stageId}
          nextStageId={leadership.nextStageId}
          mentorName={leadership.primaryMentor?.name ?? null}
          mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
        />
      )}

      <p className="m-0 max-w-[64ch] text-[13px] leading-relaxed text-ink-muted">
        {getGrowthConnectLine("goals")}
      </p>

      <CalmOnly>
        <GoalsCalm goals={calmGoals} />
      </CalmOnly>

      <CalmCollapse label="Your full goals & resources" hint="every goal, KPIs, and history">
        <GRDocumentView document={serialized} isOwner={true} />
      </CalmCollapse>

      <LearnMore summary="What do these goal status colors mean?">
        <RatingLegend audience="mentee" />
      </LearnMore>
    </div>
  );
}

/* ----------------------- Milestones (Overview toast) ---------------------- */

/**
 * Unseen milestone celebrations, shown once on the person's own Overview.
 * Pure read at render; the toast marks rows seen only when dismissed.
 */
export async function SelfMilestones() {
  const viewer = await getSessionUser();
  if (!viewer) return null;
  const milestones = await getUnseenMilestones(viewer.id);
  if (milestones.length === 0) return null;
  return (
    <MilestoneToast
      milestones={milestones.map((m) => ({
        id: m.id,
        kind: m.kind,
        payload: (m.payload ?? {}) as Record<string, unknown>,
      }))}
    />
  );
}

/* ------------------- Booking surface (inside Check-ins) ------------------- */

/** The old Schedule tab, folded into Check-ins as a collapse. */
export async function SelfScheduleExtra({ reviewsHref }: { reviewsHref: string }) {
  const data = await getSchedulePageData();
  return (
    <CalmCollapse label="Book time with your mentor" hint="pick a slot that works">
      <ScheduleSurface data={data} reviewHref={reviewsHref} />
    </CalmCollapse>
  );
}

/* ------------------- Recognition (Overview, gamification) ----------------- */

/** Awards + points, dark until ENABLE_GAMIFICATION; one collapse on Overview. */
export async function SelfRecognitionCard({ reflectionHref }: { reflectionHref: string }) {
  if (!isGamificationEnabled()) return null;
  const data = await getMyAwardsData();
  if (!data) return null;
  return (
    <CalmCollapse label="Recognition" hint="awards, points, and how they grow">
      <AwardsBlock data={data} reflectionHref={reflectionHref} />
    </CalmCollapse>
  );
}

/* ------------------------------ Awards block ------------------------------ */

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "LIFETIME"] as const;

function AwardsBlock({
  data,
  reflectionHref,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getMyAwardsData>>>;
  reflectionHref: string;
}) {
  const { totalPoints, currentTier, pointLogs, nominations, tierProgress, volunteerHoursAwarded } =
    data;

  const approvedNominations = nominations.filter((n) => n.status === "APPROVED");
  const pendingNominations = nominations.filter(
    (n) => n.status === "PENDING_CHAIR" || n.status === "PENDING_BOARD"
  );

  const statusLabel = currentTier
    ? `${TIER_CONFIG[currentTier].label} Award · ${totalPoints} points`
    : tierProgress.nextTier
    ? `${totalPoints} points · ${tierProgress.pointsNeeded} to ${TIER_CONFIG[tierProgress.nextTier].label}`
    : `${totalPoints} points`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionIntro
          title="Awards"
          description="A celebration of your consistency, growth, and reflection — not a grade."
        />
        {tierProgress.nextTier ? (
          <ButtonLink href={reflectionHref} size="sm">
            Submit this month&apos;s reflection →
          </ButtonLink>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={currentTier ? "success" : "info"} withDot>
          {statusLabel}
        </StatusBadge>
        <p className="m-0 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
          {getGrowthConnectLine("awards")}
        </p>
      </div>

      {volunteerHoursAwarded > 0 && (
        <CardV2 padding="md" className="border-l-4 border-l-complete-700">
          <p className="m-0 text-[14px] font-bold text-complete-700">
            {volunteerHoursAwarded} volunteer hours recognized
          </p>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
            Based on your {currentTier ? TIER_CONFIG[currentTier].label : ""} Achievement
            Award tier
          </p>
        </CardV2>
      )}

      {/* Points + next-tier progress */}
      <div className="grid gap-4 md:grid-cols-2">
        <CardV2 padding="md">
          <p className="m-0 text-[13.5px] font-semibold text-ink">
            Recognition points earned
          </p>
          <p className="m-0 mt-1 text-[30px] font-bold leading-none text-brand-700">
            {totalPoints}
          </p>
          {currentTier ? (
            <div className="mt-2.5">
              <StatusBadge tone="brand" withDot>
                {TIER_CONFIG[currentTier].label} Award
              </StatusBadge>
            </div>
          ) : (
            <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
              Your first award tier is just ahead — keep going.
            </p>
          )}
        </CardV2>

        <CardV2 padding="md">
          <p className="m-0 text-[13.5px] font-semibold text-ink">
            {tierProgress.nextTier
              ? `On your way to ${TIER_CONFIG[tierProgress.nextTier].label}`
              : "Every tier reached!"}
          </p>
          {tierProgress.nextTier ? (
            <>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand-50">
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
                  style={{ width: `${tierProgress.progressPct}%` }}
                />
              </div>
              <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                <strong className="text-ink">{tierProgress.progressPct}%</strong> there —{" "}
                {tierProgress.pointsNeeded} more points reach{" "}
                {TIER_CONFIG[tierProgress.nextTier].label}. Submitting your reflection and
                meeting with your mentor each cycle is the surest way to get there.
              </p>
            </>
          ) : (
            <p className="m-0 mt-2 text-[13px] font-semibold text-complete-700">
              You&apos;ve earned the Lifetime Achievement Award.
            </p>
          )}
        </CardV2>
      </div>

      {/* Tier roadmap */}
      <CardV2 padding="md">
        <p className="m-0 text-[13.5px] font-semibold text-ink">Award tiers</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIER_ORDER.map((tier) => {
            const cfg = TIER_CONFIG[tier];
            const isEarned = approvedNominations.some((n) => n.tier === tier);
            const isPending = pendingNominations.some((n) => n.tier === tier);
            const isReached = totalPoints >= cfg.min;
            return (
              <div
                key={tier}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[10px] border px-2 py-3 text-center",
                  isEarned
                    ? "border-brand-400 bg-brand-50"
                    : isPending
                    ? "border-progress-700/40 bg-progress-50"
                    : isReached
                    ? "border-brand-300 bg-surface"
                    : "border-line bg-surface"
                )}
              >
                <span
                  className={cn(
                    "text-[13px] font-bold",
                    isEarned ? "text-brand-800" : "text-ink"
                  )}
                >
                  {cfg.label}
                </span>
                <span className="text-[11.5px] text-ink-muted">{cfg.min}+ pts</span>
                {isEarned && <StatusBadge tone="success">Earned</StatusBadge>}
                {isPending && !isEarned && (
                  <StatusBadge tone="warning">Being confirmed</StatusBadge>
                )}
              </div>
            );
          })}
        </div>
      </CardV2>

      {/* Nominations (recognition in progress) */}
      {nominations.length > 0 && (
        <CardV2 padding="md">
          <p className="m-0 text-[14px] font-bold text-ink">Awards in progress</p>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            When you reach a tier, your mentor or chair confirms it. Anything marked
            &quot;being confirmed&quot; is on its way — nothing more is needed from you.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {nominations.map((n) => {
              const cfg = TIER_CONFIG[n.tier];
              const isApproved = n.status === "APPROVED";
              return (
                <div
                  key={n.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-l-4 border-l-brand-600 bg-surface-soft px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="brand">{cfg.label}</StatusBadge>
                      <StatusBadge tone={isApproved ? "success" : "warning"}>
                        {isApproved ? "Confirmed" : "Being confirmed"}
                      </StatusBadge>
                    </div>
                    <p className="m-0 mt-1 text-[12px] text-ink-muted">
                      Recognized by {n.nominatorName} ·{" "}
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {n.boardApprovedAt && (
                    <p className="m-0 text-[12px] text-ink-muted">
                      {new Date(n.boardApprovedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardV2>
      )}

      {/* Points history — framed as a record of recognition */}
      <section className="flex flex-col gap-3">
        <h3 className="m-0 text-[15px] font-bold text-ink">
          Where your points came from ({pointLogs.length})
        </h3>
        {pointLogs.length === 0 ? (
          <CardV2 padding="lg" className="text-center">
            <p className="m-0 text-[15px] font-semibold text-ink">
              Your recognition story starts soon
            </p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
              Once your mentor&apos;s first monthly review is approved, you&apos;ll start
              seeing points here. The best next step is to keep your reflection and
              check-ins up to date.
            </p>
          </CardV2>
        ) : (
          <CardV2 padding="none" className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line-soft">
                  <th className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                    Cycle
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                    Recognition
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                    Points
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                    Month
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft/70">
                {pointLogs.map((log) => {
                  const cfg = getGoalRatingCopy(log.overallRating);
                  return (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 text-[13px] font-medium text-ink">
                        Cycle {log.cycleNumber}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          tone={RATING_TONE[String(log.overallRating)] ?? "info"}
                          title={cfg.menteeDescription}
                        >
                          {cfg.menteeLabel}
                        </StatusBadge>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-[13px] font-bold",
                          log.points > 0 ? "text-complete-700" : "text-ink-muted"
                        )}
                      >
                        +{log.points}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-ink-muted">
                        {new Date(log.cycleMonth).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardV2>
        )}
      </section>

      <LearnMore summary="How recognition works">
        <p className="m-0 text-[13px] leading-relaxed">
          Every time your mentor&apos;s monthly review is approved, you earn achievement
          points that recognize the work you&apos;ve put in — showing up, reflecting
          honestly, and making progress on your goals. As points add up, you reach award
          tiers. There&apos;s no penalty for a slower month; points only ever move
          forward.
        </p>
      </LearnMore>
    </div>
  );
}

/* ------------------------------ Help / support ---------------------------- */

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

/** The old /my-mentor/help page, folded to the bottom of the self overview. */
export function SelfHelpCard({
  returnHref,
  sent,
  scheduleHref,
  goalsHref,
  resourcesHref,
}: {
  /** Where to land (with `sent=1`) after the request is submitted. */
  returnHref: string;
  sent: boolean;
  scheduleHref: string;
  goalsHref: string;
  resourcesHref: string;
}) {
  async function submitHelpRequest(formData: FormData) {
    "use server";
    await createMentorshipRequest(formData);
    redirect(`${returnHref}${returnHref.includes("?") ? "&" : "?"}sent=1`);
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionIntro
        title="Get help"
        description="Stuck or unsure? Reaching out is always the right move."
      />

      {sent && (
        <CardV2 padding="md" className="border-l-4 border-l-complete-700 bg-complete-50">
          <p className="m-0 text-[13px] font-semibold text-complete-700">
            Sent to your mentor. They&apos;ll follow up with you — no need to do anything
            else right now.
          </p>
        </CardV2>
      )}

      <CardV2 padding="md">
        <h3 className="m-0 text-[15px] font-bold text-ink">Quick ways to get unstuck</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={scheduleHref} variant="secondary" size="sm">
            Schedule time with your mentor
          </ButtonLink>
          <ButtonLink href={goalsHref} variant="secondary" size="sm">
            Review your goals
          </ButtonLink>
          <ButtonLink href={resourcesHref} variant="secondary" size="sm">
            Browse your resources
          </ButtonLink>
        </div>
      </CardV2>

      <CardV2 padding="md">
        <div>
          <h3 className="m-0 text-[15px] font-bold text-ink">Ask your mentor a question</h3>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            This goes privately to your mentor. There&apos;s no wrong question — asking
            early is a sign of a strong instructor, not a struggling one.
          </p>
        </div>
        <form action={submitHelpRequest} className="mt-4 grid gap-3">
          <input type="hidden" name="visibility" value="PRIVATE" />
          <input type="hidden" name="kind" value="GENERAL_QNA" />
          <label className="grid gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink">
              What do you need help with?
            </span>
            <input
              name="title"
              required
              maxLength={140}
              placeholder="e.g. I'm not sure how to plan my next session"
              className={inputCls}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink">
              Add any details (optional)
            </span>
            <textarea
              name="details"
              rows={4}
              placeholder="The more context you share, the better your mentor can help."
              className={cn(inputCls, "resize-y")}
            />
          </label>
          <div>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "primary", size: "md" }))}
            >
              Send to my mentor
            </button>
          </div>
        </form>
      </CardV2>

      <CardV2 padding="md" className="bg-surface-soft">
        <p className="m-0 text-[12.5px] text-ink-muted">
          <strong className="text-ink">Who sees this?</strong> Only your mentor (and
          program admins, if it needs escalation). It is never shown to other instructors
          or students.
        </p>
      </CardV2>
    </div>
  );
}
