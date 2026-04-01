import { InterviewAvailabilityOverrideType } from "@prisma/client";

export type SchedulingRuleLike = {
  id: string;
  ownerId: string;
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

export type SchedulingOverrideLike = {
  id: string;
  ownerId: string;
  ruleId: string | null;
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

export type GeneratedSchedulingSlot = {
  slotKey: string;
  ownerId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  duration: number;
  bufferMinutes: number;
  meetingLink: string | null;
  locationLabel: string | null;
  warningLabels: string[];
};

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

function buildRuleSlotsForDay(rule: SchedulingRuleLike, day: Date) {
  const startMinutes = parseTimeToMinutes(rule.startTime);
  const endMinutes = parseTimeToMinutes(rule.endTime);
  const slots: GeneratedSchedulingSlot[] = [];
  const dayStart = setMinutesOnDate(day, startMinutes);
  const dayEnd = setMinutesOnDate(day, endMinutes);
  let cursor = new Date(dayStart);

  while (cursor.getTime() + rule.slotDuration * 60_000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + rule.slotDuration * 60_000);
    slots.push({
      slotKey: `${rule.ownerId}:${cursor.toISOString()}`,
      ownerId: rule.ownerId,
      startsAt: new Date(cursor),
      endsAt: slotEnd,
      timezone: rule.timezone,
      duration: rule.slotDuration,
      bufferMinutes: rule.bufferMinutes,
      meetingLink: rule.meetingLink,
      locationLabel: rule.locationLabel,
      warningLabels: [],
    });
    cursor = new Date(slotEnd.getTime() + rule.bufferMinutes * 60_000);
  }

  return slots;
}

function buildOverrideSlots(override: SchedulingOverrideLike) {
  const duration = override.slotDuration ?? 30;
  const buffer = override.bufferMinutes ?? 10;
  const slots: GeneratedSchedulingSlot[] = [];
  let cursor = new Date(override.startsAt);

  while (cursor.getTime() + duration * 60_000 <= override.endsAt.getTime()) {
    const slotEnd = new Date(cursor.getTime() + duration * 60_000);
    slots.push({
      slotKey: `${override.ownerId}:${cursor.toISOString()}`,
      ownerId: override.ownerId,
      startsAt: new Date(cursor),
      endsAt: slotEnd,
      timezone: override.timezone,
      duration,
      bufferMinutes: buffer,
      meetingLink: override.meetingLink,
      locationLabel: override.locationLabel,
      warningLabels: [],
    });
    cursor = new Date(slotEnd.getTime() + buffer * 60_000);
  }

  return slots;
}

export function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function generateSchedulingSlots({
  ownerId,
  rules,
  overrides,
  busyIntervals,
  warningIntervals = [],
  rangeStart,
  days = 21,
}: {
  ownerId: string;
  rules: SchedulingRuleLike[];
  overrides: SchedulingOverrideLike[];
  busyIntervals: BusyInterval[];
  warningIntervals?: WarningInterval[];
  rangeStart: Date;
  days?: number;
}) {
  const results: GeneratedSchedulingSlot[] = [];
  const seen = new Set<string>();
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);

  const activeRules = rules.filter((rule) => rule.ownerId === ownerId && rule.isActive);
  const activeOverrides = overrides.filter(
    (override) => override.ownerId === ownerId && override.isActive
  );

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);

    for (const rule of activeRules) {
      if (day.getDay() !== rule.dayOfWeek) continue;

      for (const slot of buildRuleSlotsForDay(rule, day)) {
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

        if (seen.has(slot.slotKey)) continue;
        seen.add(slot.slotKey);

        slot.warningLabels = warningIntervals
          .filter((interval) =>
            rangesOverlap(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt)
          )
          .map((interval) => interval.label);

        results.push(slot);
      }
    }
  }

  for (const override of activeOverrides) {
    if (override.type !== "OPEN") continue;
    if (override.endsAt <= rangeStart) continue;

    for (const slot of buildOverrideSlots(override)) {
      if (slot.startsAt < rangeStart) continue;

      const busy = busyIntervals.some((interval) =>
        rangesOverlap(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt)
      );
      if (busy) continue;

      if (seen.has(slot.slotKey)) continue;
      seen.add(slot.slotKey);

      slot.warningLabels = warningIntervals
        .filter((interval) =>
          rangesOverlap(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt)
        )
        .map((interval) => interval.label);

      results.push(slot);
    }
  }

  return results.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

export function toDateTimeLocalValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export function formatScheduleDateTime(value: Date | string, locale?: string) {
  return new Date(value).toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatScheduleTime(value: Date | string, locale?: string) {
  return new Date(value).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatScheduleDate(value: Date | string, locale?: string) {
  return new Date(value).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
