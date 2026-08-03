import Link from "next/link";

import {
  InstructorTeachingCalendar,
  type TeachingCalendarEvent,
} from "@/components/instructor/instructor-teaching-calendar";
import { EmptyStateV2 } from "@/components/ui-v2";
import { formatMeetingTimeRange, splitMeetingTimeRange } from "@/lib/class-meeting-time";
import type {
  InstructorTeachingWorkspace,
  TeachingClass,
  TeachingSession,
} from "@/lib/classes/instructor-workspace";

const DEFAULT_THEME = "#6b21c8";

function resolveTheme(color: string | null | undefined) {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : DEFAULT_THEME;
}

/** YYYY-MM-DD for a Date in a given IANA timezone. */
function dayKeyInTimezone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function timeLabelForSession(session: TeachingSession, teachingClass: TeachingClass) {
  // Prefer class settings time so calendar stays in sync with Settings / class home.
  const raw =
    teachingClass.meetingTime?.trim() ||
    `${session.startTime}-${session.endTime}`;
  const range = formatMeetingTimeRange(raw, teachingClass.timezone);
  if (range) return range;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: teachingClass.timezone,
    timeZoneName: "short",
  }).format(session.state.startsAt);
}

function sortMinutesForClass(teachingClass: TeachingClass, session: TeachingSession) {
  const clocks =
    splitMeetingTimeRange(teachingClass.meetingTime) ||
    splitMeetingTimeRange(`${session.startTime}-${session.endTime}`);
  if (!clocks) return 0;
  const [h, m] = clocks.startTime.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Short chip text that keeps cohort / suffix identity. */
function calendarChipTitle(title: string) {
  const parts = title.split(/\s*[—–]\s*/);
  if (parts.length > 1) {
    const suffix = parts[parts.length - 1]!.trim();
    if (suffix) return suffix.length > 28 ? `${suffix.slice(0, 26)}…` : suffix;
  }
  return title.length > 22 ? `${title.slice(0, 20)}…` : title;
}

export function InstructorScheduleView({
  workspace,
}: {
  workspace: InstructorTeachingWorkspace;
}) {
  const events: TeachingCalendarEvent[] = workspace.activeClasses.flatMap((teachingClass) =>
    teachingClass.sessions
      .filter((session) => !session.isCancelled)
      .map((session) => {
        const dayKey = dayKeyInTimezone(
          session.state.startsAt,
          teachingClass.timezone || "America/New_York",
        );
        return {
          id: session.id,
          classId: teachingClass.id,
          classTitle: teachingClass.title,
          chipTitle: calendarChipTitle(teachingClass.title),
          themeColor: resolveTheme(teachingClass.themeColor),
          sessionNumber: session.sessionNumber,
          topic: session.topic,
          dayKey,
          timeLabel: timeLabelForSession(session, teachingClass),
          sortMinutes: sortMinutesForClass(teachingClass, session),
          locationLabel: teachingClass.locationLabel,
          href: session.state.action.href,
          lifecycle: session.state.lifecycle,
          actionLabel: session.state.action.label,
        };
      }),
  );

  const todayKey = dayKeyInTimezone(new Date(), "America/New_York");
  const hasClasses = workspace.activeClasses.length > 0;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-20 pt-7 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
              Schedule
            </h1>
            <p className="m-0 mt-1 max-w-2xl text-[14px] leading-6 text-[#5f6368]">
              All your teaching classes and sessions — day, time, and where to show up.
            </p>
          </div>
          <Link
            href="/instructor/classes"
            className="shrink-0 text-[13.5px] font-medium text-brand-700 no-underline hover:underline"
          >
            All classes
          </Link>
        </header>

        {!hasClasses ? (
          <EmptyStateV2
            title="No teaching classes yet"
            body="When you are assigned a class, it will show up here with its meeting days and sessions."
          />
        ) : (
          <InstructorTeachingCalendar events={events} todayKey={todayKey} />
        )}
      </div>
    </main>
  );
}
