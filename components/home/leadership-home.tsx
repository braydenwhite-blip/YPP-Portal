import {
  ButtonLink,
  EntityChip,
  MetricStrip,
  PageHeaderV2,
  RecordSection,
  StatusBadge,
} from "@/components/ui-v2";
import type { LeadershipHomeData } from "@/lib/home/leadership-home";
import type { Entity360Type } from "@/lib/operations/entity-360";

import { HomeSearchButton } from "./home-search-button";

/**
 * Leadership Home cockpit (Knowledge OS V2, plan §7/§27.6) — the executive
 * front door: what matters today (Today's Brief), what needs attention (the
 * cross-domain attention queue, with reasons), what is coming up (meetings),
 * what is overdue (actions), which applicants need a decision, and what
 * changed (unified timeline). Every tile is a real count linking into its
 * filtered list; no pulse scores, no charts, no vague panels (§19).
 */

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function prettyTrack(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

export function LeadershipHome({
  firstName,
  data,
}: {
  firstName: string;
  data: LeadershipHomeData;
}) {
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const { stats } = data;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <PageHeaderV2
        eyebrow={dateLabel}
        title={firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
        subtitle="What needs attention across YPP today — every number below opens its list."
        actions={<HomeSearchButton />}
      >
        {/* Attention-first summary: five concrete states, worst first. Upcoming
            meetings live in their own section below rather than as a calm sixth
            tile, so this strip stays purely "what needs you" (doctrine §7). */}
        <MetricStrip
          aria-label="What needs attention today"
          metrics={[
            {
              label: "Overdue actions",
              value: stats.overdueActions,
              tone: stats.overdueActions > 0 ? "attention" : "default",
              href: "/work?flag=overdue",
            },
            {
              label: "Decisions needed",
              value: stats.applicantsAwaitingDecision,
              detail: "applicants in the chair queue",
              tone: stats.applicantsAwaitingDecision > 0 ? "attention" : "default",
              href: "/admin/instructor-applicants",
            },
            {
              label: "Students without advisors",
              value: stats.studentsWithoutAdvisor,
              tone: stats.studentsWithoutAdvisor > 0 ? "attention" : "default",
              href: "/people?flag=no-advisor",
            },
            {
              label: "Check-ins overdue",
              value: stats.advisorCheckInsOverdue,
              detail: "advisor check-ins past due",
              tone: stats.advisorCheckInsOverdue > 0 ? "attention" : "default",
              href: "/people?flag=checkin-overdue",
            },
            {
              label: "Partner follow-ups",
              value: stats.partnerFollowUpsOverdue,
              detail:
                stats.openPartnerRequests > 0
                  ? `past due · ${stats.openPartnerRequests} open requests`
                  : "past their follow-up date",
              tone: stats.partnerFollowUpsOverdue > 0 ? "attention" : "default",
              href: "/partners?view=follow-up",
            },
          ]}
        />
      </PageHeaderV2>

      {data.brief.length > 0 ? (
        <div className="rounded-[12px] border border-line-soft bg-surface p-5 shadow-card">
          <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Today&apos;s brief
          </p>
          <div className="flex flex-col gap-1">
            {data.brief.map((line) => (
              <p key={line} className="m-0 text-[14px] leading-relaxed text-ink">
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <RecordSection
            title="Needs attention"
            description="Worst first, each with the reason and the next move."
            action={
              <ButtonLink href="/work?view=needs-attention" variant="ghost" size="sm">
                Full queue →
              </ButtonLink>
            }
          >
            {data.attention.length === 0 ? (
              <p className="m-0 text-[13.5px] text-ink-muted">
                Nothing is flagged right now — the queues are clear.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.attention.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[8px] border border-line-soft px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
                        {item.entityType && item.entityId ? (
                          <EntityChip
                            type={item.entityType as Entity360Type}
                            id={item.entityId}
                            label={item.relatedLabel ?? item.title}
                            href={item.href}
                          />
                        ) : (
                          item.title
                        )}
                        <StatusBadge tone={SEVERITY_TONE[item.severity] ?? "info"}>
                          {item.ageLabel ?? item.kind.replaceAll("_", " ")}
                        </StatusBadge>
                      </p>
                      <a
                        href={item.href}
                        className="text-[12.5px] font-semibold text-brand-700 hover:underline"
                      >
                        Open →
                      </a>
                    </div>
                    <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                      {item.why}
                      {item.suggestedStep ? (
                        <span className="font-medium text-ink"> {item.suggestedStep}</span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </RecordSection>

          {data.decisionQueue.length > 0 ? (
            <RecordSection
              title="Applicants waiting for a decision"
              description="The chair queue, longest-waiting first."
              action={
                <ButtonLink
                  href="/admin/instructor-applicants"
                  variant="ghost"
                  size="sm"
                >
                  Application board →
                </ButtonLink>
              }
            >
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.decisionQueue.map((app) => (
                  <li
                    key={app.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-surface-soft px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <EntityChip
                        type="applicant"
                        id={app.id}
                        label={app.displayName}
                        sublabel={prettyTrack(app.track)}
                        href={`/admin/instructor-applicants/${app.id}`}
                      />
                      {app.chapterName ? (
                        <span className="text-[12.5px] text-ink-muted">
                          {app.chapterName}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[12.5px] text-ink-muted">
                      {app.daysInQueue != null
                        ? `${app.daysInQueue} day${app.daysInQueue === 1 ? "" : "s"} in queue`
                        : "in queue"}
                      {" · "}
                      <a
                        href={`/admin/instructor-applicants/${app.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        Open record →
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </RecordSection>
          ) : null}

          {data.recentActivity.length > 0 ? (
            <RecordSection
              title="Recent activity"
              description="What changed across meetings, decisions, and actions."
            >
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {data.recentActivity.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-1.5 text-[13px] last:border-b-0"
                  >
                    <span className="min-w-0 font-medium text-ink">
                      {event.href ? (
                        <a href={event.href} className="hover:underline">
                          {event.title}
                        </a>
                      ) : (
                        event.title
                      )}
                      {event.detail ? (
                        <span className="ml-2 font-normal text-ink-muted">
                          {event.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-muted">
                      {fmtDay(event.occurredAtISO)}
                    </span>
                  </li>
                ))}
              </ul>
            </RecordSection>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <RecordSection
            title="Overdue actions"
            description="Open work past its due date."
            action={
              <ButtonLink href="/work?flag=overdue" variant="ghost" size="sm">
                All overdue work →
              </ButtonLink>
            }
          >
            {data.overdueActions.length === 0 ? (
              <p className="m-0 text-[13.5px] text-ink-muted">
                No actions are overdue.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.overdueActions.map((action) => (
                  <li key={action.id}>
                    <a
                      href={action.href}
                      className="block rounded-[8px] border border-line-soft px-3.5 py-2.5 transition-colors hover:border-brand-400"
                    >
                      <p className="m-0 truncate text-[13.5px] font-semibold text-ink">
                        {action.title}
                      </p>
                      <p className="m-0 text-[12px] font-semibold text-danger-700">
                        {action.daysOverdue} day{action.daysOverdue === 1 ? "" : "s"}{" "}
                        overdue
                        {action.ownerName ? (
                          <span className="font-normal text-ink-muted">
                            {" "}
                            · {action.ownerName}
                          </span>
                        ) : (
                          <span className="font-normal text-ink-muted"> · unowned</span>
                        )}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {stats.blockedActions > 0 || stats.unownedActions > 0 ? (
              <p className="m-0 mt-2.5 text-[12.5px] text-ink-muted">
                {stats.blockedActions > 0 ? (
                  <a
                    href="/work?flag=blocked"
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {stats.blockedActions} blocked →
                  </a>
                ) : null}
                {stats.blockedActions > 0 && stats.unownedActions > 0 ? " · " : null}
                {stats.unownedActions > 0 ? (
                  <a
                    href="/work?flag=unowned"
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {stats.unownedActions} need an owner →
                  </a>
                ) : null}
              </p>
            ) : null}
          </RecordSection>

          <RecordSection
            title="Upcoming meetings"
            description="The next officer meetings on the calendar."
            action={
              <ButtonLink href="/work?view=meetings" variant="ghost" size="sm">
                All meetings →
              </ButtonLink>
            }
          >
            {data.upcomingMeetings.length === 0 ? (
              <p className="m-0 text-[13.5px] text-ink-muted">
                Nothing on the calendar in the next two weeks.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.upcomingMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <a
                      href={`/actions/meetings/${meeting.id}`}
                      className="block rounded-[8px] bg-surface-soft px-3.5 py-2.5 transition-colors hover:bg-brand-50"
                    >
                      <p className="m-0 truncate text-[13.5px] font-semibold text-ink">
                        {meeting.title}
                      </p>
                      <p className="m-0 text-[12px] text-ink-muted">
                        {fmtDay(meeting.startISO)} · {meeting.categoryLabel}
                        {meeting.facilitatorName ? ` · ${meeting.facilitatorName}` : ""}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </RecordSection>

          <RecordSection title="Quick actions" description="The common next moves.">
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/actions?create=1" size="sm">
                Create action
              </ButtonLink>
              <ButtonLink href="/actions/meetings?new=1" size="sm">
                Log meeting
              </ButtonLink>
              <ButtonLink href="/work" size="sm">
                Work
              </ButtonLink>
              <ButtonLink href="/people" size="sm">
                People
              </ButtonLink>
              <ButtonLink href="/partners" size="sm">
                Partners
              </ButtonLink>
              <ButtonLink href="/admin" size="sm">
                Admin
              </ButtonLink>
            </div>
          </RecordSection>
        </div>
      </div>
    </div>
  );
}
