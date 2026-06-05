import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import {
  listPastMeetings,
  listUnassignedActionItems,
  listUpcomingMeetings,
  type OfficerMeetingWithRelations,
  type UnassignedActionItem,
} from "@/lib/people-strategy/officer-meetings-queries";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import OfficerMeetingsClient, {
  type MeetingDTO,
  type UnassignedItemDTO,
} from "@/components/people-strategy/officer-meetings-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Officer Meetings · People Strategy" };

function meetingToDTO(meeting: OfficerMeetingWithRelations): MeetingDTO {
  return {
    id: meeting.id,
    date: meeting.date.toISOString(),
    status: meeting.status,
    agendaText: meeting.agendaText,
    summaryEmailText: meeting.summaryEmailText,
    actionItems: meeting.actionItems.map((item) => {
      const note = item.meetingNotes.find(
        (n) => n.officerMeetingId === meeting.id
      );
      return {
        id: item.id,
        title: item.title,
        status: item.status,
        deadlineStart: item.deadlineStart.toISOString(),
        deadlineEnd: item.deadlineEnd ? item.deadlineEnd.toISOString() : null,
        goalCategory: item.goalCategory,
        departmentName: item.department?.name ?? null,
        leadName: item.lead?.name ?? item.lead?.email ?? null,
        assignees: item.assignments.map((assignment) => ({
          role: assignment.role,
          name: assignment.user.name ?? assignment.user.email ?? "Unknown",
        })),
        discussionNotes: note?.discussionNotes ?? "",
      };
    }),
    miscUpdates: meeting.miscUpdates.map((u) => ({
      id: u.id,
      body: u.body,
      addedByName: u.addedBy?.name ?? u.addedBy?.email ?? "Unknown",
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

function unassignedToDTO(item: UnassignedActionItem): UnassignedItemDTO {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    deadlineStart: item.deadlineStart.toISOString(),
    departmentName: item.department?.name ?? null,
    leadName: item.lead?.name ?? item.lead?.email ?? null,
  };
}

export default async function OfficerMeetingsPage() {
  // Outer gate: with ENABLE_ACTION_TRACKER off the route does not exist.
  if (!isActionTrackerEnabled()) notFound();

  // Officer-tier and above only. requireOfficer() throws "Unauthorized" for
  // members / instructors below officer — deny with a 404 so the route's
  // existence is not leaked.
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const [upcoming, past, unassigned] = await Promise.all([
    listUpcomingMeetings(now),
    listPastMeetings(now),
    listUnassignedActionItems(),
  ]);
  const showPeopleDashboardTab = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <div>
        <p className="badge">Admin · People Strategy</p>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Officer Meetings
        </h1>
        <p className="page-subtitle">
          Schedule officer meetings, pull action items in for discussion, capture
          notes and miscellaneous updates.
        </p>
      </div>

      <ActionTrackerTabs active="meetings" showPeople={showPeopleDashboardTab} />

      <OfficerMeetingsClient
        upcoming={upcoming.map(meetingToDTO)}
        past={past.map(meetingToDTO)}
        unassigned={unassigned.map(unassignedToDTO)}
      />
    </div>
  );
}
