import type { AdminClassOperationsListItem } from "@/lib/admin-class-operations";
import type { ClassSignals } from "@/lib/class-next-action";
import { formatMeetingDays } from "@/lib/class-status";

export type ClassOperationsCardData = {
  id: string;
  title: string;
  locationLine: string | null;
  statusBadge: { label: string; tone: "success" | "warning" | "info" | "neutral" };
  instructorName: string | null;
  curriculumMentorName: string | null;
  scheduleLabel: string;
  enrollmentLabel: string;
  setupFooter: { tone: "success" | "warning"; message: string };
  href: string;
  /** Lower sorts first — setup gaps surface at the top. */
  sortRank: number;
};

function firstName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  return name.trim().split(/\s+/)[0] ?? name;
}

function formatMeetingTimeShort(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const start = raw.split("-")[0]?.trim() ?? raw.trim();
  if (/am|pm/i.test(start)) {
    return start.replace(/\s/g, "").toLowerCase();
  }
  const match = start.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return start;
  let hour = Number.parseInt(match[1], 10);
  const minutes = match[2];
  const suffix = hour >= 12 ? "pm" : "am";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return minutes === "00" ? `${hour}${suffix}` : `${hour}:${minutes}${suffix}`;
}

export function formatClassScheduleShort(item: {
  meetingDays: string[];
  meetingTime: string;
  sessionCount: number;
}): string {
  if (item.sessionCount === 0 && item.meetingDays.length === 0 && !item.meetingTime.trim()) {
    return "TBD";
  }
  const day = item.meetingDays[0]?.slice(0, 3) ?? formatMeetingDays(item.meetingDays);
  const time = formatMeetingTimeShort(item.meetingTime);
  if (day && time) return `${day} ${time}`;
  if (day) return day;
  if (time) return time;
  return item.sessionCount > 0 ? "Scheduled" : "TBD";
}

export function formatClassLocationLine(
  chapter: { name: string } | null | undefined,
  partner: { name: string } | null | undefined
): string | null {
  const parts = [chapter?.name, partner?.name].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function deriveClassSetupFooter(args: {
  hasInstructor: boolean;
  hasCurriculumMentor: boolean;
  hasSchedule: boolean;
}): { tone: "success" | "warning"; message: string } {
  const gaps: string[] = [];
  if (!args.hasInstructor) gaps.push("instructor");
  if (!args.hasCurriculumMentor) gaps.push("curriculum mentor");
  if (!args.hasSchedule) gaps.push("schedule");

  if (gaps.length === 0) {
    return { tone: "success", message: "All setup complete" };
  }

  const label =
    gaps.length === 1
      ? gaps[0]!
      : gaps.length === 2
        ? `${gaps[0]} & ${gaps[1]}`
        : `${gaps.slice(0, -1).join(", ")} & ${gaps.at(-1)}`;

  const suffix = !args.hasInstructor ? " — assign before fall launch" : "";
  return { tone: "warning", message: `Missing ${label}${suffix}` };
}

function deriveCardStatusBadge(
  item: AdminClassOperationsListItem,
  signals: ClassSignals
): ClassOperationsCardData["statusBadge"] {
  if (item.actionFlags.isCancelled) return { label: "Cancelled", tone: "neutral" };
  if (item.actionFlags.isCompleted) return { label: "Completed", tone: "neutral" };
  if (item.actionFlags.needsReview || item.actionFlags.needsRevision) {
    return { label: "Review", tone: "info" };
  }
  if (
    (item.status === "PUBLISHED" || item.status === "IN_PROGRESS") &&
    signals.hasLeadInstructor &&
    signals.sessionCount > 0
  ) {
    return { label: "Active", tone: "success" };
  }
  return { label: "Setup", tone: "warning" };
}

function cardSortRank(footer: { tone: "success" | "warning" }): number {
  return footer.tone === "warning" ? 0 : 1;
}

export function buildClassOperationsCard(
  item: AdminClassOperationsListItem,
  extras: {
    signals: ClassSignals;
    curriculumMentorName?: string | null;
    href?: string;
  }
): ClassOperationsCardData {
  const hasInstructor = extras.signals.hasLeadInstructor;
  const hasSchedule = extras.signals.sessionCount > 0 || item.meetingDays.length > 0;
  const mentorName = extras.curriculumMentorName ?? null;
  const setupFooter = deriveClassSetupFooter({
    hasInstructor,
    hasCurriculumMentor: mentorName != null,
    hasSchedule,
  });

  const capacity = item.capacity || 0;
  const enrollmentLabel =
    capacity > 0
      ? `${item.confirmedCount} / ${capacity}`
      : String(item.confirmedCount);

  return {
    id: item.id,
    title: item.title,
    locationLine: formatClassLocationLine(item.chapter, item.partner),
    statusBadge: deriveCardStatusBadge(item, extras.signals),
    instructorName: item.instructor ? firstName(item.instructor.name ?? item.instructor.email) : null,
    curriculumMentorName: mentorName ? firstName(mentorName) : null,
    scheduleLabel: formatClassScheduleShort({
      meetingDays: item.meetingDays,
      meetingTime: item.meetingTime,
      sessionCount: item._count.sessions,
    }),
    enrollmentLabel,
    setupFooter,
    href: extras.href ?? `/admin/classes/${item.id}`,
    sortRank: cardSortRank(setupFooter),
  };
}

export function sortClassOperationsCards(cards: ClassOperationsCardData[]): ClassOperationsCardData[] {
  return [...cards].sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}
