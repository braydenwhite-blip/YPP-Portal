import { notFound } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
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
import { ImpactMeetingAgendaPanel } from "@/components/people-strategy/impact-meeting-agenda-panel";
import {
  attachImpactAgendaItemState,
  generateImpactMeetingAgendaText,
  generateImpactMeetingSummary,
  GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE,
  loadGlobalOperationsImpactAgendaForMeeting,
} from "@/lib/people-strategy/impact-meetings";
import { startOfDay } from "@/lib/leadership-action-center/dates";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import {
  getMeetingById,
  getMeetingsForEntity,
  listMeetingsInRange,
  mapMeetingToDetailDTO,
  meetingDisplayTitle,
} from "@/lib/people-strategy/meetings-queries";
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
import { GlobalImpactWorkspace } from "@/components/people-strategy/global-impact-workspace";
import { ImpactAgendaBoard } from "@/components/people-strategy/impact-agenda-board";
import { ImpactMeetingCapture } from "@/components/people-strategy/impact-meeting-capture";
import { OfficerPreparedPresentationsPanel } from "@/components/people-strategy/officer-prepared-presentations";
import { loadPreparedPresentationsForOfficerMeeting } from "@/lib/people-strategy/weekly-team-briefs";
import type { PersonOption } from "@/components/people-strategy/new-meeting-drawer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meeting" };

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
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
  const preparedPresentations = await loadPreparedPresentationsForOfficerMeeting(id).catch(() => []);
  const impactAgenda =
    detail.meetingType === GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE
      ? attachImpactAgendaItemState(
          await loadGlobalOperationsImpactAgendaForMeeting({
            meetingId: id,
            meetingTitle: detail.title,
            meetingDate: meeting.date,
            viewer: meetingViewer,
          }),
          detail.agenda.map((item) => ({
            id: item.id,
            status: item.status,
            notes: item.notes,
            sourceInitiativeId: item.sourceInitiativeId,
            sourceWorkstreamId: item.sourceWorkstreamId,
          }))
        )
      : null;
  const targetMeetingWindowEnd = new Date(now);
  targetMeetingWindowEnd.setUTCDate(targetMeetingWindowEnd.getUTCDate() + 90);
  const targetMeetingOptions = [
    {
      id: meeting.id,
      title: meetingDisplayTitle(meeting),
      dateISO: meeting.date.toISOString(),
    },
    ...(await listMeetingsInRange(startOfDay(now), targetMeetingWindowEnd).catch(() => []))
      .filter((m) => m.id !== meeting.id)
      .map((m) => ({
        id: m.id,
        title: meetingDisplayTitle(m),
        dateISO: m.date.toISOString(),
      })),
  ];
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
    const deadlineMs = a.deadlineISO ? new Date(a.deadlineISO).getTime() : null;
    const settled = a.status === "COMPLETE" || a.status === "DROPPED";
    const overdue = !settled && deadlineMs != null && deadlineMs < todayMs;
    const dueSoon = !settled && !overdue && deadlineMs != null && deadlineMs <= todayMs + DUE_SOON_MS;
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      ownerName: a.owner?.name ?? null,
      deadlineISO: a.deadlineISO,
      blocked: a.status === "BLOCKED",
      overdue,
      dueSoon,
    };
  });
  const agendaText = impactAgenda
    ? generateImpactMeetingAgendaText(impactAgenda)
    : generateAgendaText({
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
  const summary = impactAgenda
    ? generateImpactMeetingSummary({
        agenda: impactAgenda,
        decisions: detail.decisions.map((d) => ({
          decision: d.decision,
          decidedByName: d.decidedBy?.name ?? null,
        })),
        followUps: detail.followUps.map((f) => ({
          title: f.title,
          ownerName: f.owner?.name ?? null,
          dueISO: f.dueISO,
          status: f.effectiveStatus === "completed" ? "COMPLETED" : "OPEN",
        })),
        notesText: detail.notesText,
      })
    : generateMeetingSummary({
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

  // Global Impact meetings get their own focused workflow (Agenda prep board →
  // Meeting capture → Summary & follow-ups) instead of the generic detail client.
  if (impactAgenda) {
    const total = impactAgenda.sections.length;
    const ready = impactAgenda.sections.filter(
      (s) => s.readiness !== "missing" && s.readiness !== "draft" && s.needsAttention.length === 0
    ).length;
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(detail.startISO));
    const weekDate = new Date(`${impactAgenda.weekKey}T00:00:00.000Z`);
    const weekLabelStr = Number.isNaN(weekDate.getTime())
      ? `Week of ${impactAgenda.weekKey}`
      : `Week of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(weekDate)}`;

    return (
      <div className={`${skin.portalSkin} page-shell`} style={{ maxWidth: 1180 }}>
        <GlobalImpactWorkspace
          title={detail.title}
          dateLabel={dateLabel}
          weekLabel={weekLabelStr}
          ready={ready}
          total={total}
          submitHref="/my-weekly-impact"
          agendaNode={<ImpactAgendaBoard agenda={impactAgenda} />}
          captureNode={
            <ImpactMeetingCapture
              agenda={impactAgenda}
              meetingId={id}
              people={people}
              decisions={detail.decisions.map((d) => ({
                id: d.id,
                decision: d.decision,
                decidedByName: d.decidedBy?.name ?? null,
              }))}
              followUps={detail.followUps.map((f) => ({
                id: f.id,
                title: f.title,
                ownerName: f.owner?.name ?? null,
                dueISO: f.dueISO,
                status: f.effectiveStatus,
              }))}
            />
          }
          summaryNode={
            <div className="flex flex-col gap-4">
              <section id="summary" className="scroll-mt-24">
                <MeetingAgendaSummaryPanel
                  meetingId={id}
                  agendaText={agendaText}
                  summaryText={summary.text}
                  summaryWarnings={summary.warnings}
                  summaryMissingNotes={summary.missingNotes}
                  summaryStatus={detail.summaryStatus}
                />
              </section>
              <MeetingFollowUpPackSection pack={followUpPack} meetingId={id} />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className={`${skin.portalSkin} page-shell`} style={{ maxWidth: 1120 }}>
      <MeetingDetailClient
        meeting={detail}
        people={people}
        relatedContext={relatedContext}
        preparedPresentationsPanel={
          <section id="presentation" className="scroll-mt-24">
            <OfficerPreparedPresentationsPanel
              officerMeetingId={id}
              items={preparedPresentations}
              targetMeetings={targetMeetingOptions}
            />
          </section>
        }
        impactAgendaPanel={
          impactAgenda ? <ImpactMeetingAgendaPanel agenda={impactAgenda} people={people} /> : null
        }
        summaryPanel={
          <section id="summary" className="scroll-mt-24">
            <MeetingAgendaSummaryPanel
              meetingId={id}
              agendaText={agendaText}
              summaryText={summary.text}
              summaryWarnings={summary.warnings}
              summaryMissingNotes={summary.missingNotes}
              summaryStatus={detail.summaryStatus}
            />
          </section>
        }
        followUpPackPanel={<MeetingFollowUpPackSection pack={followUpPack} meetingId={id} />}
      />
    </div>
  );
}
