import Link from "next/link";

import {
  ButtonLink,
  KeyFactsGrid,
  ProfileHeader,
  RecordSection,
  StatusBadge,
  cn,
  type KeyFact,
  type StatusTone,
} from "@/components/ui-v2";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import type { DevelopmentRecord, DevelopmentTimelineEvent } from "@/lib/development/record";
import type { DevelopmentSignalTone } from "@/lib/development/signals";

/**
 * One person's development record — the coaching view. Header + key facts +
 * the recommended next step, then what happened (timeline), what they carry
 * (open work), and what reviews say (strengths evidence). Server-rendered,
 * links only; every deep-dive goes to the surface that owns the data.
 */

const SIGNAL_TONE_TO_BADGE: Record<DevelopmentSignalTone, StatusTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  brand: "brand",
  success: "success",
  neutral: "neutral",
};

const EVENT_KIND_LABEL: Record<DevelopmentTimelineEvent["kind"], string> = {
  "check-in": "Check-in",
  "quarterly-review": "Review",
  "mentor-review": "Mentor review",
  "review-cycle": "Review",
  session: "Session",
  "action-completed": "Done",
  "growth-tag": "Signal",
  contribution: "Role",
};

const EVENT_DOT: Record<DevelopmentTimelineEvent["tone"], string> = {
  danger: "bg-danger-700",
  warning: "bg-warning-700",
  info: "bg-info-700",
  brand: "bg-brand-600",
  success: "bg-success-700",
  neutral: "bg-line",
};

function buildKeyFacts(record: DevelopmentRecord): KeyFact[] {
  const { facts } = record;
  const keyFacts: KeyFact[] = [];

  if (facts.mentorName) {
    keyFacts.push({ label: "Mentor", value: facts.mentorName });
  } else if (facts.mentorEligible) {
    keyFacts.push({
      label: "Mentor",
      value: "None assigned",
      tone: "attention",
      href: `/admin/mentorship?tab=assignments&menteeId=${facts.id}&supportRole=PRIMARY_MENTOR`,
    });
  }

  if (facts.lastCheckInMonthLabel) {
    keyFacts.push({
      label: "Last check-in",
      value: facts.lastCheckInMonthLabel,
      detail: facts.lastCheckInRating
        ? RATING_LABELS[facts.lastCheckInRating]
        : undefined,
      href: "/people/check-ins",
    });
  } else {
    keyFacts.push({
      label: "Last check-in",
      value: "Never",
      tone: "attention",
      href: "/people/check-ins",
    });
  }

  if (facts.lastReviewQuarter && facts.lastReviewPerformance && facts.lastReviewPotential) {
    keyFacts.push({
      label: "Last review",
      value: facts.lastReviewQuarter,
      detail: `${RATING_LABELS[facts.lastReviewPerformance]} · ${RATING_LABELS[facts.lastReviewPotential]}`,
      href: "/people/quarterly-reviews",
    });
  } else {
    keyFacts.push({
      label: "Last review",
      value: "None on file",
      tone: facts.reviewDue ? "attention" : "default",
      href: "/people/quarterly-reviews",
    });
  }

  if (facts.openActionCount > 0) {
    keyFacts.push({
      label: "Open work",
      value: `${facts.openActionCount} ${facts.openActionCount === 1 ? "action" : "actions"}`,
      detail:
        facts.overdueActionCount > 0
          ? `${facts.overdueActionCount} overdue`
          : undefined,
      tone: facts.overdueActionCount > 0 ? "attention" : "default",
      href: "/actions",
    });
  }

  const roles: string[] = [];
  if (facts.teamsLeadingCount > 0) {
    roles.push(`Leads ${facts.teamsLeadingCount} ${facts.teamsLeadingCount === 1 ? "team" : "teams"}`);
  }
  if (facts.committeesChairedCount > 0) {
    roles.push(
      `Chairs ${facts.committeesChairedCount} ${facts.committeesChairedCount === 1 ? "committee" : "committees"}`
    );
  }
  if (facts.activeMenteeCount > 0) {
    roles.push(`Mentors ${facts.activeMenteeCount}`);
  }
  if (roles.length > 0) {
    keyFacts.push({ label: "Leadership load", value: roles.join(" · ") });
  }

  if (facts.classesTeachingCount > 0) {
    keyFacts.push({
      label: "Teaching",
      value: `${facts.classesTeachingCount} ${facts.classesTeachingCount === 1 ? "class" : "classes"}`,
    });
  }

  return keyFacts;
}

export function DevelopmentRecordView({ record }: { record: DevelopmentRecord }) {
  const {
    facts,
    signals,
    nextStep,
    activeReview,
    timeline,
    openActions,
    openFollowUps,
    reviewEvidence,
  } = record;

  return (
    <div className="flex flex-col gap-5">
      <ProfileHeader
        eyebrow="Development record"
        name={facts.name || facts.email}
        identityLine={[facts.contextLabel, facts.email].filter(Boolean).join(" · ")}
        backHref="/people/develop"
        backLabel="Development"
        badges={
          signals.length > 0 ? (
            <>
              {signals.slice(0, 4).map((signal, index) => (
                <StatusBadge
                  key={`${signal.kind}-${index}`}
                  tone={SIGNAL_TONE_TO_BADGE[signal.tone]}
                >
                  {signal.label}
                </StatusBadge>
              ))}
            </>
          ) : (
            <StatusBadge tone="success">Steady</StatusBadge>
          )
        }
        actions={
          <ButtonLink href={`/people/${facts.id}`} size="sm" variant="secondary">
            Full profile
          </ButtonLink>
        }
      />

      <KeyFactsGrid facts={buildKeyFacts(record)} />

      <section className="flex flex-col gap-3 rounded-[12px] border border-brand-200 bg-brand-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.1em] text-brand-700">
            Recommended next step
          </p>
          <p className="m-0 mt-1 text-[15px] font-semibold text-ink">{nextStep.reason}</p>
        </div>
        <div className="shrink-0">
          <ButtonLink href={nextStep.href} variant="primary" size="sm">
            {nextStep.label}
          </ButtonLink>
        </div>
      </section>

      {activeReview ? (
        <section className="flex flex-col gap-3 rounded-[12px] border border-line-soft bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                Active review
              </p>
              <StatusBadge tone={SIGNAL_TONE_TO_BADGE[activeReview.tone]}>
                {activeReview.stateLabel}
              </StatusBadge>
            </div>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">{activeReview.blurb}</p>
          </div>
          <div className="shrink-0">
            <ButtonLink
              href={`/people/develop/reviews/${activeReview.cycleId}`}
              variant="secondary"
              size="sm"
            >
              Open review cycle
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {(openActions.length > 0 || openFollowUps.length > 0) && (
        <RecordSection
          id="load"
          title="What they're carrying"
          description="Open actions and meeting follow-ups they own right now."
        >
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {openActions.map((action) => (
              <li key={action.id} className="flex items-baseline justify-between gap-3 py-1">
                <Link
                  href={action.href}
                  className="min-w-0 truncate text-[13.5px] font-medium text-ink hover:text-brand-700 hover:underline"
                >
                  {action.title}
                </Link>
                {action.dueLabel ? (
                  <span
                    className={cn(
                      "shrink-0 text-[12px]",
                      action.overdue ? "font-semibold text-danger-700" : "text-ink-muted"
                    )}
                  >
                    {action.overdue ? `${action.dueLabel} · overdue` : action.dueLabel}
                  </span>
                ) : null}
              </li>
            ))}
            {openFollowUps.map((followUp) => (
              <li key={followUp.id} className="flex items-baseline justify-between gap-3 py-1">
                <span className="min-w-0 truncate text-[13.5px] text-ink">
                  {followUp.title}
                  <span className="text-ink-muted"> · follow-up from {followUp.meetingTitle}</span>
                </span>
                {followUp.dueLabel ? (
                  <span className="shrink-0 text-[12px] text-ink-muted">{followUp.dueLabel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </RecordSection>
      )}

      {reviewEvidence && reviewEvidence.suggestedLanguage.length > 0 ? (
        <RecordSection
          title="Strengths & review evidence"
          description="Concrete statements their contributions support — ready to use in a review."
        >
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
            {reviewEvidence.suggestedLanguage.map((line) => (
              <li key={line} className="text-[13.5px] text-ink">
                {line}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-3 text-[12.5px] font-medium text-brand-700">
            {reviewEvidence.promotionReadiness.label}
          </p>
        </RecordSection>
      ) : null}

      <RecordSection
        title="Development timeline"
        description="Check-ins, reviews, sessions, roles, and completed work — newest first."
      >
        {timeline.length === 0 ? (
          <p className="m-0 text-[13.5px] text-ink-muted">
            No development activity recorded yet — a first check-in is the best starting
            point.
          </p>
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {timeline.map((event, index) => (
              <li key={`${event.kind}-${event.atISO}-${index}`} className="flex gap-3 py-2">
                <span className="flex w-24 shrink-0 flex-col items-start pt-0.5">
                  <span className="text-[11.5px] font-semibold text-ink-muted">
                    {event.dateLabel}
                  </span>
                  <span className="text-[10.5px] uppercase tracking-[0.06em] text-ink-muted/80">
                    {EVENT_KIND_LABEL[event.kind]}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", EVENT_DOT[event.tone])}
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-ink">{event.label}</span>
                  {event.detail ? (
                    <span className="block text-[12.5px] text-ink-muted">{event.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </RecordSection>
    </div>
  );
}
