import skin from "@/components/ui-v2/portal-skin.module.css";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import {
  SimpleActionStrip,
  SimpleSurface,
  type SimpleAction,
} from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { MeetingAttentionStrip } from "@/components/weekly-meetings/meeting-attention-strip";
import { MeetingsHub } from "@/components/weekly-meetings/meetings-hub";
import type { MeetingsHubView } from "@/components/weekly-meetings/meetings-hub-tabs";
import { deriveMeetingAttention } from "@/lib/weekly-meetings/meeting-attention";
import { requireMeetingRunner } from "@/lib/weekly-meetings/permissions";
import { listMeetings, type MeetingListItem } from "@/lib/weekly-meetings/meetings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings" };

const strip: SimpleAction[] = [
  { label: "New meeting", href: "/meetings/new", icon: "calendar", primary: true },
  { label: "Weekly impact", href: "/my-weekly-impact", icon: "list" },
];

function resolveView(value: string | string[] | undefined): MeetingsHubView {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "past" || v === "all" ? v : "upcoming";
}

function selectForView(meetings: MeetingListItem[], view: MeetingsHubView): MeetingListItem[] {
  if (view === "past") {
    return meetings.filter((m) => m.status === "COMPLETED" || m.status === "CANCELLED");
  }
  if (view === "upcoming") {
    return meetings
      .filter((m) => m.status === "SCHEDULED" || m.status === "IN_PROGRESS")
      .sort((a, b) => a.scheduledISO.localeCompare(b.scheduledISO));
  }
  return meetings;
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMeetingRunner();
  const params = (await searchParams) ?? {};
  const view = resolveView(params.view);

  const meetings = await listMeetings();
  const shown = selectForView(meetings, view);
  const attention = deriveMeetingAttention(meetings, new Date());

  return (
    <div className={skin.portalSkin}>
      <SimpleSurface
        maxWidth={720}
        header={
          <PageHeaderV2
            eyebrow="Meetings"
            title="Meetings"
            subtitle="Schedule and run your meetings."
            actions={<CommandModeToggle />}
          />
        }
        actions={strip}
      >
        <div className="flex flex-col gap-4">
          <MeetingAttentionStrip groups={attention} />
          <MeetingsHub meetings={shown} view={view} />
        </div>
      </SimpleSurface>
    </div>
  );
}
