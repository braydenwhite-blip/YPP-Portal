import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { startOfDay } from "@/lib/leadership-action-center/dates";
import { listActionAssignableUsers } from "@/lib/people-strategy/action-queries";
import {
  computeDashboardMetrics,
  computeDepartmentPulse,
  computeFollowUpStatus,
  weekRangeForOffset,
} from "@/lib/people-strategy/meetings-status";
import {
  listMeetingsInRange,
  listRecentDecisions,
  mapMeetingToCardDTO,
  mapMeetingToView,
  meetingDisplayTitle,
} from "@/lib/people-strategy/meetings-queries";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { isMeetingCategory } from "@/lib/people-strategy/meeting-categories";
import {
  areaForRelatedEntityType,
  normalizeRelatedEntityType,
} from "@/lib/people-strategy/operational-context";
import { ActionTrackerBack } from "@/components/people-strategy/action-tracker-tabs";
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
export const metadata = { title: "Meetings · Operations" };

function parseWeekOffset(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(n)) return 0;
  // Bound the offset so a hand-edited URL can't wander years away.
  return Math.max(-52, Math.min(52, n));
}

function formatWeekLabel(start: Date, end: Date): string {
  const longFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  const startStr = longFmt.format(start);
  const endStr =
    start.getMonth() === end.getMonth() ? String(end.getDate()) : longFmt.format(end);
  return `${startStr} – ${endStr}`;
}

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

export default async function WeeklyCommandCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{
    week?: string;
    new?: string;
    relatedType?: string;
    relatedId?: string;
    title?: string;
    purpose?: string;
    area?: string;
  }>;
}) {
  // Outer gate: with ENABLE_ACTION_TRACKER off the route does not exist.
  if (!isActionTrackerEnabled()) notFound();

  // Officer-tier and above only (mirrors requireOfficer()); deny with a 404 so
  // the route's existence is not leaked to members.
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const sp = (await searchParams) ?? {};
  const weekOffset = parseWeekOffset(sp.week);
  const { start, end } = weekRangeForOffset(weekOffset, now);

  // Create-from-context: an entity page can deep-link here with ?new=1 plus the
  // entity to link, so a meeting is born already connected to that surface.
  const prefillType = normalizeRelatedEntityType(sp.relatedType);
  const prefillId = sp.relatedId?.trim() || null;
  // Scalar prefill (title / purpose / area) so a digest "schedule a meeting" CTA
  // can suggest what the meeting is for. Sanitized; an unknown area is dropped.
  const titleParam = typeof sp.title === "string" ? sp.title.trim().slice(0, 300) : "";
  const purposeParam = typeof sp.purpose === "string" ? sp.purpose.trim().slice(0, 2000) : "";
  const areaParam =
    sp.area && isMeetingCategory(sp.area.trim().toUpperCase())
      ? sp.area.trim().toUpperCase()
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
    // An issue-driven meeting with no entity link still carries its context.
    meetingPrefill = {
      category: areaParam,
      title: titleParam || null,
      purpose: purposeParam || null,
    };
  }
  const autoOpenNew = sp.new === "1" && !!meetingPrefill;

  const [meetings, recentDecisions, assignableUsers] = await Promise.all([
    listMeetingsInRange(start, end),
    listRecentDecisions(8),
    listActionAssignableUsers(),
  ]);

  const views = meetings.map(mapMeetingToView);
  const cards = meetings.map((m) => mapMeetingToCardDTO(m, now));
  const metrics = computeDashboardMetrics(views, now);
  const pulse: PulseRow[] = computeDepartmentPulse(views, now).map((r) => ({
    area: r.area,
    open: r.open,
    overdue: r.overdue,
  }));

  // Sidebar: open follow-ups across the week, overdue first then soonest-due.
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

  // Sidebar: meeting-generated Action Items that are overdue and still open.
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

  // Owner filter: just the people who actually facilitate / attend this week.
  const ownerIds = new Set<string>();
  for (const m of meetings) {
    if (m.facilitatorId) ownerIds.add(m.facilitatorId);
    for (const a of m.attendees) ownerIds.add(a.userId);
  }
  const owners: PersonOption[] = people.filter((p) => ownerIds.has(p.id));

  return (
    <div className="page-shell" style={{ maxWidth: 1280 }}>
      <ActionTrackerBack />
      <WeeklyCommandCenterClient
        meetings={cards}
        metrics={metrics}
        followQueue={followQueue}
        overdueActions={overdueActions}
        recentDecisions={recentDecisionRows}
        pulse={pulse}
        weekLabel={formatWeekLabel(start, end)}
        weekOffset={weekOffset}
        people={people}
        owners={owners}
        meetingPrefill={meetingPrefill}
        autoOpenNew={autoOpenNew}
      />
    </div>
  );
}
