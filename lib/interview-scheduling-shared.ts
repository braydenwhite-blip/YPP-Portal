import {
  InterviewAvailabilityOverrideType,
  InterviewAvailabilityScope,
  InterviewDomain,
  InterviewSchedulingRequestStatus,
} from "@prisma/client";

export type AvailabilityRuleLike = {
  id: string;
  interviewerId: string;
  scope: InterviewAvailabilityScope;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  slotDuration: number;
  bufferMinutes: number;
  meetingLink: string | null;
  locationLabel: string | null;
  isActive: boolean;
};

export type AvailabilityOverrideLike = {
  id: string;
  interviewerId: string;
  chapterId?: string | null;
  ruleId: string | null;
  scope: InterviewAvailabilityScope;
  type: InterviewAvailabilityOverrideType;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  slotDuration: number | null;
  bufferMinutes: number | null;
  meetingLink: string | null;
  locationLabel: string | null;
  note: string | null;
  isActive: boolean;
};

export type BusyInterval = {
  startsAt: Date;
  endsAt: Date;
  label?: string;
};

export type WarningInterval = {
  startsAt: Date;
  endsAt: Date;
  label: string;
};

export type GeneratedInterviewSlot = {
  slotKey: string;
  interviewerId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  duration: number;
  bufferMinutes: number;
  meetingLink: string | null;
  locationLabel: string | null;
  warningLabels: string[];
};

export const ACTIVE_INTERVIEW_REQUEST_STATUSES: InterviewSchedulingRequestStatus[] = [
  "REQUESTED",
  "BOOKED",
  "RESCHEDULE_REQUESTED",
];

export function scopeMatches(scope: InterviewAvailabilityScope, domain: InterviewDomain) {
  return scope === "ALL" || scope === domain;
}

function parseTimeToMinutes(value: string) {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error(`Invalid time string: ${value}`);
  }

  return hours * 60 + minutes;
}

function setMinutesOnDate(date: Date, minutesIntoDay: number) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(minutesIntoDay);
  return next;
}

export function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function buildRuleSlotsForDay(
  rule: AvailabilityRuleLike,
  day: Date
) {
  const startMinutes = parseTimeToMinutes(rule.startTime);
  const endMinutes = parseTimeToMinutes(rule.endTime);
  const slots: Array<{
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    duration: number;
    bufferMinutes: number;
    meetingLink: string | null;
    locationLabel: string | null;
  }> = [];

  let cursor = setMinutesOnDate(day, startMinutes);
  const dayEnd = setMinutesOnDate(day, endMinutes);

  while (cursor.getTime() + rule.slotDuration * 60_000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + rule.slotDuration * 60_000);
    slots.push({
      startsAt: new Date(cursor),
      endsAt: slotEnd,
      timezone: rule.timezone,
      duration: rule.slotDuration,
      bufferMinutes: rule.bufferMinutes,
      meetingLink: rule.meetingLink,
      locationLabel: rule.locationLabel,
    });
    cursor = new Date(slotEnd.getTime() + rule.bufferMinutes * 60_000);
  }

  return slots;
}

function buildOverrideSlots(
  override: AvailabilityOverrideLike
) {
  const duration = override.slotDuration ?? 30;
  const buffer = override.bufferMinutes ?? 10;
  const slots: Array<{
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    duration: number;
    bufferMinutes: number;
    meetingLink: string | null;
    locationLabel: string | null;
  }> = [];

  let cursor = new Date(override.startsAt);
  while (cursor.getTime() + duration * 60_000 <= override.endsAt.getTime()) {
    const slotEnd = new Date(cursor.getTime() + duration * 60_000);
    slots.push({
      startsAt: new Date(cursor),
      endsAt: slotEnd,
      timezone: override.timezone,
      duration,
      bufferMinutes: buffer,
      meetingLink: override.meetingLink,
      locationLabel: override.locationLabel,
    });
    cursor = new Date(slotEnd.getTime() + buffer * 60_000);
  }

  return slots;
}

export function generateInterviewSlots({
  interviewerId,
  domain,
  rules,
  overrides,
  busyIntervals,
  warningIntervals = [],
  rangeStart,
  days = 21,
}: {
  interviewerId: string;
  domain: InterviewDomain;
  rules: AvailabilityRuleLike[];
  overrides: AvailabilityOverrideLike[];
  busyIntervals: BusyInterval[];
  warningIntervals?: WarningInterval[];
  rangeStart: Date;
  days?: number;
}): GeneratedInterviewSlot[] {
  const results: GeneratedInterviewSlot[] = [];
  const seen = new Set<string>();
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);

  const activeRules = rules.filter(
    (rule) =>
      rule.interviewerId === interviewerId &&
      rule.isActive &&
      scopeMatches(rule.scope, domain)
  );
  const activeOverrides = overrides.filter(
    (override) =>
      override.interviewerId === interviewerId &&
      override.isActive &&
      scopeMatches(override.scope, domain)
  );

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);

    for (const rule of activeRules) {
      if (day.getDay() !== rule.dayOfWeek) continue;

      for (const slot of buildRuleSlotsForDay(rule, day)) {
        if (slot.startsAt < rangeStart) continue;

        const blocked = activeOverrides.some(
          (override) =>
            override.type === "BLOCKED" &&
            rangesOverlap(slot.startsAt, slot.endsAt, override.startsAt, override.endsAt)
        );
        if (blocked) continue;

        const busy = busyIntervals.some((interval) =>
          rangesOverlap(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt)
        );
        if (busy) continue;

        const slotKey = `${interviewerId}:${slot.startsAt.toISOString()}`;
        if (seen.has(slotKey)) continue;
        seen.add(slotKey);

        results.push({
          slotKey,
          interviewerId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          timezone: slot.timezone,
          duration: slot.duration,
          bufferMinutes: slot.bufferMinutes,
          meetingLink: slot.meetingLink,
          locationLabel: slot.locationLabel,
          warningLabels: warningIntervals
            .filter((interval) =>
              rangesOverlap(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt)
            )
            .map((interval) => interval.label),
        });
      }
    }
  }

  for (const override of activeOverrides) {
    if (override.type !== "OPEN") continue;
    if (override.endsAt <= start) continue;

    for (const slot of buildOverrideSlots(override)) {
      if (slot.startsAt < rangeStart) continue;

      const busy = busyIntervals.some((interval) =>
        rangesOverlap(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt)
      );
      if (busy) continue;

      const slotKey = `${interviewerId}:${slot.startsAt.toISOString()}`;
      if (seen.has(slotKey)) continue;
      seen.add(slotKey);

      results.push({
        slotKey,
        interviewerId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        duration: slot.duration,
        bufferMinutes: slot.bufferMinutes,
        meetingLink: slot.meetingLink,
        locationLabel: slot.locationLabel,
        warningLabels: warningIntervals
          .filter((interval) =>
            rangesOverlap(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt)
          )
          .map((interval) => interval.label),
      });
    }
  }

  return results.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

export function getInterviewRequestAgeBase({
  createdAt,
  rescheduleRequestedAt,
}: {
  createdAt: Date;
  rescheduleRequestedAt?: Date | null;
}) {
  return rescheduleRequestedAt ?? createdAt;
}

export function isInterviewRequestAtRisk({
  createdAt,
  rescheduleRequestedAt,
  status,
  now = new Date(),
}: {
  createdAt: Date;
  rescheduleRequestedAt?: Date | null;
  status: InterviewSchedulingRequestStatus;
  now?: Date;
}) {
  if (!["REQUESTED", "RESCHEDULE_REQUESTED"].includes(status)) {
    return false;
  }

  const ageBase = getInterviewRequestAgeBase({ createdAt, rescheduleRequestedAt });
  return now.getTime() - ageBase.getTime() >= 24 * 60 * 60 * 1000;
}
