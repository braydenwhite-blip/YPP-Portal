import Link from "next/link";

import { ButtonLink, CardV2, PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import { requireMeetingRunner } from "@/lib/weekly-meetings/permissions";
import { listMeetings, type MeetingListItem } from "@/lib/weekly-meetings/meetings";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
} as const;

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MeetingsPage() {
  await requireMeetingRunner();
  const meetings = await listMeetings();

  const upcoming = meetings.filter((m) => m.status === "SCHEDULED" || m.status === "IN_PROGRESS");
  const past = meetings.filter((m) => m.status === "COMPLETED" || m.status === "CANCELLED");

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 pb-16">
      <PageHeaderV2
        eyebrow="Weekly Meetings"
        title="Meetings"
        subtitle="Run officer, weekly impact, chapter, and general meetings from one place."
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href="/my-weekly-impact" variant="secondary">
              Submit weekly impact
            </ButtonLink>
            <ButtonLink href="/meetings/new" variant="primary">
              New meeting
            </ButtonLink>
          </div>
        }
      />

      <MeetingLane title="Upcoming & in progress" meetings={upcoming} empty="No upcoming meetings. Create one to get started." />
      {past.length > 0 && <MeetingLane title="Past" meetings={past} empty="" />}
    </div>
  );
}

function MeetingLane({ title, meetings, empty }: { title: string; meetings: MeetingListItem[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[14px] font-bold text-ink">{title}</h2>
      {meetings.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {meetings.map((m) => (
            <Link key={m.id} href={`/meetings/${m.id}`} className="block">
              <CardV2 padding="md" className="transition-colors hover:border-brand-400">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge tone="info">{m.typeLabel}</StatusBadge>
                      <StatusBadge tone={STATUS_TONE[m.status]}>{m.status.replace("_", " ")}</StatusBadge>
                      {m.scopeLabel && <span className="text-[12px] text-ink-muted">{m.scopeLabel}</span>}
                    </div>
                    <p className="m-0 text-[15px] font-semibold text-ink">{m.title}</p>
                  </div>
                  <div className="text-right text-[12.5px] text-ink-muted">
                    <p className="m-0">{fmt(m.scheduledISO)}</p>
                    {m.facilitator && <p className="m-0">{m.facilitator.name}</p>}
                  </div>
                </div>
              </CardV2>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
