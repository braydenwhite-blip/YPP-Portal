import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { startOfDay } from "@/lib/leadership-action-center/dates";
import { listActionAssignableUsers } from "@/lib/people-strategy/action-queries";
import {
  computeDepartmentPulse,
  computeFollowUpStatus,
  weekRangeForOffset,
  type EffectiveMeetingStatus,
} from "@/lib/people-strategy/meetings-status";
import {
  listMeetingsInRange,
  listRecentDecisions,
  mapMeetingToCardDTO,
  mapMeetingToView,
  meetingDisplayTitle,
  type MeetingCardDTO,
} from "@/lib/people-strategy/meetings-queries";
import {
  meetingNextAction,
  PRIMARY_MEETING_MODE_META,
  selectPrimaryMeeting,
} from "@/lib/people-strategy/meeting-command-center";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { isMeetingCategory } from "@/lib/people-strategy/meeting-categories";
import {
  areaForRelatedEntityType,
  normalizeRelatedEntityType,
} from "@/lib/people-strategy/operational-context";
import { loadOfficerMeetingPrep } from "@/lib/people-strategy/officer-meeting-prep-queries";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { OfficerMeetingsPrepClient } from "@/components/people-strategy/officer-meetings-prep-client";
import { PageHeaderV2, type StatusTone } from "@/components/ui-v2";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import {
  EmptySimpleState,
  PrimaryFocusCard,
  SimpleListCard,
  SimpleRow,
  SimpleSurface,
  type SimpleAction,
} from "@/components/command-center/simple";
import { MeetingPrepQueue, PostMeetingQueue } from "@/components/queue";
import { getEngineQueue } from "@/lib/queue/engine";
import { loadQueueEngine } from "@/lib/queue/load";
import {
  WeeklyCommandCenterClient,
  type FollowQueueRow,
  type OverdueActionRow,
  type PulseRow,
  type RecentDecisionRow,
} from "@/components/people-strategy/weekly-command-center-client";
import type {
  MeetingPrefill,
  PersonOption,
} from "@/components/people-strategy/new-meeting-drawer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Officer Meetings · Operations" };

function parseWeekOffset(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(-52, Math.min(52, n));
}

function formatWeekLabel(start: Date, end: Date): string {
  const longFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  const startStr = longFmt.format(start);
  const endStr =
    start.getMonth() === end.getMonth() ? String(end.getDate()) : longFmt.format(end);
  return `${startStr} – ${endStr}`;
}

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

const MEETING_STATUS: Record<EffectiveMeetingStatus, { label: string; tone: StatusTone }> = {
  in_progress: { label: "Live now", tone: "info" },
  today: { label: "Today", tone: "brand" },
  upcoming: { label: "Upcoming", tone: "neutral" },
  completed: { label: "Done", tone: "success" },
  needs_follow_up: { label: "Needs wrap-up", tone: "warning" },
  canceled: { label: "Canceled", tone: "neutral" },
};

const FOLLOWUP_TONE: Record<string, StatusTone> = {
  overdue: "danger",
  in_progress: "info",
  open: "neutral",
  completed: "success",
};

function withRelated(m: MeetingCardDTO) {
  return { ...m, hasRelatedEntity: !!m.relatedEntityType && !!m.relatedEntityId };
}

function MeetingRowSimple({ meeting }: { meeting: MeetingCardDTO }) {
  const status = MEETING_STATUS[meeting.effectiveStatus];
  const outputs: string[] = [];
  if (meeting.openLinkedActions > 0) outputs.push(`${meeting.openLinkedActions} open`);
  if (meeting.decisionCount > 0) outputs.push(`${meeting.decisionCount} decided`);
  if (meeting.overdueFollowUps > 0) outputs.push(`${meeting.overdueFollowUps} overdue`);
  return (
    <SimpleRow
      href={`/actions/meetings/${meeting.id}`}
      icon="calendar"
      name={meeting.title}
      what={fmtWhen(meeting.startISO)}
      related={meeting.facilitator?.name ?? null}
      status={status ? { label: status.label, tone: status.tone } : null}
      meta={outputs.length > 0 ? outputs.join(" · ") : null}
    />
  );
}

function MeetingTrackerFocus({ cards, now }: { cards: MeetingCardDTO[]; now: Date }) {
  const selection = selectPrimaryMeeting(cards.map(withRelated), now);
  if (!selection) {
    return (
      <PrimaryFocusCard
        eyebrow="Meetings"
        title="No meeting needs you right now."
        reason="Nothing is live, nothing is coming up this week, and finished meetings are wrapped up."
        icon="check"
        tone="success"
        ctaLabel="Schedule a meeting"
        ctaHref="/actions/meetings/new"
      />
    );
  }
  const m = selection.meeting;
  const meta = PRIMARY_MEETING_MODE_META[selection.mode];
  const next = meetingNextAction(m);
  const when = selection.mode === "current" ? "Happening now" : fmtWhen(m.startISO);
  const bits = [when, m.facilitator?.name ?? null].filter(Boolean).join(" · ");
  return (
    <PrimaryFocusCard
      eyebrow={meta.eyebrow}
      title={m.title}
      reason={`${bits}. ${next.reason}`}
      icon="calendar"
      ctaLabel={next.label}
      ctaHref={next.href}
    />
  );
}

function FollowUpRowSimple({ row }: { row: FollowQueueRow }) {
  return (
    <SimpleRow
      href={`/actions/meetings/${row.meetingId}`}
      icon="flag"
      name={row.title}
      what={row.ownerName ?? "Unassigned"}
      status={{
        label: row.effectiveStatus === "overdue" ? "Overdue" : "Open",
        tone: FOLLOWUP_TONE[row.effectiveStatus] ?? "neutral",
      }}
      meta={row.dueISO ? `Due ${fmtWhen(row.dueISO).split(",").slice(0, 2).join(",")}` : null}
    />
  );
}

async function WeekGridView({
  viewer,
  now,
  searchParams,
}: {
  viewer: NonNullable<Awaited<ReturnType<typeof requireOfficer>>>;
  now: Date;
  searchParams: Record<string, string | undefined>;
}) {
  const weekOffset = parseWeekOffset(searchParams.week);
  const { start, end } = weekRangeForOffset(weekOffset, now);

  const prefillType = normalizeRelatedEntityType(searchParams.relatedType);
  const prefillId = searchParams.relatedId?.trim() || null;
  const titleParam = searchParams.title?.trim().slice(0, 300) ?? "";
  const purposeParam = searchParams.purpose?.trim().slice(0, 2000) ?? "";
  const areaParam =
    searchParams.area && isMeetingCategory(searchParams.area.trim().toUpperCase())
      ? searchParams.area.trim().toUpperCase()
      : null;

  let meetingPrefill: MeetingPrefill | undefined;
  if (prefillType && prefillId) {
    const summary = await loadRelatedEntitySummary(prefillType, prefillId).catch(() => null);
    if (summary) {
      meetingPrefill = {
        category: areaParam ?? areaForRelatedEntityType(prefillType),
        relatedEntityType: prefillType,
        relatedEntityId: prefillId,
        relatedEntityLabel: summary.label,
        title: titleParam || null,
        purpose: purposeParam || null,
      };
    }
  } else if (titleParam || purposeParam || areaParam) {
    meetingPrefill = {
      category: areaParam,
      title: titleParam || null,
      purpose: purposeParam || null,
    };
  }

  const [meetings, recentDecisions, assignableUsers] = await Promise.all([
    listMeetingsInRange(start, end),
    listRecentDecisions(8),
    listActionAssignableUsers(),
  ]);

  const views = meetings.map(mapMeetingToView);
  const cards = meetings.map((m) => mapMeetingToCardDTO(m, now));
  const pulse: PulseRow[] = computeDepartmentPulse(views, now).map((r) => ({
    area: r.area,
    open: r.open,
    overdue: r.overdue,
  }));

  const followQueue: FollowQueueRow[] = meetings
    .flatMap((m) =>
      m.followUps
        .filter((f) => f.status !== "COMPLETED")
        .map((f) => ({
          id: f.id,
          title: f.title,
          ownerName: f.owner ? personName(f.owner) : null,
          dueISO: f.dueDate ? f.dueDate.toISOString() : null,
          effectiveStatus: computeFollowUpStatus({ status: f.status, dueDate: f.dueDate }, now),
          area: f.area ?? m.category ?? null,
          tracked: !!f.linkedActionId,
          meetingId: m.id,
        }))
    )
    .sort((a, b) => {
      const ao = a.effectiveStatus === "overdue" ? 0 : 1;
      const bo = b.effectiveStatus === "overdue" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if (a.dueISO && b.dueISO) return a.dueISO.localeCompare(b.dueISO);
      if (a.dueISO) return -1;
      if (b.dueISO) return 1;
      return 0;
    });

  const overdueActions: OverdueActionRow[] = meetings
    .flatMap((m) =>
      m.actionItems
        .filter((a) => a.status !== "COMPLETE" && startOfDay(a.deadlineStart) < startOfDay(now))
        .map((a) => ({
          id: a.id,
          title: a.title,
          ownerName: a.lead ? personName(a.lead) : null,
          dueISO: a.deadlineStart.toISOString(),
          meetingId: m.id,
          meetingTitle: meetingDisplayTitle(m),
        }))
    )
    .sort((a, b) => a.dueISO.localeCompare(b.dueISO));

  const recentDecisionRows: RecentDecisionRow[] = recentDecisions.map((d) => ({
    id: d.id,
    text: d.decision,
    decidedByName: d.decidedBy ? personName(d.decidedBy) : null,
    dateISO: d.createdAt.toISOString(),
    meetingId: d.officerMeeting.id,
    meetingTitle: meetingDisplayTitle(d.officerMeeting),
  }));

  const people: PersonOption[] = assignableUsers.map((u) => ({
    id: u.id,
    name: personName(u),
  }));

  const ownerIds = new Set<string>();
  for (const m of meetings) {
    if (m.facilitatorId) ownerIds.add(m.facilitatorId);
    for (const a of m.attendees) ownerIds.add(a.userId);
  }
  const owners: PersonOption[] = people.filter((p) => ownerIds.has(p.id));

  const actionViewer = {
    id: viewer.id,
    roles: viewer.roles,
    primaryRole: viewer.primaryRole,
    adminSubtypes: viewer.adminSubtypes,
  };
  const queueEngine = await loadQueueEngine(actionViewer, { now }).catch(() => null);
  const meetingPrepItems = queueEngine ? getEngineQueue(queueEngine, "meeting-prep", now) : [];
  const postMeetingItems = queueEngine ? getEngineQueue(queueEngine, "post-meeting", now) : [];

  const upcoming = cards
    .filter(
      (m) =>
        m.effectiveStatus === "in_progress" ||
        m.effectiveStatus === "today" ||
        m.effectiveStatus === "upcoming"
    )
    .slice(0, 5);
  const openFollowUps = followQueue.slice(0, 5);

  const calm = (
    <div className="flex flex-col gap-4">
      <SimpleListCard title={`This week · ${formatWeekLabel(start, end)}`}>
        {upcoming.length > 0 ? (
          upcoming.map((m) => <MeetingRowSimple key={m.id} meeting={m} />)
        ) : (
          <EmptySimpleState icon="calendar">No meetings scheduled this week.</EmptySimpleState>
        )}
      </SimpleListCard>
      {followQueue.length > 0 ? (
        <SimpleListCard title="Open follow-ups">
          {openFollowUps.map((row) => (
            <FollowUpRowSimple key={row.id} row={row} />
          ))}
        </SimpleListCard>
      ) : null}
    </div>
  );

  const strip: SimpleAction[] = [
    { label: "Officer prep", href: "/actions/meetings", icon: "calendar", primary: true },
    { label: "New meeting", href: "/actions/meetings/new", icon: "calendar" },
    { label: "Previous week", href: `/actions/meetings?view=week&week=${weekOffset - 1}`, icon: "arrowRight" },
    { label: "Next week", href: `/actions/meetings?view=week&week=${weekOffset + 1}`, icon: "arrowRight" },
  ];

  return (
    <SimpleSurface
      maxWidth={1120}
      header={
        <div className="flex flex-col gap-4">
          <PageHeaderV2
            eyebrow="Meetings"
            backHref="/meetings"
            backLabel="Meetings"
            title="Officer Meetings · week grid"
            subtitle="Every meeting this week, prep lanes, decisions, and department pulse."
            actions={<CommandModeToggle />}
          />
          <ActionTrackerTabsV2 active="meetings" />
        </div>
      }
      focus={<MeetingTrackerFocus cards={cards} now={now} />}
      calm={calm}
      actions={strip}
      browseLabel="Full meeting tracker"
      browseHint="Filter, search, and open any meeting workspace."
    >
      <div className="flex flex-col gap-5">
        {meetingPrepItems.length > 0 || postMeetingItems.length > 0 ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <MeetingPrepQueue items={meetingPrepItems} />
            <PostMeetingQueue items={postMeetingItems} />
          </div>
        ) : null}
        <WeeklyCommandCenterClient
          meetings={cards}
          nowISO={now.toISOString()}
          followQueue={followQueue}
          overdueActions={overdueActions}
          recentDecisions={recentDecisionRows}
          pulse={pulse}
          weekLabel={formatWeekLabel(start, end)}
          weekOffset={weekOffset}
          people={people}
          owners={owners}
          meetingPrefill={meetingPrefill}
          autoOpenNew={false}
        />
      </div>
    </SimpleSurface>
  );
}

export default async function OfficerMeetingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    view?: string;
    week?: string;
    new?: string;
    relatedType?: string;
    relatedId?: string;
    title?: string;
    purpose?: string;
    area?: string;
  }>;
}) {
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const sp = (await searchParams) ?? {};

  if (sp.new === "1") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "new" || key === "week" || key === "view") continue;
      const v = Array.isArray(value) ? value[0] : value;
      if (v) params.set(key, v);
    }
    const qs = params.toString();
    redirect(qs ? `/actions/meetings/new?${qs}` : "/actions/meetings/new");
  }

  if (sp.view === "week") {
    return (
      <WeekGridView
        viewer={viewer}
        now={now}
        searchParams={{
          week: sp.week,
          relatedType: sp.relatedType,
          relatedId: sp.relatedId,
          title: sp.title,
          purpose: sp.purpose,
          area: sp.area,
        }}
      />
    );
  }

  const prep = await loadOfficerMeetingPrep(
    {
      id: viewer.id,
      roles: viewer.roles,
      primaryRole: viewer.primaryRole,
      adminSubtypes: viewer.adminSubtypes,
    },
    now
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      <div className="mb-4 flex flex-col gap-4">
        <PageHeaderV2
          eyebrow="Meetings"
          backHref="/meetings"
          backLabel="Meetings"
          title="Officer Meetings"
          subtitle="Leadership operating sessions — decisions, blockers, ownerless items, and cross-team escalations. Distinct from Impact Meetings, which collect weekly team updates."
          actions={
            <div className="flex items-center gap-2">
              <CommandModeToggle />
              <Link
                href="/actions/meetings/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] px-3.5 text-[12.5px] font-semibold text-white no-underline hover:opacity-95"
              >
                + Schedule meeting
              </Link>
            </div>
          }
        />
        <ActionTrackerTabsV2 active="meetings" />
      </div>

      <OfficerMeetingsPrepClient data={prep} />
    </div>
  );
}
