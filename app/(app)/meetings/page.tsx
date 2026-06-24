import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { MeetingsHub } from "@/components/weekly-meetings/meetings-hub";
import type { MeetingsHubView } from "@/components/weekly-meetings/meetings-hub-tabs";
import { isAdmin, requireMeetingRunner } from "@/lib/weekly-meetings/permissions";
import { listMeetings, type MeetingListItem } from "@/lib/weekly-meetings/meetings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings" };

function resolveView(value: string | string[] | undefined): MeetingsHubView {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "past" || v === "all" ? v : "upcoming";
}

/** Filter + order the list for the active view (soonest-first for upcoming). */
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
  const viewer = await requireMeetingRunner();
  const params = (await searchParams) ?? {};
  const view = resolveView(params.view);

  const meetings = await listMeetings();
  const shown = selectForView(meetings, view);

  return (
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pb-12 pt-4">
        <PageHeaderV2
          eyebrow="Weekly Meetings"
          title="Meetings"
          subtitle="Run officer, weekly impact, chapter, and general meetings from one place."
          actions={
            <>
              <ButtonLink href="/my-weekly-impact" variant="secondary">
                Submit weekly impact
              </ButtonLink>
              {isAdmin(viewer) ? (
                <ButtonLink href="/admin/teams" variant="ghost">
                  Configure teams
                </ButtonLink>
              ) : null}
            </>
          }
        />

        <MeetingsHub meetings={shown} view={view} />
      </div>
    </div>
  );
}
