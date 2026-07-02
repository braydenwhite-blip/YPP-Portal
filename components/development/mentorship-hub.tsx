import Link from "next/link";

import {
  ButtonLink,
  FilterBar,
  FilterChipLink,
  RecordSection,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import type { MenteeHomeData, MentorConsoleData } from "@/lib/development/hub-load";
import { countWaitingOnMe, HUB_VIEW_META, type HubView } from "@/lib/development/hub";
import type { DevelopmentSignalTone } from "@/lib/development/signals";

import { ContributorFeedbackForm, SelfInputForm } from "./cycle-forms";

/**
 * Mentorship hub — the three perspective bodies. One calm column each:
 * the mentee's "My development", the mentor's console, and (rendered by the
 * page via DevelopmentCockpit) leadership oversight. Server components; the
 * only client islands are the input forms.
 */

const SIGNAL_TONE_TO_BADGE: Record<DevelopmentSignalTone, StatusTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
};

// ── Perspective switcher ─────────────────────────────────────────────────────

export function HubSwitcher({
  views,
  active,
}: {
  views: HubView[];
  active: HubView;
}) {
  if (views.length < 2) return null;
  return (
    <FilterBar aria-label="Perspective">
      {views.map((view) => (
        <FilterChipLink
          key={view}
          href={view === "admin" ? "/mentorship?view=admin" : `/mentorship?view=${view}`}
          active={view === active}
        >
          {HUB_VIEW_META[view].label}
        </FilterChipLink>
      ))}
    </FilterBar>
  );
}

// ── Mentee home ("My development") ───────────────────────────────────────────

function SummaryBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </p>
      <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
        {body}
      </p>
    </div>
  );
}

export function MenteeHomeView({ data }: { data: MenteeHomeData }) {
  const waiting = countWaitingOnMe({
    selfInputs: data.input.selfInputs,
    feedbackRequests: data.input.feedbackRequests,
  });
  const latestSummary = data.input.releasedSummaries[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Mentor card */}
      <section className="flex flex-col gap-3 rounded-[12px] border border-line-soft bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-muted">
            Your mentor
          </p>
          {data.mentor ? (
            <>
              <p className="m-0 mt-1 text-[16px] font-bold text-ink">
                {data.mentor.name}
                <span className="ml-2 text-[12.5px] font-medium text-ink-muted">
                  {data.mentor.roleLabel}
                </span>
              </p>
              <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                {data.mentor.kickoffCompletedAt
                  ? "Kickoff complete — the monthly rhythm is running."
                  : "Kickoff not held yet — your mentor will reach out to schedule it."}
                {data.nextCheckInLabel
                  ? ` Next check-in ${data.nextCheckInLabel}.`
                  : ""}
              </p>
            </>
          ) : (
            <>
              <p className="m-0 mt-1 text-[15px] font-semibold text-ink">
                No mentor paired yet
              </p>
              <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                Leadership pairs mentors — nothing you need to do. Your development
                still lives here.
              </p>
            </>
          )}
          {data.stageLabel ? (
            <p className="m-0 mt-2 text-[12px] text-ink-muted">
              Stage: <span className="font-semibold text-ink">{data.stageLabel}</span>
              {data.nextStageLabel ? (
                <span> → {data.nextStageLabel}</span>
              ) : null}
            </p>
          ) : null}
        </div>
        {data.inMentorshipProgram ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink href="/my-mentor/goals" variant="secondary" size="sm">
              My goals
            </ButtonLink>
            <ButtonLink href="/my-mentor/reflection" variant="secondary" size="sm">
              Monthly reflection
            </ButtonLink>
            <ButtonLink href="/my-mentor/progress" variant="secondary" size="sm">
              My progress
            </ButtonLink>
          </div>
        ) : null}
      </section>

      {/* Waiting on you */}
      {waiting === 0 &&
      data.input.selfInputs.length === 0 &&
      data.input.feedbackRequests.length === 0 ? null : (
        <p className="m-0 px-1 text-[12.5px] text-ink-muted">
          {waiting === 0
            ? "Nothing waiting on you — everything below is submitted."
            : `${waiting} ${waiting === 1 ? "thing is" : "things are"} waiting on you.`}
        </p>
      )}

      {data.input.selfInputs.map((item) => (
        <RecordSection
          key={item.cycleId}
          title="Your self-reflection"
          description={`For your ${item.typeLabel.toLowerCase()}${
            item.dueLabel ? ` · due ${item.dueLabel}` : ""
          }. Honest beats polished — this goes straight to your reviewer.`}
          action={
            item.submitted ? <StatusBadge tone="success">Submitted</StatusBadge> : undefined
          }
        >
          <SelfInputForm
            cycleId={item.cycleId}
            initialAnswers={item.answers}
            submitted={item.submitted}
          />
        </RecordSection>
      ))}

      {data.input.feedbackRequests.map((item) => (
        <RecordSection
          key={item.feedbackId}
          title={`Feedback: ${item.aboutName}`}
          description={
            item.reason
              ? `Why you: ${item.reason}${item.dueLabel ? ` · Reply by ${item.dueLabel}` : ""}`
              : `Your answers are confidential to the review${
                  item.dueLabel ? ` · Reply by ${item.dueLabel}` : ""
                }.`
          }
          action={
            item.submitted ? <StatusBadge tone="success">Submitted</StatusBadge> : undefined
          }
        >
          <ContributorFeedbackForm
            feedbackId={item.feedbackId}
            cycleType={item.cycleType}
            initialAnswers={item.answers}
            submitted={item.submitted}
          />
        </RecordSection>
      ))}

      {/* Latest released summary */}
      {latestSummary ? (
        <RecordSection
          title="What leadership sees in you"
          description={`${latestSummary.typeLabel} · released ${latestSummary.releasedAt.toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric", timeZone: "UTC" }
          )}`}
        >
          <div className="flex flex-col gap-3">
            {latestSummary.strengths ? (
              <SummaryBlock label="Strengths" body={latestSummary.strengths} />
            ) : null}
            {latestSummary.growthAreas ? (
              <SummaryBlock label="Growth areas" body={latestSummary.growthAreas} />
            ) : null}
            {latestSummary.recommendedNextStep ? (
              <SummaryBlock
                label="Your recommended next step"
                body={latestSummary.recommendedNextStep}
              />
            ) : null}
          </div>
        </RecordSection>
      ) : null}

      {/* Coaching plan */}
      {(data.coachingActions.length > 0 || data.openFollowUps.length > 0) && (
        <RecordSection
          title="Your coaching plan"
          description="Actions and follow-ups from your reviews — finishing these is the plan."
        >
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {data.coachingActions.map((action) => (
              <li key={action.id} className="flex items-baseline justify-between gap-3 py-1">
                <Link
                  href={action.href}
                  className="min-w-0 truncate text-[13.5px] font-medium text-ink hover:text-brand-700 hover:underline"
                >
                  {action.title}
                </Link>
                <span
                  className={cn(
                    "shrink-0 text-[12px]",
                    action.overdue ? "font-semibold text-danger-700" : "text-ink-muted"
                  )}
                >
                  {action.overdue ? `${action.dueLabel} · overdue` : action.dueLabel}
                </span>
              </li>
            ))}
            {data.openFollowUps.map((followUp) => (
              <li key={followUp.id} className="flex items-baseline justify-between gap-3 py-1">
                <span className="min-w-0 truncate text-[13.5px] text-ink">
                  {followUp.title}
                  <span className="text-ink-muted"> · from {followUp.meetingTitle}</span>
                </span>
                {followUp.dueLabel ? (
                  <span className="shrink-0 text-[12px] text-ink-muted">
                    {followUp.dueLabel}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </RecordSection>
      )}

      {/* Readiness */}
      {data.readiness ? (
        <RecordSection
          title="What “ready for more” looks like"
          description="Leadership promotions follow contributions beyond your own classroom — here's where you stand."
        >
          <div className="flex flex-col gap-2 text-[13.5px] text-ink">
            <p className="m-0">
              <span className="font-semibold">Senior Instructor:</span>{" "}
              {data.readiness.seniorSummary}
            </p>
            <p className="m-0">
              <span className="font-semibold">Lead Instructor:</span>{" "}
              {data.readiness.leadSummary}
            </p>
            <p className="m-0 mt-1 text-[12.5px] font-medium text-brand-700">
              {data.readiness.standingLabel}
            </p>
          </div>
        </RecordSection>
      ) : null}
    </div>
  );
}

// ── Mentor console ───────────────────────────────────────────────────────────

export function MentorConsoleView({ data }: { data: MentorConsoleData }) {
  return (
    <div className="flex flex-col gap-4">
      {data.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-line-soft bg-surface-soft/50 px-6 py-10 text-center">
          <p className="m-0 max-w-sm text-[13.5px] text-ink-muted">
            You&apos;ll see people here when leadership pairs you with a mentee or
            assigns you a review.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card">
          <header className="flex items-baseline justify-between gap-2 border-b border-line-soft bg-surface-soft/50 px-4 py-3">
            <h2 className="m-0 text-[13.5px] font-bold text-ink">
              People you coach{" "}
              <span className="font-semibold text-ink-muted">{data.rows.length}</span>
            </h2>
            <p className="m-0 text-[12px] text-ink-muted">
              One next step each — most pressing first.
            </p>
          </header>
          <ul className="m-0 list-none divide-y divide-line-soft/70 p-0">
            {data.rows.map((row) => (
              <li
                key={row.menteeId}
                className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link
                      href={`/people/develop/${row.menteeId}`}
                      className="text-[14.5px] font-semibold text-ink hover:text-brand-700 hover:underline"
                    >
                      {row.menteeName}
                    </Link>
                    {row.contextLabel ? (
                      <span className="text-[12px] text-ink-muted">{row.contextLabel}</span>
                    ) : null}
                  </div>
                  {row.signals.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {row.signals.slice(0, 2).map((signal, index) => (
                        <StatusBadge
                          key={`${signal.kind}-${index}`}
                          tone={SIGNAL_TONE_TO_BADGE[signal.tone]}
                        >
                          {signal.label}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "text-[12px] font-medium",
                      row.nextStep.tone === "danger"
                        ? "text-danger-700"
                        : "text-ink-muted"
                    )}
                  >
                    {row.nextStep.label}
                  </span>
                  <ButtonLink href={row.nextStep.href} size="sm" variant="secondary">
                    Go
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line-card bg-surface p-2 shadow-card">
        {[
          { label: "Monthly review inbox", href: "/mentorship/reviews" },
          { label: "My mentees", href: "/mentorship/mentees" },
          { label: "Schedule", href: "/mentorship/schedule" },
          { label: "Resources", href: "/mentorship/resources" },
          ...(data.showChairQueue
            ? [{ label: "Chair queue", href: "/mentorship/chair" }]
            : []),
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
