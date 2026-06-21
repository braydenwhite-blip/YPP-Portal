"use client";

import { useState } from "react";
import {
  ButtonLink,
  EntityChip,
  MetricStrip,
  PageHeaderV2,
  StatusBadge,
  cn,
} from "@/components/ui-v2";
import { RiseOnScroll } from "@/components/dashboard/rise-on-scroll";
import type { LeadershipHomeData } from "@/lib/home/leadership-home";
import type { Entity360Type } from "@/lib/operations/entity-360";

import { ChiefOfStaffPanel } from "./chief-of-staff-panel";
import { HomeSearchButton } from "./home-search-button";

/**
 * Leadership Home — the EXECUTIVE view (Knowledge OS V2, plan §7/§27.6).
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

type EventType = "all" | "meeting" | "action" | "decision" | "advisor_check_in" | "partner_follow_up";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  all: "All",
  meeting: "Meetings",
  action: "Actions",
  decision: "Decisions",
  advisor_check_in: "Check-ins",
  partner_follow_up: "Partners",
};

export function LeadershipHomeExecutive({
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
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed">("upcoming");
  const [eventFilter, setEventFilter] = useState<EventType>("all");

  const filteredEvents = eventFilter === "all" 
    ? data.upcomingEvents 
    : data.upcomingEvents.filter(e => e.type === eventFilter);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <RiseOnScroll delayMs={0}>
        <PageHeaderV2
          eyebrow={dateLabel}
          title={firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
          subtitle="What needs attention across YPP today — every number below opens its list."
          actions={<HomeSearchButton />}
        >
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
      </RiseOnScroll>

      {data.brief.length > 0 ? (
        <RiseOnScroll delayMs={60}>
          <div className="rounded-[12px] border border-line-soft bg-surface p-5 shadow-card transition-all duration-200 hover:shadow-md">
            <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Today's brief
            </p>
            <div className="flex flex-col gap-1">
              {data.brief.map((line) => (
                <p key={line} className="m-0 text-[14px] leading-relaxed text-ink">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </RiseOnScroll>
      ) : null}

      {data.chiefOfStaff.length > 0 ? (
        <RiseOnScroll delayMs={120}>
          <ChiefOfStaffPanel insights={data.chiefOfStaff} />
        </RiseOnScroll>
      ) : null}

      <RiseOnScroll delayMs={180}>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {/* NEEDS ATTENTION */}
            <section className="scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-6 shadow-card">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="m-0 text-[15px] font-bold text-ink">
                    Needs attention
                  </h3>
                  <p className="m-0 mt-1 text-[13px] text-ink-muted">
                    Worst first, each with the reason and the next move.
                  </p>
                </div>
                <ButtonLink href="/work?view=needs-attention" variant="ghost" size="sm">
                  Full queue →
                </ButtonLink>
              </div>
              {data.attention.length === 0 ? (
                <p className="m-0 text-[13.5px] text-ink-muted">
                  Nothing is flagged right now — the queues are clear.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {data.attention.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[8px] border border-line-soft bg-surface px-3.5 py-2.5 transition-all duration-200 hover:border-brand-300 hover:shadow-sm hover:-translate-y-0.5"
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
                          className="text-[12.5px] font-semibold text-brand-700 hover:underline transition-transform duration-200 hover:translate-x-0.5"
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
            </section>

            {/* APPLICANTS WAITING FOR A DECISION */}
            {data.decisionQueue.length > 0 ? (
              <section className="scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-6 shadow-card">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="m-0 text-[15px] font-bold text-ink">
                      Applicants waiting for a decision
                    </h3>
                    <p className="m-0 mt-1 text-[13px] text-ink-muted">
                      The chair queue, longest-waiting first.
                    </p>
                  </div>
                  <ButtonLink
                    href="/admin/instructor-applicants"
                    variant="ghost"
                    size="sm"
                  >
                    Application board →
                  </ButtonLink>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {data.decisionQueue.map((app) => (
                    <li
                      key={app.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-surface-soft px-3.5 py-2.5 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
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
                          className="font-semibold text-brand-700 hover:underline transition-transform duration-200 hover:translate-x-0.5"
                        >
                          Open →
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* RECENT ACTIVITY */}
            {data.recentActivity.length > 0 ? (
              <section className="scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-6 shadow-card">
                <div className="mb-4">
                  <h3 className="m-0 text-[15px] font-bold text-ink">
                    Recent activity
                  </h3>
                  <p className="m-0 mt-1 text-[13px] text-ink-muted">
                    What changed across meetings, decisions, and actions.
                  </p>
                </div>
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
              </section>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {/* OVERDUE ACTIONS - Highlighted when there are overdue items */}
            <section 
              className={cn(
                "scroll-mt-24 rounded-[12px] border p-6 shadow-card transition-all duration-200",
                data.overdueActions.length > 0 
                  ? "border-[#e5484d] bg-[#fdf3f2]" 
                  : "border-line-soft bg-surface"
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="m-0 text-[15px] font-bold text-ink">
                    Overdue actions
                  </h3>
                  <p className="m-0 mt-1 text-[13px] text-ink-muted">
                    Open work past its due date.
                  </p>
                </div>
                <ButtonLink href="/work?flag=overdue" variant="ghost" size="sm">
                  All overdue work →
                </ButtonLink>
              </div>
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
                        className="group block rounded-[8px] border border-[#e5484d] bg-surface px-3.5 py-2.5 transition-all duration-200 hover:border-[#e5484d] hover:shadow-md hover:-translate-y-0.5"
                      >
                        <p className="m-0 truncate text-[13.5px] font-semibold text-ink">
                          {action.title}
                        </p>
                        <p className="m-0 text-[12px] font-semibold text-[#e5484d]">
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
                        <p className="m-0 mt-1 text-[11px] text-ink-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          Click to view details →
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
            </section>

            {/* UPCOMING / RECENTLY COMPLETED WITH TABS */}
            <section className="scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-6 shadow-card">
              {/* Tab buttons */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setActiveTab("upcoming")}
                  className={cn(
                    "rounded-[8px] px-4 py-2 text-[12.5px] font-semibold transition-all duration-200",
                    activeTab === "upcoming"
                      ? "bg-brand-600 text-white"
                      : "bg-surface-soft text-ink-muted hover:bg-brand-50 hover:text-brand-700"
                  )}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setActiveTab("completed")}
                  className={cn(
                    "rounded-[8px] px-4 py-2 text-[12.5px] font-semibold transition-all duration-200",
                    activeTab === "completed"
                      ? "bg-brand-600 text-white"
                      : "bg-surface-soft text-ink-muted hover:bg-brand-50 hover:text-brand-700"
                  )}
                >
                  Recently completed
                </button>
              </div>

              {activeTab === "upcoming" ? (
                /* UPCOMING TAB */
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-[#6b21c8]" />
                    <h3 className="m-0 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#3a3a52]">
                      Your upcoming deadlines
                    </h3>
                  </div>
                  
                  {/* Filter tabs */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setEventFilter(type)}
                        className={cn(
                          "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200",
                          eventFilter === type
                            ? "bg-brand-600 text-white"
                            : "bg-surface-soft text-ink-muted hover:bg-brand-50 hover:text-brand-700"
                        )}
                      >
                        {EVENT_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>

                  {filteredEvents.length > 0 ? (
                    <ul className="m-0 flex list-none flex-col p-0">
                      {filteredEvents.slice(0, 6).map((event) => {
                        const d = new Date(event.startISO);
                        const overdue = d < now;
                        const day = d.getDate();
                        const month = d.toLocaleString("en-US", { month: "short" });
                        return (
                          <li
                            key={event.id}
                            className="flex items-center gap-3.5 border-b border-line-soft px-0 py-3 last:border-b-0 transition-all duration-200 hover:bg-surface-soft"
                            style={{ 
                              borderColor: "#f4f4f8",
                              background: overdue ? "#fdf3f2" : undefined 
                            }}
                          >
                            <a href={event.href} className="flex w-full items-center gap-3.5 no-underline">
                              <span className="w-[34px] shrink-0 text-center">
                                <span
                                  className="block text-[17px] font-bold leading-none"
                                  style={{ color: overdue ? "#e5484d" : "#3a3a52" }}
                                >
                                  {day}
                                </span>
                                <span className="block text-[10px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                                  {month}
                                </span>
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-ink">
                                  {event.title}
                                </span>
                                <span
                                  className="block text-[11.5px]"
                                  style={{ color: overdue ? "#e5484d" : "#9a9ab0" }}
                                >
                                  {overdue ? "Overdue" : "Due"} · {event.urgencyLabel ?? event.type}
                                </span>
                              </span>
                              <span className="shrink-0 text-[12px] font-semibold text-brand-700">
                                {event.ctaLabel} →
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-0 py-4 text-[12.5px] text-ink-muted">
                      No upcoming {eventFilter === "all" ? "events" : EVENT_TYPE_LABELS[eventFilter].toLowerCase()}.
                    </div>
                  )}
                </>
              ) : (
                /* RECENTLY COMPLETED TAB */
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-[#0e9f6e]" />
                    <h3 className="m-0 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#3a3a52]">
                      Recently completed
                    </h3>
                  </div>
                  {data.recentActivity.length > 0 ? (
                    <ul className="m-0 flex list-none flex-col p-0">
                      {data.recentActivity.slice(0, 5).map((event) => {
                        const d = event.occurredAtISO ? new Date(event.occurredAtISO) : null;
                        const day = d ? d.getDate() : "";
                        const month = d ? d.toLocaleString("en-US", { month: "short" }) : "";
                        return (
                          <li
                            key={event.id}
                            className="flex items-center gap-3.5 border-b border-line-soft px-0 py-3 last:border-b-0 transition-all duration-200 hover:bg-surface-soft"
                            style={{ borderColor: "#f4f4f8" }}
                          >
                            {event.href ? (
                              <a href={event.href} className="flex w-full items-center gap-3.5 no-underline">
                                <span className="w-[34px] shrink-0 text-center">
                                  <span className="block text-[17px] font-bold leading-none text-[#0e9f6e]">
                                    {day}
                                  </span>
                                  <span className="block text-[10px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                                    {month}
                                  </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-semibold text-ink">
                                    {event.title}
                                  </span>
                                  {event.detail ? (
                                    <span className="block text-[11.5px] text-ink-muted">
                                      {event.detail}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-[12px] text-ink-muted">
                                  {fmtDay(event.occurredAtISO)}
                                </span>
                              </a>
                            ) : (
                              <>
                                <span className="w-[34px] shrink-0 text-center">
                                  <span className="block text-[17px] font-bold leading-none text-[#0e9f6e]">
                                    {day}
                                  </span>
                                  <span className="block text-[10px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                                    {month}
                                  </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-semibold text-ink">
                                    {event.title}
                                  </span>
                                  {event.detail ? (
                                    <span className="block text-[11.5px] text-ink-muted">
                                      {event.detail}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-[12px] text-ink-muted">
                                  {fmtDay(event.occurredAtISO)}
                                </span>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-0 py-4 text-[12.5px] text-ink-muted">No recently completed items.</div>
                  )}
                </>
              )}
            </section>

            {/* QUICK ACTIONS */}
            <section className="scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-6 shadow-card">
              <div className="mb-4">
                <h3 className="m-0 text-[15px] font-bold text-ink">
                  Quick actions
                </h3>
                <p className="m-0 mt-1 text-[13px] text-ink-muted">
                  The common next moves.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/actions/new" size="sm">
                  Create action
                </ButtonLink>
                <ButtonLink href="/actions/meetings/new" size="sm">
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
            </section>
          </div>
        </div>
      </RiseOnScroll>
    </div>
  );
}