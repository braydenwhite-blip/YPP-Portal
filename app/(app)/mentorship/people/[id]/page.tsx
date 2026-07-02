import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DevelopmentRecordView } from "@/components/development/development-record";
import { StartReviewButton } from "@/components/mentorship/start-review-button";
import { CardV2, StatusBadge } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { loadDevelopmentRecord } from "@/lib/development/record";
import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";
import { STAGE_META } from "@/lib/mentorship/cycle-constants";
import { loadParticipationsForUser } from "@/lib/mentorship/cycle-load";
import { getLatestCoachingPlan } from "@/lib/mentorship/person-extras";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Development record — Pathways Portal" };

const TONE_TO_BADGE = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
} as const;

function monthLabelUTC(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * One person's full development story inside the mentorship hub: the record
 * (facts, signals, timeline, open work) plus the coaching plan, active review
 * cycles, and a one-click individual review launch.
 */
export default async function MentorshipPersonPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!(await hasMentorshipCommandAccess(session.user))) redirect("/mentorship");

  const [record, plan, participations] = await Promise.all([
    loadDevelopmentRecord(params.id),
    getLatestCoachingPlan(params.id),
    loadParticipationsForUser(params.id),
  ]);
  if (!record) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-1 pb-12 pt-4">
      <div className="flex justify-end">
        <StartReviewButton userId={params.id} />
      </div>

      {participations.length > 0 ? (
        <CardV2 padding="md">
          <h3 className="m-0 text-[13.5px] font-bold text-ink">Active review cycles</h3>
          <ul className="m-0 mt-2 list-none divide-y divide-line-soft/70 p-0">
            {participations.map((p) => (
              <li key={p.cycleId} className="flex flex-col gap-0.5 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/mentorship/cycles/${p.cycleId}`}
                    className="text-[13px] font-semibold text-ink hover:text-brand-700 hover:underline"
                  >
                    {p.cycleName}
                  </Link>
                  <StatusBadge tone={TONE_TO_BADGE[STAGE_META[p.stage].tone]}>
                    {STAGE_META[p.stage].label}
                  </StatusBadge>
                </div>
                <p className="m-0 text-[12px] text-ink-muted">
                  {STAGE_META[p.stage].blurb}
                </p>
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      {plan ? (
        <CardV2 padding="md">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-[13.5px] font-bold text-ink">
              Coaching plan — {monthLabelUTC(plan.cycleMonth)}
            </h3>
            <div className="flex items-center gap-2">
              <StatusBadge
                tone={
                  plan.overallRating === "BEHIND_SCHEDULE"
                    ? "danger"
                    : plan.overallRating === "GETTING_STARTED"
                      ? "warning"
                      : plan.overallRating === "ACHIEVED"
                        ? "success"
                        : "brand"
                }
              >
                {getGoalRatingCopy(plan.overallRating).label}
              </StatusBadge>
              {plan.releasedToMenteeAt == null ? (
                <StatusBadge tone="neutral">Not yet released</StatusBadge>
              ) : null}
            </div>
          </div>
          <p className="m-0 mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">
            {plan.planOfAction}
          </p>
          <p className="m-0 mt-2 text-[12px] text-ink-muted">
            From {plan.mentorName}&apos;s approved monthly review.
          </p>
        </CardV2>
      ) : null}

      <DevelopmentRecordView record={record} />
    </div>
  );
}
