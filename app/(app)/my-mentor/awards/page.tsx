import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyAwardsData } from "@/lib/award-nomination-actions";
import { TIER_CONFIG } from "@/lib/award-tier-config";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getGrowthConnectLine } from "@/lib/growth-model";
import { LearnMore } from "@/components/mentorship/learn-more";
import skin from "@/components/ui-v2/portal-skin.module.css";
import {
  ButtonLink,
  CardV2,
  PageHeaderV2,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Awards — My development" };

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "LIFETIME"] as const;

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

export default async function MyMentorAwardsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getMyAwardsData();
  if (!data) redirect("/my-mentor");

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
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · My development"
        title="Awards"
        subtitle="A celebration of your consistency, growth, and reflection — not a grade."
        actions={
          <>
            {tierProgress.nextTier ? (
              <ButtonLink href="/my-mentor/reflection" size="sm">
                Submit this month&apos;s reflection →
              </ButtonLink>
            ) : null}
            <ButtonLink href="/my-mentor/progress" variant="secondary" size="sm">
              ← Progress & reviews
            </ButtonLink>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={currentTier ? "success" : "info"} withDot>
            {statusLabel}
          </StatusBadge>
          <p className="m-0 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
            {getGrowthConnectLine("awards")}
          </p>
        </div>
      </PageHeaderV2>

      <MyMentorSubnav />

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
        <h2 className="m-0 text-[16px] font-bold text-ink">
          Where your points came from ({pointLogs.length})
        </h2>
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
