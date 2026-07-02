import Link from "next/link";

import type { GoalRatingColor } from "@prisma/client";

import { ButtonLink, CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { prisma } from "@/lib/prisma";
import { getMenteeCycleState } from "@/lib/mentorship-cycle";
import { getMyReleasedCoachingPlan } from "@/lib/mentorship/person-extras";
import { getMyMentorshipActionItems } from "@/lib/people-strategy/mentorship-my-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

const RATING_TONE: Record<GoalRatingColor, StatusTone> = {
  BEHIND_SCHEDULE: "danger",
  GETTING_STARTED: "warning",
  ACHIEVED: "success",
  ABOVE_AND_BEYOND: "brand",
};

/**
 * Mentee POV — "My Development" at /mentorship. The supportive brief: who
 * mentors you, what you owe this cycle, the latest released feedback and
 * coaching plan, and the next steps you own. Deep work happens on the
 * existing detail surfaces (/my-mentor/*, /my-program/*); this is the calm
 * front door that always says what to do next.
 */

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function monthLabelUTC(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

type MenteeNextStep = {
  title: string;
  detail: string;
  cta: { label: string; href: string } | null;
  tone: "warning" | "info" | "success" | "neutral";
};

function menteeNextStep(
  state: Awaited<ReturnType<typeof getMenteeCycleState>>,
  hasMentor: boolean
): MenteeNextStep {
  if (!hasMentor) {
    return {
      title: "You don't have a mentor yet.",
      detail:
        "Leadership pairs every instructor and officer with a mentor. Until yours is assigned, the leadership pathway shows what you're working toward.",
      cta: { label: "See the leadership pathway", href: "/leadership-pathway" },
      tone: "info",
    };
  }
  if (!state.reflectionSubmitted) {
    return {
      title: `Your ${state.cycleLabel} reflection is ${state.isOverdue ? "overdue" : "due"}.`,
      detail: `Self-input comes first: your reflection is what your mentor's review builds on. Soft deadline ${DATE_FMT.format(state.softDeadline)}.`,
      cta: { label: "Submit this month's reflection", href: "/my-mentor/reflection" },
      tone: state.isOverdue ? "warning" : "info",
    };
  }
  if (!state.reviewReleased) {
    return {
      title: "Reflection in — your review is being written.",
      detail:
        "Your mentor writes the review, a chair approves it, and it's released to you with a plan of action. Nothing you owe right now.",
      cta: null,
      tone: "success",
    };
  }
  return {
    title: `Your ${state.cycleLabel} review is released.`,
    detail: "Read the feedback and the plan of action, then work the next steps below.",
    cta: { label: "Read your released review", href: "/my-mentor/progress" },
    tone: "success",
  };
}

const DRILL_DOWNS: Array<{ label: string; href: string; blurb: string }> = [
  { label: "Goals & Responsibilities", href: "/my-mentor/goals", blurb: "Your role charter and goals" },
  { label: "Progress & reviews", href: "/my-mentor/progress", blurb: "Released reviews and trajectory" },
  { label: "Monthly reflection", href: "/my-mentor/reflection", blurb: "Submit or revisit self-input" },
  { label: "Schedule time", href: "/my-mentor/schedule", blurb: "Book time with your mentor" },
  { label: "Resources", href: "/my-mentor/resources", blurb: "What your mentor shared" },
  { label: "Awards", href: "/my-mentor/awards", blurb: "Recognition and points" },
  { label: "Get help", href: "/my-mentor/help", blurb: "Ask your mentor or the program for support" },
];

export async function MenteeDevelopmentBrief({ userId }: { userId: string }) {
  const [state, mentorship, plan, actions] = await Promise.all([
    getMenteeCycleState(userId),
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: {
        mentor: { select: { name: true, email: true } },
        sessions: {
          where: { scheduledAt: { gte: new Date() }, cancelledAt: null },
          orderBy: { scheduledAt: "asc" },
          take: 1,
          select: { title: true, scheduledAt: true },
        },
      },
    }),
    getMyReleasedCoachingPlan(userId),
    getMyMentorshipActionItems(userId),
  ]);

  const mentorName = mentorship?.mentor
    ? mentorship.mentor.name || mentorship.mentor.email
    : null;
  const nextSession = mentorship?.sessions[0] ?? null;
  const next = menteeNextStep(state, mentorName != null);
  const myActions = actions.slice(0, 6);

  return (
    <div className="grid gap-6">
      {/* Mission brief — one next step, never a wall of tables. */}
      <CardV2 padding="md" className="border-l-4 border-l-brand-600">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              Your next step
            </p>
            <h2 className="m-0 mt-1 text-[16px] font-bold text-ink">{next.title}</h2>
            <p className="m-0 mt-1 max-w-xl text-[13px] text-ink-muted">{next.detail}</p>
          </div>
          {next.cta ? (
            <ButtonLink href={next.cta.href} size="sm">
              {next.cta.label}
            </ButtonLink>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-ink-muted">
          <span>
            Mentor:{" "}
            <strong className="text-ink">{mentorName ?? "Not assigned yet"}</strong>
          </span>
          <span>
            Cycle: <strong className="text-ink">{state.cycleLabel}</strong>
          </span>
          {nextSession ? (
            <span>
              Next session:{" "}
              <strong className="text-ink">
                {DATE_FMT.format(nextSession.scheduledAt)} · {nextSession.title}
              </strong>
            </span>
          ) : null}
        </div>
      </CardV2>

      {/* Latest released feedback + coaching plan. */}
      {plan ? (
        <CardV2 padding="md">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-[13.5px] font-bold text-ink">
              Your coaching plan — {monthLabelUTC(plan.cycleMonth)}
            </h3>
            <StatusBadge tone={RATING_TONE[plan.overallRating]}>
              {getGoalRatingCopy(plan.overallRating).menteeLabel}
            </StatusBadge>
          </div>
          <p className="m-0 mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">
            {plan.planOfAction}
          </p>
          <p className="m-0 mt-2 text-[12px] text-ink-muted">
            From {plan.mentorName}&apos;s released review.{" "}
            <Link href="/my-mentor/progress" className="font-semibold text-brand-700 hover:underline">
              Read the full review →
            </Link>
          </p>
        </CardV2>
      ) : null}

      {/* Actions & follow-ups you own (canonical action system). */}
      <CardV2 padding="md">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-[13.5px] font-bold text-ink">Next steps you own</h3>
          <Link
            href="/actions?who=me"
            className="text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            All my actions →
          </Link>
        </div>
        {myActions.length === 0 ? (
          <p className="m-0 mt-2 text-[13px] text-ink-muted">
            Nothing open from your mentorship — new next steps land here after
            sessions and reviews.
          </p>
        ) : (
          <ul className="m-0 mt-2 list-none divide-y divide-line-soft/70 p-0">
            {myActions.map((action) => (
              <li key={action.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 text-[13px] text-ink">{action.title}</span>
                {action.dueAt ? (
                  <span className="shrink-0 text-[12px] text-ink-muted">
                    due {DATE_FMT.format(action.dueAt)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardV2>

      {/* Drill-downs into the existing detail surfaces. */}
      <section aria-label="Your development spaces">
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {DRILL_DOWNS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-[12px] border border-line-soft bg-surface px-4 py-3 no-underline shadow-card transition-[border-color] hover:border-brand-300"
              >
                <span className="block text-[13.5px] font-semibold text-ink">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-muted">{item.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
