import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import { EmptySimpleState } from "@/components/command-center/simple";
import { SessionFocusCard, SessionPrepChecklist } from "@/components/mentorship/calm";
import type { SchedulePageData } from "@/lib/mentorship-scheduling-actions";
import ScheduleClient from "@/app/(app)/my-program/schedule/schedule-client";

/**
 * Calm Mentorship, Phase 5 — the schedule surface in two densities. Calm leads
 * with the single next session + a come-prepared checklist; the full scheduling
 * client (requests, available times, calendar) is demoted behind a toggle and
 * renders inline in Executive. When the viewer has no active mentorship there's
 * nothing to lead with, so the client (with its own empty state) renders plain.
 */
export function ScheduleSurface({
  data,
  reviewHref = "/mentorship?view=me&section=goals",
}: {
  data: SchedulePageData | null;
  reviewHref?: string;
}) {
  if (!data?.mentorship) {
    return <ScheduleClient data={data} />;
  }

  const next =
    [...data.upcomingSessions].sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt)
    )[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <CalmOnly>
        <div className="flex flex-col gap-5">
          {next ? (
            <SessionFocusCard
              title={next.title}
              whenISO={next.scheduledAt}
              type={next.type}
              meetingLink={next.meetingLink}
            />
          ) : (
            <EmptySimpleState icon="calendar">
              No session booked yet — open the schedule below to request one with
              your mentor.
            </EmptySimpleState>
          )}
          <SessionPrepChecklist reviewHref={reviewHref} />
        </div>
      </CalmOnly>

      <CalmCollapse
        label="Open the full schedule"
        hint="requests, available times, and calendar"
      >
        <ScheduleClient data={data} />
      </CalmCollapse>
    </div>
  );
}
