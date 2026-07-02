import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";

export function ActionMeetingLink({
  meetingId,
  meetingTitle,
  meetingDate,
  meetingHref,
}: {
  meetingId: string;
  meetingTitle?: string | null;
  meetingDate: Date;
  meetingHref?: string;
}) {
  return (
    <Link
      href={meetingHref ?? `/meetings/${meetingId}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center rounded-md bg-[#fdf8ec] px-2 py-1 text-[11px] font-semibold text-[#7a5d00] no-underline hover:bg-[#f8efd6]"
    >
      Meeting: {meetingTitle?.trim() || formatMonthDay(meetingDate)}
    </Link>
  );
}
