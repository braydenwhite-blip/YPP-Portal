import { redirect } from "next/navigation";

import { DecideWorkspace } from "@/components/command-center";
import {
  buildDecideWorkspace,
  type CcDecisionLogEntry,
  type CcMeeting,
  initialsFromName,
  toCcMeeting,
  whenLabel,
} from "@/lib/command-center";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  getMeetingById,
  listRecentDecisions,
  mapMeetingToCardDTO,
} from "@/lib/people-strategy/meetings-queries";
import { buildQueueEngine } from "@/lib/queue/engine";
import { loadWorkHub } from "@/lib/work/work-hub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Decisions — Pathways Portal",
};

export default async function DecidePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  const now = new Date();

  const [data, decisions] = await Promise.all([
    loadWorkHub(viewer, { now }),
    listRecentDecisions(8).catch(() => []),
  ]);

  const engine = buildQueueEngine(data, now);

  const recentDecisions: CcDecisionLogEntry[] = decisions.map((decision) => {
    const decidedByName = decision.decidedBy?.name ?? null;
    const whenISO = decision.createdAt.toISOString();
    return {
      id: decision.id,
      decision: decision.decision,
      meetingTitle: decision.meeting?.title ?? "Meeting",
      meetingHref: decision.meeting ? `/meetings/${decision.meeting.id}` : "/meetings",
      decidedByName,
      decidedByInitials: decidedByName ? initialsFromName(decidedByName) : null,
      whenISO,
      whenLabel: whenLabel(whenISO, now),
    };
  });

  const vm = buildDecideWorkspace({ engine, recentDecisions, now });

  let relatedMeeting: CcMeeting | null = null;
  if (vm.focus?.relatedMeeting?.id) {
    const record = await getMeetingById(vm.focus.relatedMeeting.id).catch(() => null);
    if (record) relatedMeeting = toCcMeeting(mapMeetingToCardDTO(record, now));
  }

  return <DecideWorkspace vm={vm} relatedMeeting={relatedMeeting} nowISO={now.toISOString()} />;
}
