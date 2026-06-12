"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  MEETING_CATEGORY_VALUES,
  meetingCategoryLabel,
  meetingCategoryTone,
} from "@/lib/people-strategy/meeting-categories";
import type { DashboardMetrics } from "@/lib/people-strategy/meetings-status";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import { MeetingCard } from "./meeting-card";
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
  owner: string;
  overdue: boolean;
  hasActions: boolean;
}

const EMPTY_FILTERS: Filters = { status: "", category: "", owner: "", overdue: false, hasActions: false };
type SimpleMeetingView = "upcoming" | "needs" | "recent" | "all";

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "in_progress", label: "In Progress" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "needs_follow_up", label: "Needs Follow-Up" },
  { value: "canceled", label: "Canceled" },
];

export function WeeklyCommandCenterClient({
  meetings,
  metrics,
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
}: {
  meetings: MeetingCardDTO[];
  metrics: DashboardMetrics;
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
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [simpleView, setSimpleView] = useState<SimpleMeetingView>("upcoming");
  const [showNew, setShowNew] = useState(autoOpenNew);

  const anyAdvancedFilter =
    !!q || !!filters.status || !!filters.category || !!filters.owner || filters.overdue || filters.hasActions;
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
        m.effectiveStatus !== "needs_follow_up" &&
        m.openFollowUps === 0 &&
        m.overdueFollowUps === 0
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
    (m) =>
      m.effectiveStatus === "needs_follow_up" ||
      m.openFollowUps > 0 ||
      m.overdueFollowUps > 0
  ).length;

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
            YPP Leadership OS
          </span>
          <h1 style={{ margin: "7px 0 0", fontSize: 30, fontWeight: 800, color: "var(--ypp-ink)", letterSpacing: "-.02em" }}>
            Meetings
          </h1>
          <p style={{ margin: "7px 0 0", fontSize: 14.5, color: "var(--muted)", maxWidth: 560, lineHeight: 1.45 }}>
            Where decisions and follow-ups come from &mdash; this week&rsquo;s meetings, decisions, and the actions they created.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <WeekNav weekLabel={weekLabel} weekOffset={weekOffset} hrefFor={weekHref} />
          <Link href="/work" style={{ textDecoration: "none" }}>
            <MeetingButton variant="outline" icon="bolt">
              Open Work
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
          <Card style={{ padding: "16px 18px", borderColor: metrics.overdueFollowUps > 0 ? "var(--danger-border, #f3cccc)" : "var(--border)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ypp-purple-600)" }}>
                  Start here
                </span>
                <h2 style={{ margin: "5px 0 0", fontSize: 18, lineHeight: 1.2, color: "var(--ypp-ink)" }}>
                  {metrics.overdueFollowUps > 0
                    ? "Close overdue follow-ups first."
                    : allNeedsFollowUpCount > 0
                      ? "Close the meetings that still need follow-up."
                      : "Review upcoming meetings."}
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.45, color: "var(--muted)" }}>
                  Meetings are useful when decisions and follow-ups become tracked actions.
                </p>
              </div>
              <MeetingButton
                variant={allNeedsFollowUpCount > 0 ? "outline" : "solid"}
                icon={allNeedsFollowUpCount > 0 ? "flag" : "calendar"}
                onClick={() => setSimpleView(allNeedsFollowUpCount > 0 ? "needs" : "upcoming")}
              >
                {allNeedsFollowUpCount > 0 ? "Review follow-ups" : "View upcoming"}
              </MeetingButton>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 13 }}>
              <SummaryPill value={metrics.meetingsThisWeek} label="this week" />
              <SummaryPill value={metrics.needsFollowUp} label="need follow-up" tone={metrics.needsFollowUp > 0 ? "warning" : "default"} />
              <SummaryPill value={metrics.overdueFollowUps} label="overdue follow-ups" tone={metrics.overdueFollowUps > 0 ? "danger" : "default"} />
              <SummaryPill value={metrics.openMeetingActions} label="open actions" />
            </div>
          </Card>

          <Card style={{ padding: "11px 12px" }}>
            <MeetingViewSwitcher
              view={simpleView}
              setView={setSimpleView}
              counts={{
                upcoming: allUpcomingMeetings.length,
                needs: allNeedsFollowUpCount,
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
                      title="Needs follow-up"
                      icon="flag"
                      meetings={filtered}
                      empty={{ icon: "check", title: "No meetings need follow-up", body: "Every meeting in this view is closed out." }}
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
                        title="Needs follow-up"
                        icon="flag"
                        meetings={groups.needs}
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

function SummaryPill({
  value,
  label,
  tone = "default",
}: {
  value: number;
  label: string;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid var(--border)",
        borderRadius: 999,
        background: "var(--surface)",
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        color:
          tone === "danger"
            ? "var(--danger-fg)"
            : tone === "warning"
              ? "var(--warn-fg, #854d0e)"
              : "var(--text-secondary)",
      }}
    >
      <strong style={{ color: "inherit", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
      {label}
    </span>
  );
}

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
    { key: "needs", label: "Needs follow-up" },
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
