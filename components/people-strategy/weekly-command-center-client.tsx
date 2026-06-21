"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  MEETING_CATEGORY_VALUES,
  meetingCategoryLabel,
  meetingCategoryTone,
} from "@/lib/people-strategy/meeting-categories";
import {
  MEETING_TYPE_VALUES,
  meetingOperatingModel,
} from "@/lib/people-strategy/meeting-operating-model";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import { MeetingCard } from "./meeting-card";
import { MeetingNowNextCard } from "./meeting-now-next";
import { MeetingIcon, type MeetingIconName } from "./meeting-icons";
import {
  Avatar,
  Card,
  EmptyState,
  MeetingButton,
  Pill,
  SectionTitle,
  dueText,
  fmtDate,
} from "./meeting-ui";
import { NewMeetingDrawer, type MeetingPrefill, type PersonOption } from "./new-meeting-drawer";

export interface FollowQueueRow {
  id: string;
  title: string;
  ownerName: string | null;
  dueISO: string | null;
  effectiveStatus: "open" | "in_progress" | "completed" | "overdue";
  area: string | null;
  tracked: boolean;
  meetingId: string;
}

export interface OverdueActionRow {
  id: string;
  title: string;
  ownerName: string | null;
  dueISO: string;
  meetingId: string | null;
  meetingTitle: string | null;
}

export interface RecentDecisionRow {
  id: string;
  text: string;
  decidedByName: string | null;
  dateISO: string;
  meetingId: string;
  meetingTitle: string;
}

export interface PulseRow {
  area: string;
  open: number;
  overdue: number;
}

interface Filters {
  status: string;
  category: string;
  meetingType: string;
  owner: string;
  overdue: boolean;
  hasActions: boolean;
}

const EMPTY_FILTERS: Filters = {
  status: "",
  category: "",
  meetingType: "",
  owner: "",
  overdue: false,
  hasActions: false,
};
type SimpleMeetingView =
  | "upcoming"
  | "needs"
  | "impact"
  | "officer"
  | "chapter"
  | "followups"
  | "recent"
  | "all";

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "in_progress", label: "In Progress" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "needs_follow_up", label: "Needs Follow-Up" },
  { value: "canceled", label: "Canceled" },
];

function isImpactPresentation(m: MeetingCardDTO): boolean {
  return (
    m.meetingType === "GLOBAL_OPERATIONS_IMPACT_PRESENTATION" ||
    m.meetingType === "CHAPTER_IMPACT_PRESENTATION"
  );
}

function meetingNeedsAttention(m: MeetingCardDTO): boolean {
  const needsPrep =
    (m.effectiveStatus === "today" ||
      m.effectiveStatus === "in_progress" ||
      m.effectiveStatus === "upcoming") &&
    (m.agendaCount === 0 || m.attendeeCount === 0);
  const needsSummary =
    (m.effectiveStatus === "completed" || m.effectiveStatus === "needs_follow_up") &&
    !m.hasNotes;
  return (
    needsPrep ||
    needsSummary ||
    m.effectiveStatus === "needs_follow_up" ||
    m.openFollowUps > 0 ||
    m.overdueFollowUps > 0 ||
    (m.attendanceConcernCount ?? 0) > 0 ||
    (m.followUpsNeedingOwner ?? 0) > 0 ||
    (m.followUpsNeedingDueDate ?? 0) > 0
  );
}

interface AttentionRowData {
  meetingId: string;
  title: string;
  reason: string;
  tone: "danger" | "warning" | "info";
  href: string;
}

interface DecisionQueueRowData {
  id: string;
  meetingId: string;
  meetingTitle: string;
  decision: string;
  decidedByName: string | null;
}

function buildMeetingAttentionRows(meetings: MeetingCardDTO[]): AttentionRowData[] {
  const rows: AttentionRowData[] = [];
  for (const m of meetings) {
    if (m.overdueFollowUps > 0) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: `${m.overdueFollowUps} overdue follow-up${m.overdueFollowUps === 1 ? "" : "s"}`,
        tone: "danger",
        href: `/actions/meetings/${m.id}#followups`,
      });
    }
    if (m.agendaCount === 0 && ["today", "in_progress", "upcoming"].includes(m.effectiveStatus)) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: "Agenda missing",
        tone: "warning",
        href: `/actions/meetings/${m.id}#agenda`,
      });
    }
    if (m.attendeeCount === 0 && ["today", "in_progress", "upcoming"].includes(m.effectiveStatus)) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: "Required attendees missing",
        tone: "warning",
        href: `/actions/meetings/${m.id}#attendance`,
      });
    }
    if ((m.attendanceConcernCount ?? 0) > 0) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: `${m.attendanceConcernCount ?? 0} attendance concern${m.attendanceConcernCount === 1 ? "" : "s"}`,
        tone: "danger",
        href: `/actions/meetings/${m.id}#attendance`,
      });
    }
    if ((m.followUpsNeedingOwner ?? 0) > 0) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: `${m.followUpsNeedingOwner} follow-up${m.followUpsNeedingOwner === 1 ? "" : "s"} need owner`,
        tone: "warning",
        href: `/actions/meetings/${m.id}#followups`,
      });
    }
    if ((m.followUpsNeedingDueDate ?? 0) > 0) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: `${m.followUpsNeedingDueDate} follow-up${m.followUpsNeedingDueDate === 1 ? "" : "s"} need due date`,
        tone: "warning",
        href: `/actions/meetings/${m.id}#followups`,
      });
    }
    const decisionsMissingActions = (m.decisionsPreview ?? []).filter((d) => !d.linkedActionId).length;
    if (decisionsMissingActions > 0) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: `${decisionsMissingActions} decision${decisionsMissingActions === 1 ? "" : "s"} need action`,
        tone: "warning",
        href: `/actions/meetings/${m.id}#decisions`,
      });
    }
    if (
      (m.effectiveStatus === "completed" || m.effectiveStatus === "needs_follow_up") &&
      !m.hasNotes
    ) {
      rows.push({
        meetingId: m.id,
        title: m.title,
        reason: "Summary notes missing",
        tone: "info",
        href: `/actions/meetings/${m.id}#notes`,
      });
    }
  }
  const rank = { danger: 0, warning: 1, info: 2 };
  return rows.sort((a, b) => rank[a.tone] - rank[b.tone] || a.title.localeCompare(b.title));
}

export function WeeklyCommandCenterClient({
  meetings,
  followQueue,
  overdueActions,
  recentDecisions,
  pulse,
  weekLabel,
  weekOffset,
  people,
  owners,
  meetingPrefill,
  autoOpenNew = false,
  nowISO,
}: {
  meetings: MeetingCardDTO[];
  followQueue: FollowQueueRow[];
  overdueActions: OverdueActionRow[];
  recentDecisions: RecentDecisionRow[];
  pulse: PulseRow[];
  weekLabel: string;
  weekOffset: number;
  people: PersonOption[];
  owners: PersonOption[];
  meetingPrefill?: MeetingPrefill;
  autoOpenNew?: boolean;
  nowISO: string;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [simpleView, setSimpleView] = useState<SimpleMeetingView>("upcoming");
  const [showNew, setShowNew] = useState(autoOpenNew);

  const anyAdvancedFilter =
    !!q ||
    !!filters.status ||
    !!filters.category ||
    !!filters.meetingType ||
    !!filters.owner ||
    filters.overdue ||
    filters.hasActions;
  const anyFilter = anyAdvancedFilter || simpleView !== "upcoming";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return meetings.filter((m) => {
      if (
        simpleView === "upcoming" &&
        m.effectiveStatus !== "today" &&
        m.effectiveStatus !== "in_progress" &&
        m.effectiveStatus !== "upcoming"
      ) {
        return false;
      }
      if (
        simpleView === "needs" &&
        !meetingNeedsAttention(m)
      ) {
        return false;
      }
      if (simpleView === "impact" && !isImpactPresentation(m)) {
        return false;
      }
      if (simpleView === "officer" && m.meetingType !== "OFFICER_MEETING") {
        return false;
      }
      if (simpleView === "chapter" && m.meetingType !== "CHAPTER_IMPACT_PRESENTATION") {
        return false;
      }
      if (
        simpleView === "followups" &&
        m.openFollowUps === 0 &&
        m.overdueFollowUps === 0 &&
        (m.followUpsNeedingOwner ?? 0) === 0 &&
        (m.followUpsNeedingDueDate ?? 0) === 0
      ) {
        return false;
      }
      if (
        simpleView === "recent" &&
        m.effectiveStatus !== "completed" &&
        m.effectiveStatus !== "canceled"
      ) {
        return false;
      }
      if (needle && !`${m.title} ${m.purpose ?? ""} ${m.categoryLabel}`.toLowerCase().includes(needle)) return false;
      if (filters.status && m.effectiveStatus !== filters.status) return false;
      if (filters.category && m.category !== filters.category) return false;
      if (filters.meetingType && m.meetingType !== filters.meetingType) return false;
      if (filters.owner && !m.participantIds.includes(filters.owner)) return false;
      if (filters.overdue && m.overdueFollowUps === 0) return false;
      if (filters.hasActions && m.openLinkedActions === 0 && m.openFollowUps === 0) return false;
      return true;
    });
  }, [meetings, q, filters, simpleView]);

  const groups = useMemo(() => {
    const today: MeetingCardDTO[] = [];
    const upcoming: MeetingCardDTO[] = [];
    const completed: MeetingCardDTO[] = [];
    const needs: MeetingCardDTO[] = [];
    for (const m of filtered) {
      if (m.effectiveStatus === "needs_follow_up") needs.push(m);
      else if (m.effectiveStatus === "completed" || m.effectiveStatus === "canceled") completed.push(m);
      else if (m.effectiveStatus === "today" || m.effectiveStatus === "in_progress") today.push(m);
      else upcoming.push(m);
    }
    return { today, upcoming, completed, needs };
  }, [filtered]);

  const upcomingMeetings = [...groups.today, ...groups.upcoming];
  const recentMeetings = groups.completed;
  const allUpcomingMeetings = meetings.filter(
    (m) =>
      m.effectiveStatus === "today" ||
      m.effectiveStatus === "in_progress" ||
      m.effectiveStatus === "upcoming"
  );
  const allRecentMeetings = meetings.filter(
    (m) => m.effectiveStatus === "completed" || m.effectiveStatus === "canceled"
  );
  const allNeedsFollowUpCount = meetings.filter(
    meetingNeedsAttention
  ).length;
  const allImpactMeetings = meetings.filter(isImpactPresentation);
  const allOfficerMeetings = meetings.filter((m) => m.meetingType === "OFFICER_MEETING");
  const allChapterMeetings = meetings.filter((m) => m.meetingType === "CHAPTER_IMPACT_PRESENTATION");
  const allFollowUpMeetings = meetings.filter(
    (m) =>
      m.openFollowUps > 0 ||
      m.overdueFollowUps > 0 ||
      (m.followUpsNeedingOwner ?? 0) > 0 ||
      (m.followUpsNeedingDueDate ?? 0) > 0
  );
  const allAttentionRows = buildMeetingAttentionRows(meetings);
  const attentionRows = allAttentionRows.slice(0, 8);
  const decisionQueueRows: DecisionQueueRowData[] = meetings
    .flatMap((meeting) =>
      (meeting.decisionsPreview ?? [])
        .filter((decision) => !decision.linkedActionId)
        .map((decision) => ({
          id: decision.id,
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          decision: decision.decision,
          decidedByName: decision.decidedBy?.name ?? null,
        }))
    )
    .slice(0, 6);

  const weekHref = (offset: number) => (offset === 0 ? "/actions/meetings" : `/actions/meetings?week=${offset}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--ypp-purple-600)",
            }}
          >
            Work
          </span>
          <h1 style={{ margin: "7px 0 0", fontSize: 30, fontWeight: 800, color: "var(--ypp-ink)", letterSpacing: "-.02em" }}>
            Meetings
          </h1>
          <p style={{ margin: "7px 0 0", fontSize: 14.5, color: "var(--muted)", maxWidth: 560, lineHeight: 1.45 }}>
            Weekly accountability, decisions, attendance, follow-ups, and Action Tracker handoffs.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <WeekNav weekLabel={weekLabel} weekOffset={weekOffset} hrefFor={weekHref} />
          <Link href="/actions" style={{ textDecoration: "none" }}>
            <MeetingButton variant="outline" icon="bolt">
              Open Actions
            </MeetingButton>
          </Link>
          <MeetingButton icon="plus" onClick={() => setShowNew(true)}>
            Log meeting
          </MeetingButton>
        </div>
      </div>

      {weekOffset !== 0 && filtered.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No meetings scheduled this week"
          body="Create a leadership sync, class review, or mentorship check-in to start organizing the week."
          cta="Log meeting"
          onCta={() => setShowNew(true)}
        />
      ) : (
        <>
          {/* What matters right now — the page's primary entry point. */}
          <MeetingNowNextCard meetings={meetings} nowISO={nowISO} />
          <OperatingRhythmSummary meetings={meetings} attentionCount={allAttentionRows.length} />

          <Card style={{ padding: "11px 12px" }}>
            <MeetingViewSwitcher
              view={simpleView}
              setView={setSimpleView}
              counts={{
                upcoming: allUpcomingMeetings.length,
                needs: allNeedsFollowUpCount,
                impact: allImpactMeetings.length,
                officer: allOfficerMeetings.length,
                chapter: allChapterMeetings.length,
                followups: allFollowUpMeetings.length,
                recent: allRecentMeetings.length,
                all: meetings.length,
              }}
            />
            <details open={anyAdvancedFilter} style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
                More filters{anyAdvancedFilter ? " · active" : ""}
              </summary>
              <div style={{ marginTop: 10 }}>
                <FilterBar q={q} setQ={setQ} filters={filters} setFilters={setFilters} owners={owners} />
              </div>
            </details>
          </Card>

          {/* Two-column layout */}
          <div className="dash-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
            {/* MAIN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {anyFilter && filtered.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="No meetings match your filters"
                  body="Try clearing a filter or searching a different term."
                  cta="Clear filters"
                  onCta={() => {
                    setQ("");
                    setFilters(EMPTY_FILTERS);
                    setSimpleView("upcoming");
                  }}
                />
              ) : (
                <>
                  {simpleView === "needs" ? (
                    <MeetingSection
                      title="Needs attention"
                      icon="flag"
                      meetings={filtered}
                      empty={{ icon: "check", title: "No meetings need attention", body: "Agendas, attendees, summaries, and follow-ups are covered." }}
                    />
                  ) : simpleView === "impact" ? (
                    <MeetingSection
                      title="Impact presentations this week"
                      icon="target"
                      meetings={filtered}
                      empty={{ icon: "target", title: "No impact presentations this week", body: "Global and chapter accountability meetings will appear here." }}
                    />
                  ) : simpleView === "officer" ? (
                    <MeetingSection
                      title="Officer meetings"
                      icon="compass"
                      meetings={filtered}
                      empty={{ icon: "compass", title: "No officer meeting this week", body: "Decision-focused officer meetings will appear here." }}
                    />
                  ) : simpleView === "chapter" ? (
                    <MeetingSection
                      title="Chapter impact presentations"
                      icon="map"
                      meetings={filtered}
                      empty={{ icon: "map", title: "No chapter presentation this week", body: "Chapter President updates will appear here." }}
                    />
                  ) : simpleView === "followups" ? (
                    <MeetingSection
                      title="Meeting follow-ups"
                      icon="flag"
                      meetings={filtered}
                      empty={{ icon: "check", title: "No meeting follow-ups open", body: "Every meeting commitment is closed or tracked." }}
                    />
                  ) : simpleView === "recent" ? (
                    <MeetingSection
                      title="Recent"
                      icon="check"
                      meetings={recentMeetings}
                      empty={{ icon: "checkCircle", title: "No recent meetings yet", body: "Completed meetings will appear here." }}
                    />
                  ) : simpleView === "all" ? (
                    <>
                      <MeetingSection
                        title="Needs attention"
                        icon="flag"
                        meetings={meetings.filter(meetingNeedsAttention)}
                      />
                      <MeetingSection
                        title="Officer meetings"
                        icon="compass"
                        meetings={meetings.filter((m) => m.meetingType === "OFFICER_MEETING")}
                      />
                      <MeetingSection
                        title="Impact presentations"
                        icon="target"
                        meetings={meetings.filter(isImpactPresentation)}
                      />
                      <MeetingSection
                        title="Upcoming"
                        icon="calendar"
                        meetings={upcomingMeetings}
                        empty={{ icon: "calendar", title: "No upcoming meetings", body: "Schedule a leadership sync, class review, or mentorship check-in when needed." }}
                      />
                      <MeetingSection
                        title="Recent"
                        icon="check"
                        meetings={recentMeetings}
                        empty={{ icon: "checkCircle", title: "No recent meetings yet", body: "Completed meetings will appear here." }}
                      />
                    </>
                  ) : (
                    <MeetingSection
                      title="Upcoming"
                      icon="calendar"
                      meetings={upcomingMeetings}
                      empty={{ icon: "calendar", title: "No upcoming meetings", body: "The rest of the week is open." }}
                    />
                  )}
                </>
              )}
            </div>

            {/* SIDEBAR */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Widget title="Leadership attention" icon="alert" count={attentionRows.length}>
                {attentionRows.length ? (
                  <div>
                    {attentionRows.map((row) => (
                      <AttentionRow key={`${row.meetingId}-${row.reason}`} row={row} />
                    ))}
                  </div>
                ) : (
                  <EmptyState compact icon="checkCircle" title="No attention items" body="No missing prep, summaries, attendance concerns, or stale follow-ups in this week." />
                )}
              </Widget>

              <Widget title="Decision queue" icon="checkCircle" count={decisionQueueRows.length}>
                {decisionQueueRows.length ? (
                  <div>
                    {decisionQueueRows.map((row) => (
                      <DecisionActionRow key={row.id} row={row} />
                    ))}
                  </div>
                ) : (
                  <EmptyState compact icon="check" title="No decisions waiting" body="Every previewed decision this week has been converted or linked to an action." />
                )}
              </Widget>

              <Widget title="Follow-ups still open" icon="flag" count={followQueue.length}>
                {followQueue.length ? (
                  <div>
                    {followQueue.slice(0, 6).map((f) => (
                      <FollowupRow key={f.id} f={f} />
                    ))}
                  </div>
                ) : (
                  <EmptyState compact icon="check" title="All follow-ups handled" body="Nothing is waiting on the team right now." />
                )}
              </Widget>

              <Widget title="Overdue actions from meetings" icon="alert" count={overdueActions.length}>
                {overdueActions.length ? (
                  <div>
                    {overdueActions.map((a) => (
                      <ActionMini key={a.id} a={a} />
                    ))}
                  </div>
                ) : (
                  <EmptyState compact icon="checkCircle" title="Nothing overdue" body="Every meeting action is on track." />
                )}
              </Widget>

              <Widget title="Recent decisions" icon="checkCircle" count={recentDecisions.length}>
                {recentDecisions.length ? (
                  <div>
                    {recentDecisions.map((d) => (
                      <DecisionRow key={d.id} dec={d} />
                    ))}
                  </div>
                ) : (
                  <EmptyState compact icon="doc" title="No decisions logged" body="Decisions made in meetings will be recorded here." />
                )}
              </Widget>

              <details>
                <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", padding: "0 2px" }}>
                  Follow-ups by area
                </summary>
                <div style={{ marginTop: 8 }}>
                  <Widget title="Follow-ups by area" icon="target">
                    {pulse.length ? (
                      <DepartmentPulse rows={pulse} />
                    ) : (
                      <EmptyState compact icon="target" title="No open follow-ups" body="Open follow-ups will show up here grouped by YPP area." />
                    )}
                  </Widget>
                </div>
              </details>
            </div>
          </div>
        </>
      )}

      {showNew && (
        <NewMeetingDrawer people={people} prefill={meetingPrefill} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}

// --- week nav ---------------------------------------------------------------

function MeetingViewSwitcher({
  view,
  setView,
  counts,
}: {
  view: SimpleMeetingView;
  setView: (view: SimpleMeetingView) => void;
  counts: Record<SimpleMeetingView, number>;
}) {
  const views: Array<{ key: SimpleMeetingView; label: string }> = [
    { key: "upcoming", label: "Upcoming" },
    { key: "needs", label: "Needs attention" },
    { key: "impact", label: "Impact" },
    { key: "officer", label: "Officer" },
    { key: "chapter", label: "Chapter" },
    { key: "followups", label: "Follow-ups" },
    { key: "recent", label: "Recent" },
    { key: "all", label: "All" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {views.map((option) => {
        const active = view === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => setView(option.key)}
            aria-pressed={active}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              border: `1px solid ${active ? "var(--ypp-purple-600)" : "var(--border)"}`,
              background: active ? "var(--ypp-purple-600)" : "var(--surface)",
              color: active ? "#fff" : "var(--text-secondary)",
              padding: "7px 11px",
              font: "inherit",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {option.label}
            <span style={{ opacity: 0.78, fontVariantNumeric: "tabular-nums" }}>
              {counts[option.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WeekNav({
  weekLabel,
  weekOffset,
  hrefFor,
}: {
  weekLabel: string;
  weekOffset: number;
  hrefFor: (offset: number) => string;
}) {
  const navBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 9,
    color: "var(--text-secondary)",
    textDecoration: "none",
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 4 }}>
      <Link href={hrefFor(weekOffset - 1)} aria-label="Previous week" style={navBtn}>
        <MeetingIcon name="chevL" size={18} />
      </Link>
      <Link
        href={hrefFor(0)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 12px",
          borderRadius: 9,
          textDecoration: "none",
          background: weekOffset === 0 ? "var(--ypp-purple-100)" : "transparent",
          color: weekOffset === 0 ? "var(--ypp-purple-700)" : "var(--text-secondary)",
        }}
      >
        <MeetingIcon name="calendar" size={15} />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{weekLabel}</span>
        {weekOffset === 0 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ypp-purple-600)", background: "var(--surface)", border: "1px solid var(--ypp-purple-200)", borderRadius: 999, padding: "1px 7px" }}>
            This week
          </span>
        )}
      </Link>
      <Link href={hrefFor(weekOffset + 1)} aria-label="Next week" style={navBtn}>
        <MeetingIcon name="chevR" size={18} />
      </Link>
    </div>
  );
}

function OperatingRhythmSummary({
  meetings,
  attentionCount,
}: {
  meetings: MeetingCardDTO[];
  attentionCount: number;
}) {
  const stats = [
    {
      label: "Total meetings",
      value: meetings.length,
      icon: "calendar" as MeetingIconName,
      tone: "purple",
    },
    {
      label: "Upcoming",
      value: meetings.filter(
        (m) =>
          m.effectiveStatus === "today" ||
          m.effectiveStatus === "in_progress" ||
          m.effectiveStatus === "upcoming"
      ).length,
      icon: "clock" as MeetingIconName,
      tone: "purple",
    },
    {
      label: "Completed",
      value: meetings.filter((m) => m.effectiveStatus === "completed").length,
      icon: "checkCircle" as MeetingIconName,
      tone: "success",
    },
    {
      label: "Impact",
      value: meetings.filter(isImpactPresentation).length,
      icon: "target" as MeetingIconName,
      tone: "neutral",
    },
    {
      label: "Attendance",
      value: attendancePercentLabel(meetings),
      icon: "user" as MeetingIconName,
      tone: meetings.some((m) => (m.attendanceConcernCount ?? 0) > 0) ? "danger" : "success",
    },
    {
      label: "Needs attention",
      value: attentionCount,
      icon: "alert" as MeetingIconName,
      tone: attentionCount > 0 ? "danger" : "success",
    },
  ];

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))" }}>
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            style={{
              padding: "14px 15px",
              borderLeft: index === 0 ? "none" : "1px solid var(--border)",
              borderTop: index === 0 ? "none" : undefined,
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  stat.tone === "danger"
                    ? "var(--danger-bg)"
                    : stat.tone === "warning"
                      ? "var(--warn-bg, #fdf0d9)"
                      : stat.tone === "success"
                        ? "var(--success-bg)"
                        : "var(--ypp-purple-100)",
                color:
                  stat.tone === "danger"
                    ? "var(--danger-fg)"
                    : stat.tone === "warning"
                      ? "var(--warn-fg, #a45a09)"
                      : stat.tone === "success"
                        ? "var(--success-fg)"
                        : "var(--ypp-purple-600)",
              }}
            >
              <MeetingIcon name={stat.icon} size={15} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 18, fontWeight: 800, color: "var(--ypp-ink)", lineHeight: 1 }}>
                {stat.value}
              </span>
              <span style={{ display: "block", marginTop: 3, fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>
                {stat.label}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function attendancePercentLabel(meetings: MeetingCardDTO[]): string {
  const required = meetings.reduce((sum, m) => sum + (m.requiredAttendeeCount ?? m.attendeeCount ?? 0), 0);
  const recorded = meetings.reduce((sum, m) => sum + (m.attendanceRecordedCount ?? 0), 0);
  if (required <= 0) return "0%";
  return `${Math.round((recorded / required) * 100)}%`;
}

function AttentionRow({ row }: { row: AttentionRowData }) {
  const color =
    row.tone === "danger"
      ? "var(--danger-fg)"
      : row.tone === "warning"
        ? "var(--warn-fg, #a45a09)"
        : "var(--ypp-purple-600)";
  return (
    <Link
      href={row.href}
      style={{ display: "flex", gap: 10, padding: "10px 0", textDecoration: "none", borderTop: "1px solid var(--border)" }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: row.tone === "danger" ? "var(--danger-bg)" : "var(--chip-bg)",
          color,
        }}
      >
        <MeetingIcon name={row.tone === "danger" ? "alert" : "flag"} size={14} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ypp-ink)", lineHeight: 1.35 }}>
          {row.reason}
        </span>
        <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.title}
        </span>
      </span>
      <MeetingIcon name="arrowR" size={13} style={{ color: "var(--muted)", marginTop: 6 }} />
    </Link>
  );
}

function DecisionActionRow({ row }: { row: DecisionQueueRowData }) {
  return (
    <Link
      href={`/actions/meetings/${row.meetingId}#decisions`}
      style={{ display: "flex", gap: 10, padding: "10px 0", textDecoration: "none", borderTop: "1px solid var(--border)" }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--warn-bg, #fdf0d9)",
          color: "var(--warn-fg, #a45a09)",
        }}
      >
        <MeetingIcon name="checkCircle" size={14} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ypp-ink)", lineHeight: 1.35 }}>
          {row.decision}
        </span>
        <span style={{ display: "block", marginTop: 3, fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.decidedByName ? `${row.decidedByName} · ` : ""}
          {row.meetingTitle}
        </span>
      </span>
      <MeetingIcon name="arrowR" size={13} style={{ color: "var(--muted)", marginTop: 6 }} />
    </Link>
  );
}

// --- filter bar -------------------------------------------------------------

const SELECT_STYLE: React.CSSProperties = {
  font: "inherit",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-secondary)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "7px 9px",
  cursor: "pointer",
};

function FilterBar({
  q,
  setQ,
  filters,
  setFilters,
  owners,
}: {
  q: string;
  setQ: (v: string) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  owners: PersonOption[];
}) {
  const set = (k: keyof Filters, v: string | boolean) => setFilters({ ...filters, [k]: v });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 230px", minWidth: 200 }}>
        <MeetingIcon name="search" size={16} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search meetings…"
          style={{
            width: "100%",
            font: "inherit",
            fontSize: 13.5,
            color: "var(--ypp-ink)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "8px 10px 8px 34px",
            boxSizing: "border-box",
          }}
        />
      </div>
      <select value={filters.status} onChange={(e) => set("status", e.target.value)} style={SELECT_STYLE} aria-label="Filter by status">
        <option value="">All statuses</option>
        {STATUS_FILTER_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select value={filters.category} onChange={(e) => set("category", e.target.value)} style={SELECT_STYLE} aria-label="Filter by category">
        <option value="">All categories</option>
        {MEETING_CATEGORY_VALUES.map((c) => (
          <option key={c} value={c}>
            {meetingCategoryLabel(c)}
          </option>
        ))}
      </select>
      <select value={filters.meetingType} onChange={(e) => set("meetingType", e.target.value)} style={SELECT_STYLE} aria-label="Filter by meeting type">
        <option value="">All meeting types</option>
        {MEETING_TYPE_VALUES.map((type) => (
          <option key={type} value={type}>
            {meetingOperatingModel(type).label}
          </option>
        ))}
      </select>
      <select value={filters.owner} onChange={(e) => set("owner", e.target.value)} style={SELECT_STYLE} aria-label="Filter by owner">
        <option value="">All owners</option>
        {owners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <FilterToggle active={filters.overdue} onClick={() => set("overdue", !filters.overdue)} icon="alert" label="Has overdue" />
      <FilterToggle active={filters.hasActions} onClick={() => set("hasActions", !filters.hasActions)} icon="bolt" label="Has open actions" />
    </div>
  );
}

function FilterToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: MeetingIconName; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        font: "inherit",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        padding: "7px 11px",
        borderRadius: 999,
        background: active ? "var(--ypp-purple-600)" : "var(--surface)",
        color: active ? "#fff" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--ypp-purple-600)" : "var(--border)"}`,
      }}
    >
      <MeetingIcon name={icon} size={14} />
      {label}
    </button>
  );
}

// --- sections + widgets -----------------------------------------------------

function MeetingSection({
  title,
  icon,
  meetings,
  empty,
}: {
  title: string;
  icon: MeetingIconName;
  meetings: MeetingCardDTO[];
  empty?: { icon: MeetingIconName; title: string; body: string };
}) {
  return (
    <section>
      <SectionTitle icon={icon} count={meetings.length}>
        {title}
      </SectionTitle>
      {meetings.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      ) : empty ? (
        <EmptyState compact {...empty} />
      ) : null}
    </section>
  );
}

function Widget({ title, icon, count, children }: { title: string; icon: MeetingIconName; count?: number; children: React.ReactNode }) {
  return (
    <Card style={{ padding: "15px 16px" }}>
      <SectionTitle icon={icon} count={count}>
        {title}
      </SectionTitle>
      {children}
    </Card>
  );
}

function FollowupRow({ f }: { f: FollowQueueRow }) {
  const du = dueText(f.dueISO);
  const dot = f.effectiveStatus === "overdue" ? "var(--danger-fg)" : meetingCategoryTone(f.area).dot;
  return (
    <Link
      href={`/actions/meetings/${f.meetingId}`}
      style={{ display: "flex", gap: 10, padding: "10px 0", textDecoration: "none", borderTop: "1px solid var(--border)" }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, marginTop: 6, flex: "0 0 auto", background: dot }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ypp-ink)", lineHeight: 1.35 }}>{f.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
          {f.ownerName && <Avatar name={f.ownerName} size={18} />}
          {f.ownerName && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{f.ownerName.split(" ")[0]}</span>}
          <span style={{ fontSize: 11.5, fontWeight: 700, color: du.overdue ? "var(--danger-fg)" : "var(--muted)" }}>
            · {du.label}
          </span>
          {f.tracked && (
            <Pill tone="purple" style={{ fontSize: 10.5, padding: "1px 7px" }}>
              <MeetingIcon name="bolt" size={10} />
              Tracked
            </Pill>
          )}
        </div>
      </div>
    </Link>
  );
}

function ActionMini({ a }: { a: OverdueActionRow }) {
  const du = dueText(a.dueISO);
  const inner = (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--danger-bg)", color: "var(--danger-fg)" }}>
        <MeetingIcon name="bolt" size={14} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ypp-ink)", lineHeight: 1.35 }}>{a.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
          {a.ownerName && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.ownerName.split(" ")[0]}</span>}
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger-fg)" }}>· {du.label}</span>
          {a.meetingTitle && (
            <span style={{ fontSize: 11, color: "var(--ypp-purple-600)", fontWeight: 600 }}>· {a.meetingTitle.split(" ").slice(0, 2).join(" ")}</span>
          )}
        </div>
      </div>
    </div>
  );
  return a.meetingId ? (
    <Link href={`/actions/meetings/${a.meetingId}`} style={{ textDecoration: "none" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function DecisionRow({ dec }: { dec: RecentDecisionRow }) {
  return (
    <div style={{ padding: "11px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13.5, color: "var(--ypp-ink)", lineHeight: 1.4, fontWeight: 600 }}>&ldquo;{dec.text}&rdquo;</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, flexWrap: "wrap" }}>
        {dec.decidedByName && <Avatar name={dec.decidedByName} size={18} />}
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
          {dec.decidedByName ? `${dec.decidedByName.split(" ")[0]} · ` : ""}
          {fmtDate(dec.dateISO)}
        </span>
        <Link
          href={`/actions/meetings/${dec.meetingId}`}
          style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ypp-purple-600)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
        >
          {dec.meetingTitle.split(" ").slice(0, 2).join(" ")}
          <MeetingIcon name="arrowR" size={12} />
        </Link>
      </div>
    </div>
  );
}

function DepartmentPulse({ rows }: { rows: PulseRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, i) => {
        const tone = meetingCategoryTone(r.area);
        return (
          <div key={r.area} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ypp-ink)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: tone.dot }} />
                {meetingCategoryLabel(r.area)}
                {i === 0 && (
                  <Pill tone="warning" style={{ fontSize: 10, padding: "0 7px" }}>
                    Most loaded
                  </Pill>
                )}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {r.open} open{r.overdue ? ` · ${r.overdue} overdue` : ""}
              </span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: "var(--chip-bg)", overflow: "hidden", display: "flex" }}>
              <div
                style={{
                  width: `${(r.open / max) * 100}%`,
                  background: r.overdue ? `linear-gradient(90deg,${tone.dot},var(--danger-fg))` : tone.dot,
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
