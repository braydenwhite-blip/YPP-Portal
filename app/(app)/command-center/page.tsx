import { redirect } from "next/navigation";

import { TodayWorkspace } from "@/components/command-center";
import { buildTodayWorkspace, toCcMeeting } from "@/lib/command-center";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  listMeetingsInRange,
  mapMeetingToCardDTO,
} from "@/lib/people-strategy/meetings-queries";
import { buildQueueEngine } from "@/lib/queue/engine";
import { loadWorkHub } from "@/lib/work/work-hub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Command Center — Pathways Portal",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function CommandCenterPage() {
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
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [data, meetingRecords] = await Promise.all([
    loadWorkHub(viewer, { now }),
    listMeetingsInRange(startOfToday, new Date(now.getTime() + 7 * DAY_MS)).catch(() => []),
  ]);

  const engine = buildQueueEngine(data, now);
  const meetings = meetingRecords.map((record) => toCcMeeting(mapMeetingToCardDTO(record, now)));

  const vm = buildTodayWorkspace({
    engine,
    meetings,
    viewerName: session.user.name ?? session.user.email ?? "there",
    now,
  });

  return <TodayWorkspace vm={vm} nowISO={now.toISOString()} />;
}
