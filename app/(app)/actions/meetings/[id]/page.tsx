import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled, isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import { deriveStrategicContextForMeeting } from "@/lib/people-strategy/strategic-context";
import {
  getActionsForEntity,
  listActionAssignableUsers,
} from "@/lib/people-strategy/action-queries";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import {
  getMeetingById,
  getMeetingsForEntity,
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
import { StrategicContextSection } from "@/components/people-strategy/strategic-context";
import type { PersonOption } from "@/components/people-strategy/new-meeting-drawer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meeting · Weekly Command Center" };

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
    <div className="page-shell" style={{ maxWidth: 1280 }}>
      <MeetingDetailClient meeting={detail} people={people} relatedContext={relatedContext} />
      {strategicContext ? (
        <StrategicContextSection context={strategicContext} kind="meeting" showEmptyState />
      ) : null}
    </div>
  );
}
