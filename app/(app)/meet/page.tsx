import { redirect } from "next/navigation";

import { MeetWorkspace } from "@/components/command-center";
import {
  buildMeetWorkspace,
  type CcMeeting,
  type CcMeetingRoom,
  toCcMeeting,
  toCcMeetingRoom,
} from "@/lib/command-center";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  getMeetingById,
  listMeetingsInRange,
  mapMeetingToCardDTO,
  mapMeetingToDetailDTO,
} from "@/lib/people-strategy/meetings-queries";
import { buildQueueEngine } from "@/lib/queue/engine";
import { loadWorkHub } from "@/lib/work/work-hub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meet — Pathways Portal",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function byStart(a: CcMeeting, b: CcMeeting): number {
  return new Date(a.startISO).getTime() - new Date(b.startISO).getTime();
}

function pickDefaultMeetingId(meetings: CcMeeting[]): string | null {
  const live = meetings.find((m) => m.live);
  if (live) return live.id;
  const today = meetings.filter((m) => m.status === "today").sort(byStart)[0];
  if (today) return today.id;
  const upcoming = meetings.filter((m) => m.status === "upcoming").sort(byStart)[0];
  if (upcoming) return upcoming.id;
  return meetings[0]?.id ?? null;
}

export default async function MeetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const sp = await searchParams;
  const requestedId = typeof sp.m === "string" ? sp.m : undefined;

  const [data, meetingRecords] = await Promise.all([
    loadWorkHub(viewer, { now }),
    listMeetingsInRange(
      new Date(now.getTime() - 7 * DAY_MS),
      new Date(now.getTime() + 14 * DAY_MS)
    ).catch(() => []),
  ]);

  const engine = buildQueueEngine(data, now);
  const meetings = meetingRecords.map((record) => toCcMeeting(mapMeetingToCardDTO(record, now)));

  const selectedId = requestedId ?? pickDefaultMeetingId(meetings);
  let room: CcMeetingRoom | null = null;
  if (selectedId) {
    const detail = await getMeetingById(selectedId).catch(() => null);
    if (detail) room = toCcMeetingRoom(mapMeetingToDetailDTO(detail, now), now);
  }

  const vm = buildMeetWorkspace({ meetings, room, engine, now });

  return <MeetWorkspace vm={vm} nowISO={now.toISOString()} />;
}
