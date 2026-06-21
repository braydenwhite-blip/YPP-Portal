import { addDays } from "@/lib/leadership-action-center/dates";
import type { ActionViewer } from "./action-permissions";
import { getWeeklyOperationalDigestForViewer } from "./operational-digest-queries";
import {
  getMeetingById,
  listMeetingsInRange,
  mapMeetingToCardDTO,
  mapMeetingToDetailDTO,
  meetingDisplayTitle,
} from "./meetings-queries";
import { selectPrimaryMeeting } from "./meeting-command-center";
import {
  buildAgendaRows,
  buildCandidateGroups,
  buildDecisionsNeeded,
  buildPastMeetingRows,
  buildSummarySections,
  meetingFocusFromDetail,
  type OfficerMeetingPrepData,
} from "./officer-meeting-prep";

/**
 * Load the Officer Meetings prep workspace — next meeting, candidate pool,
 * agenda, and past meetings.
 */
export async function loadOfficerMeetingPrep(
  viewer: ActionViewer,
  now: Date = new Date()
): Promise<OfficerMeetingPrepData> {
  const rangeStart = addDays(now, -1);
  const rangeEnd = addDays(now, 21);

  const [meetings, digest] = await Promise.all([
    listMeetingsInRange(rangeStart, rangeEnd),
    getWeeklyOperationalDigestForViewer(viewer, { now }),
  ]);

  const cards = meetings.map((m) => mapMeetingToCardDTO(m, now));
  const selection = selectPrimaryMeeting(
    cards.map((m) => ({ ...m, hasRelatedEntity: !!m.relatedEntityType && !!m.relatedEntityId })),
    now
  );

  const focusMeeting =
    selection?.meeting ??
    cards.find((m) => m.effectiveStatus === "today" || m.effectiveStatus === "upcoming") ??
    cards[0] ??
    null;

  if (!focusMeeting) {
    return {
      focus: null,
      candidateGroups: buildCandidateGroups({
        unassigned: digest.triage.unassigned,
        blocked: digest.triage.blocked,
        overdue: digest.triage.overdue,
        reviewItems: digest.recommendedReviewOrder,
        agenda: [],
      }),
      agenda: [],
      decisionsNeeded: [],
      pastMeetings: [],
      summarySections: [],
      summaryPlain: "",
      discussedCount: 0,
      unresolved: [],
    };
  }

  const raw = await getMeetingById(focusMeeting.id);
  if (!raw) {
    return {
      focus: null,
      candidateGroups: [],
      agenda: [],
      decisionsNeeded: [],
      pastMeetings: [],
      summarySections: [],
      summaryPlain: "",
      discussedCount: 0,
      unresolved: [],
    };
  }

  const detail = mapMeetingToDetailDTO(raw, now);
  const focus = meetingFocusFromDetail(detail);

  const candidateGroups = buildCandidateGroups({
    unassigned: digest.triage.unassigned,
    blocked: digest.triage.blocked,
    overdue: digest.triage.overdue,
    reviewItems: digest.recommendedReviewOrder,
    agenda: detail.agenda,
  });

  const allCandidates = candidateGroups.flatMap((g) => g.items);
  const { sections, plain, unresolved } = buildSummarySections(detail);
  const discussedCount = detail.agenda.filter(
    (a) => a.status === "DISCUSSED" || a.status === "CONVERTED"
  ).length;

  const pastMeetings = buildPastMeetingRows(
    meetings
      .filter((m) => m.id !== focus.id && m.date < now)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6)
      .map((m) => ({
        id: m.id,
        title: meetingDisplayTitle(m),
        date: m.date,
        note: `${m.decisions.length} decisions · ${m.agendaItems.length} agenda items`,
      }))
  );

  return {
    focus,
    candidateGroups,
    agenda: buildAgendaRows(detail.agenda),
    decisionsNeeded: buildDecisionsNeeded(allCandidates),
    pastMeetings,
    summarySections: sections,
    summaryPlain: plain,
    discussedCount,
    unresolved,
  };
}
