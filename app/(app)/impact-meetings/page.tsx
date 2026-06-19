import { notFound } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  attachImpactAgendaItemState,
  loadGlobalOperationsImpactAgendaForMeeting,
  type ImpactUpdateReadiness,
} from "@/lib/people-strategy/impact-meetings";
import {
  findCurrentGlobalImpactMeeting,
  mapMeetingToDetailDTO,
} from "@/lib/people-strategy/meetings-queries";
import type { StatusTone } from "@/components/ui-v2";
import {
  ImpactMeetingsEmpty,
  ImpactMeetingsHub,
  type ImpactHubData,
  type ImpactStageStep,
  type ImpactTeamCardData,
} from "@/components/people-strategy/impact-meetings-hub";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function readinessMeta(r: ImpactUpdateReadiness): { label: string; tone: StatusTone } {
  switch (r) {
    case "missing":
      return { label: "Missing update", tone: "danger" };
    case "draft":
      return { label: "In draft", tone: "warning" };
    case "needs_revision":
      return { label: "Needs revision", tone: "warning" };
    case "submitted":
      return { label: "Submitted", tone: "info" };
    case "pulled_into_agenda":
      return { label: "In agenda", tone: "brand" };
    case "discussed":
      return { label: "Discussed", tone: "success" };
    default:
      return { label: "—", tone: "neutral" };
  }
}

function fmtWeek(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function ImpactMeetingsPage() {
  if (!isActionTrackerEnabled()) notFound();
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const meeting = await findCurrentGlobalImpactMeeting(now);

  if (!meeting) {
    return (
      <div className={skin.portalSkin}>
        <ImpactMeetingsEmpty />
      </div>
    );
  }

  const detail = mapMeetingToDetailDTO(meeting, now);
  const meetingViewer: ActionViewer = {
    id: viewer.id,
    roles: viewer.roles,
    primaryRole: viewer.primaryRole,
    adminSubtypes: viewer.adminSubtypes,
  };

  const agenda = attachImpactAgendaItemState(
    await loadGlobalOperationsImpactAgendaForMeeting({
      meetingId: meeting.id,
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
  );

  const total = agenda.sections.length;
  const submitted = agenda.submittedTeams.length;
  const missing = agenda.missingTeams.length;
  const decisions = agenda.sections.reduce((n, s) => n + s.decisionsNeeded.length, 0);
  const blockers = agenda.sections.reduce((n, s) => n + s.blockers.length, 0);

  const pulled = agenda.sections.filter((s) => s.agendaItemId).length;
  const discussed = agenda.sections.filter(
    (s) => s.agendaItemStatus === "DISCUSSED" || s.agendaItemStatus === "CONVERTED"
  ).length;

  let stageIndex = 0;
  if (total > 0 && missing === 0) stageIndex = 1;
  if (total > 0 && pulled >= total) stageIndex = 2;
  if (discussed > 0) stageIndex = 3;

  const stepDefs: Array<{ label: string; sub: string }> = [
    { label: "Collect updates", sub: `${submitted}/${total} in` },
    { label: "Build agenda", sub: pulled > 0 ? `${pulled}/${total} pulled` : "pull updates" },
    { label: "Run live", sub: discussed > 0 ? `${discussed} discussed` : "in meeting" },
    { label: "Send summary", sub: "after meeting" },
  ];
  const stageSteps: ImpactStageStep[] = stepDefs.map((d, i) => ({
    ...d,
    done: i < stageIndex,
    current: i === stageIndex,
  }));

  const teams: ImpactTeamCardData[] = agenda.sections.map((s) => {
    const meta = readinessMeta(s.readiness);
    return {
      teamId: s.teamId,
      teamName: s.teamName,
      presenterInitials: s.presenterName ? [initials(s.presenterName)] : [],
      statusLabel: meta.label,
      statusTone: meta.tone,
      missing: s.readiness === "missing" || s.readiness === "draft",
      completedCount: s.completedThisWeek.length,
      deliverableCount: s.deliverables.length,
      decisionCount: s.decisionsNeeded.length,
      blockerCount: s.blockers.length,
      briefHref: s.briefHref,
      warnText: s.needsAttention[0] ?? null,
    };
  });

  const leads = Array.from(
    new Set(
      agenda.sections
        .map((s) => s.presenterName)
        .filter((name): name is string => Boolean(name))
    )
  ).slice(0, 2);
  const leadLabel = leads.length > 0 ? `led by ${leads.join(" & ")}` : "";

  const data: ImpactHubData = {
    meetingId: meeting.id,
    meetingTitle: detail.title || "Global Operations Impact Meeting",
    weekLabel: `Week of ${fmtWeek(agenda.weekKey)}`,
    meetingDateLabel: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(meeting.date),
    meetingHref: `/actions/meetings/${meeting.id}`,
    leadLabel,
    stats: { submitted, total, missing, decisions, blockers },
    stageSteps,
    teams,
    needsAttention: agenda.needsAttention,
    chapterCards: [],
  };

  return (
    <div className={skin.portalSkin}>
      <ImpactMeetingsHub data={data} />
    </div>
  );
}
