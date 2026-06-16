import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled, isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import { deriveStrategicContextForMeeting } from "@/lib/people-strategy/strategic-context";
import {
  getActionsForEntity,
  getActionsForMeeting,
  listActionAssignableUsers,
} from "@/lib/people-strategy/action-queries";
import { deriveMeetingFollowUpPack } from "@/lib/people-strategy/action-operations-intel";
import { MeetingFollowUpPackSection } from "@/components/work/meeting-follow-up-pack";
import {
  generateAgendaText,
  generateMeetingSummary,
  type AgendaActionInput,
} from "@/lib/people-strategy/meeting-agenda-summary";
import { MeetingAgendaSummaryPanel } from "@/components/people-strategy/meeting-agenda-summary-panel";
import { startOfDay } from "@/lib/leadership-action-center/dates";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import {
  getMeetingById,
  getMeetingsForEntity,
  mapMeetingToDetailDTO,
  meetingDisplayTitle,
  type MeetingDetailDTO,
} from "@/lib/people-strategy/meetings-queries";
import { meetingNextAction } from "@/lib/people-strategy/meeting-command-center";
import { CalmCollapse, CalmOnly, CommandModeToggle } from "@/components/command-center/command-mode";
import { PrimaryFocusCard } from "@/components/command-center/simple";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import {
  areaForRelatedEntityType,
  operationalAreaLabel,
} from "@/lib/people-strategy/operational-context";
import { isRelatedEntityType, type RelatedEntityType } from "@/lib/people-strategy/constants";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  MeetingDetailClient,
  type MeetingRelatedContext,
} from "@/components/people-strategy/meeting-detail-client";
import { StrategicContextSection } from "@/components/people-strategy/strategic-context";
import { SuggestedActionsPanel } from "@/components/people-strategy/suggested-actions-panel";
import type { PersonOption } from "@/components/people-strategy/new-meeting-drawer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meeting · Weekly Command Center" };

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

/**
 * The calm "Now" lead — what's happening in this meeting and the single best
 * next move. Live meetings surface the current agenda item; finished meetings
 * surface the next wrap-up step. Computed from the meeting's own detail DTO.
 */
function MeetingNowFocus({ detail }: { detail: MeetingDetailDTO }) {
  const next = meetingNextAction({
    ...detail,
    hasRelatedEntity: !!detail.relatedEntityType && !!detail.relatedEntityId,
  });
  const openAgenda = detail.agenda.find((a) => a.status === "OPEN");
  const live = detail.effectiveStatus === "in_progress";
  const upcoming = detail.effectiveStatus === "upcoming" || detail.effectiveStatus === "today";
  const eyebrow = live ? "Happening now" : upcoming ? "Before this meeting" : "Wrap-up";
  const title =
    live && openAgenda
      ? openAgenda.title
      : upcoming && openAgenda
        ? `First up: ${openAgenda.title}`
        : detail.title;
  const summary = [
    `${detail.decisionCount} decision${detail.decisionCount === 1 ? "" : "s"}`,
    `${detail.openFollowUps} open follow-up${detail.openFollowUps === 1 ? "" : "s"}`,
    `${detail.linkedActions.length} action${detail.linkedActions.length === 1 ? "" : "s"}`,
  ].join(" · ");
  return (
    <PrimaryFocusCard
      eyebrow={eyebrow}
      title={title}
      reason={`${summary}. ${next.reason}`}
      icon="compass"
      ctaLabel={next.label}
      ctaHref={next.href}
    />
  );
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const { id } = await params;
  const now = new Date();
  const [meeting, assignableUsers] = await Promise.all([
    getMeetingById(id),
    listActionAssignableUsers(),
  ]);
  if (!meeting) notFound();

  const detail = mapMeetingToDetailDTO(meeting, now);
  const people: PersonOption[] = assignableUsers.map((u) => ({ id: u.id, name: personName(u) }));

  // Action System 4.0 — the post-meeting follow-up pack: decisions that never
  // became actions plus this meeting's open / overdue / recently-done work.
  const meetingViewer: ActionViewer = {
    id: viewer.id,
    roles: viewer.roles,
    primaryRole: viewer.primaryRole,
    adminSubtypes: viewer.adminSubtypes,
  };
  const meetingActions = await getActionsForMeeting(id, meetingViewer).catch(() => []);
  const followUpPack = deriveMeetingFollowUpPack(
    {
      decisions: meeting.decisions.map((d) => ({
        id: d.id,
        decision: d.decision,
        linkedActionId: d.linkedActionId,
      })),
      actions: meetingActions,
    },
    now
  );

  // Related portal context: when the meeting is linked to a YPP entity, surface
  // that entity + its open actions + the other meetings about it, so the meeting
  // shows the rest of the portal. Loaded fail-safe.
  let relatedContext: MeetingRelatedContext | null = null;
  if (
    meeting.relatedEntityType &&
    meeting.relatedEntityId &&
    isRelatedEntityType(meeting.relatedEntityType)
  ) {
    const type = meeting.relatedEntityType as RelatedEntityType;
    const entityId = meeting.relatedEntityId;
    const actionViewer: ActionViewer = {
      id: viewer.id,
      roles: viewer.roles,
      primaryRole: viewer.primaryRole,
      adminSubtypes: viewer.adminSubtypes,
    };
    const [summary, entityActions, entityMeetings] = await Promise.all([
      loadRelatedEntitySummary(type, entityId).catch(() => null),
      getActionsForEntity(type, entityId, actionViewer).catch(() => []),
      getMeetingsForEntity(type, entityId).catch(() => []),
    ]);
    if (summary) {
      relatedContext = {
        entityType: type,
        entityId,
        entityLabel: summary.label,
        entityHref: summary.href,
        area: operationalAreaLabel(areaForRelatedEntityType(type)),
        openActions: entityActions
          .filter((a) => effectiveStatus(a, now) !== "COMPLETE" && effectiveStatus(a, now) !== "DROPPED")
          .slice(0, 6)
          .map((a) => ({
            id: a.id,
            title: a.title,
            status: effectiveStatus(a, now),
            leadName: a.lead?.name ?? a.lead?.email ?? "Unassigned",
          })),
        otherMeetings: entityMeetings
          .filter((m) => m.id !== meeting.id)
          .slice(0, 5)
          .map((m) => ({ id: m.id, title: meetingDisplayTitle(m), dateISO: m.date.toISOString() })),
      };
    }
  }

  // Deterministic agenda + summary generation (no AI required): build the
  // grouped drafts from the meeting's own linked actions, agenda items,
  // decisions, and follow-ups so the facilitator can preview / edit / copy.
  const DUE_SOON_MS = 3 * 86_400_000;
  const todayMs = startOfDay(now).getTime();
  const agendaActions: AgendaActionInput[] = detail.linkedActions.map((a) => {
    const deadlineMs = new Date(a.deadlineISO).getTime();
    const settled = a.status === "COMPLETE" || a.status === "DROPPED";
    const overdue = !settled && deadlineMs < todayMs;
    const dueSoon = !settled && !overdue && deadlineMs <= todayMs + DUE_SOON_MS;
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      ownerName: a.owner?.name ?? null,
      deadlineISO: a.deadlineISO,
      blocked: a.status === "BLOCKED",
      overdue,
      dueSoon,
    };
  });
  const agendaText = generateAgendaText({
    title: detail.title,
    dateISO: detail.startISO,
    actions: agendaActions,
    agendaItems: detail.agenda.map((i) => ({
      title: i.title,
      status: i.status,
      ownerName: i.owner?.name ?? null,
    })),
    openFollowUps: detail.followUps
      .filter((f) => f.effectiveStatus !== "completed")
      .map((f) => ({ title: f.title, ownerName: f.owner?.name ?? null, dueISO: f.dueISO })),
  });
  const summary = generateMeetingSummary({
    title: detail.title,
    dateISO: detail.startISO,
    decisions: detail.decisions.map((d) => ({
      decision: d.decision,
      decidedByName: d.decidedBy?.name ?? null,
    })),
    actions: agendaActions,
    followUps: detail.followUps.map((f) => ({
      title: f.title,
      ownerName: f.owner?.name ?? null,
      dueISO: f.dueISO,
      status: f.effectiveStatus === "completed" ? "COMPLETED" : "OPEN",
    })),
    deferredAgendaItems: detail.agenda
      .filter((i) => i.status === "DEFERRED")
      .map((i) => ({ title: i.title })),
    notesText: detail.notesText,
  });

  const strategicContext = isStrategicInitiativesEnabled()
    ? deriveStrategicContextForMeeting({
        title: detail.title,
        purpose: detail.purpose,
        category: detail.category,
        relatedEntityType: detail.relatedEntityType,
        relatedEntityId: detail.relatedEntityId,
      })
    : null;

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <div className="mx-auto flex w-full max-w-[1180px] justify-end pb-1">
        <CommandModeToggle />
      </div>

      {/* Calm lead — what's happening now and the one next move. Executive mode
          leans on the room's own header instead, so the two don't stack. */}
      <CalmOnly>
        <div className="mx-auto w-full max-w-[1180px] pb-3">
          <MeetingNowFocus detail={detail} />
        </div>
      </CalmOnly>

      {/* The room — notes, agenda, decisions, follow-ups, linked actions. */}
      <MeetingDetailClient meeting={detail} people={people} relatedContext={relatedContext} />

      {/* Secondary tools & context — demoted out of the calm default, one click
          away, and always inline in Executive mode. Nothing is removed. */}
      <CalmCollapse
        label="Meeting tools & context"
        hint="Agenda & summary drafts, suggested actions, the follow-up pack, and strategy links."
      >
        <div className="flex flex-col gap-4 pt-2">
          <MeetingAgendaSummaryPanel
            agendaText={agendaText}
            summaryText={summary.text}
            summaryWarnings={summary.warnings}
            summaryMissingNotes={summary.missingNotes}
          />
          <SuggestedActionsPanel
            meetingId={id}
            people={people}
            relatedEntityType={detail.relatedEntityType}
            relatedEntityId={detail.relatedEntityId}
            aiAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
            hasNotes={Boolean(detail.notesText && detail.notesText.trim().length > 0)}
          />
          <MeetingFollowUpPackSection pack={followUpPack} meetingId={id} />
          {strategicContext ? (
            <StrategicContextSection context={strategicContext} kind="meeting" showEmptyState />
          ) : null}
        </div>
      </CalmCollapse>
    </div>
  );
}
