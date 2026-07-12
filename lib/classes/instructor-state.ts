/**
 * Instructor portal state model.
 *
 * The database stores a session's calendar date and wall-clock time separately.
 * These helpers combine them in the class timezone, then derive every instructor
 * state from real records. The UI receives plain reasons and direct actions; it
 * never has to guess what an abstract "health" score means.
 */

export type SessionLifecycle = "before" | "during" | "after" | "cancelled";
export type AttendanceCompletion = "not_required" | "missing" | "partial" | "complete";
export type InstructorSessionActionKind =
  | "finish_preparation"
  | "review_lesson"
  | "take_attendance"
  | "add_recap"
  | "view_recap";

export type PreparationCheck = {
  key: "lesson" | "materials" | "location" | "review";
  label: string;
  complete: boolean;
  reason: string;
};

export type PreparationStatus = {
  complete: boolean;
  checks: PreparationCheck[];
  incompleteReasons: string[];
};

export type SessionStateInput = {
  id: string;
  classId: string;
  sessionNumber: number;
  topic: string;
  date: Date;
  startTime: string;
  endTime: string;
  timezone: string;
  isCancelled: boolean;
  notesUrl: string | null;
  lessonPlanId: string | null;
  description: string | null;
  learningOutcomes: string[];
  materialsUrl: string | null;
  classMaterials: string[];
  deliveryMode: string;
  zoomLink: string | null;
  locationName: string | null;
  locationAddress: string | null;
  room: string | null;
  activeStudentCount: number;
  attendanceRecordCount: number;
  reflectionDone: boolean;
  preparationCompletedAt: Date | null;
};

export type InstructorSessionAction = {
  kind: InstructorSessionActionKind;
  label: string;
  title: string;
  reason: string;
  href: string;
  /** Lower numbers are more urgent. */
  rank: number;
};

export type DerivedSessionState = {
  lifecycle: SessionLifecycle;
  startsAt: Date;
  endsAt: Date;
  preparation: PreparationStatus;
  attendance: AttendanceCompletion;
  action: InstructorSessionAction;
};

function parseClock(value: string, fallbackHour: number): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return { hour: fallbackHour, minute: 0 };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { hour: fallbackHour, minute: 0 };
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return { hour, minute: 0 };
  return { hour, minute };
}

function zonedParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

/**
 * Convert the session's stored calendar day + local wall-clock time to an
 * absolute instant. Two offset passes handle daylight-saving boundaries.
 */
export function sessionDateTime(date: Date, clock: string, timezone: string): Date {
  const { hour, minute } = parseClock(clock, date.getUTCHours());
  const targetWallClock = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute,
    0,
    0
  );

  let candidate = targetWallClock;
  try {
    for (let pass = 0; pass < 2; pass += 1) {
      const displayed = zonedParts(new Date(candidate), timezone);
      const displayedAsUtc = Date.UTC(
        displayed.year,
        displayed.month - 1,
        displayed.day,
        displayed.hour,
        displayed.minute,
        0,
        0
      );
      candidate = targetWallClock - (displayedAsUtc - candidate);
    }
  } catch {
    // Invalid legacy timezone values should not break the whole workspace.
    // Falling back to the stored UTC day/time is deterministic and explainable.
    return new Date(targetWallClock);
  }
  return new Date(candidate);
}

export function attendanceCompletion(
  activeStudentCount: number,
  attendanceRecordCount: number
): AttendanceCompletion {
  if (activeStudentCount <= 0) return "not_required";
  if (attendanceRecordCount <= 0) return "missing";
  if (attendanceRecordCount < activeStudentCount) return "partial";
  return "complete";
}

export function derivePreparation(input: SessionStateInput): PreparationStatus {
  const hasLesson = Boolean(
    input.lessonPlanId ||
      input.notesUrl?.trim() ||
      input.description?.trim() ||
      input.learningOutcomes.some((outcome) => outcome.trim().length > 0)
  );
  const hasMaterials = Boolean(
    input.materialsUrl?.trim() || input.classMaterials.some((material) => material.trim().length > 0)
  );

  const physicalLocation = Boolean(
    input.locationName?.trim() || input.locationAddress?.trim() || input.room?.trim()
  );
  const virtualLocation = Boolean(input.zoomLink?.trim());
  const hasLocation =
    input.deliveryMode === "VIRTUAL"
      ? virtualLocation
      : input.deliveryMode === "HYBRID"
        ? physicalLocation && virtualLocation
        : physicalLocation;

  const checks: PreparationCheck[] = [
    {
      key: "lesson",
      label: "Lesson is ready to review",
      complete: hasLesson,
      reason: hasLesson
        ? "A lesson link, session description, or learning outcome is attached."
        : `Session ${input.sessionNumber} has no lesson link, instructions, or learning outcomes.`,
    },
    {
      key: "materials",
      label: "Teaching materials are attached",
      complete: hasMaterials,
      reason: hasMaterials
        ? "Session or class materials are attached."
        : `Session ${input.sessionNumber} has no teaching materials attached.`,
    },
    {
      key: "location",
      label: "Class location is confirmed",
      complete: hasLocation,
      reason: hasLocation
        ? "The class location or meeting link is available."
        : input.deliveryMode === "VIRTUAL"
          ? "The virtual meeting link is missing."
          : input.deliveryMode === "HYBRID"
            ? "A hybrid class needs both a physical location and a virtual meeting link."
            : "The in-person class location is missing.",
    },
    {
      key: "review",
      label: "Preparation review is complete",
      complete: input.preparationCompletedAt != null,
      reason: input.preparationCompletedAt
        ? "You marked the lesson, materials, and permitted student context as reviewed."
        : "You have not marked this session's preparation review complete.",
    },
  ];

  return {
    complete: checks.every((check) => check.complete),
    checks,
    incompleteReasons: checks.filter((check) => !check.complete).map((check) => check.reason),
  };
}

function actionHref(input: SessionStateInput, section: "before" | "during" | "after") {
  return `/instructor/classes/${input.classId}?session=${input.id}#${section}`;
}

export function deriveSessionState(input: SessionStateInput, now: Date): DerivedSessionState {
  const startsAt = sessionDateTime(input.date, input.startTime, input.timezone);
  const rawEnd = sessionDateTime(input.date, input.endTime, input.timezone);
  const endsAt = rawEnd.getTime() > startsAt.getTime()
    ? rawEnd
    : new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000);
  const preparation = derivePreparation(input);
  const attendance = attendanceCompletion(input.activeStudentCount, input.attendanceRecordCount);

  let lifecycle: SessionLifecycle;
  if (input.isCancelled) lifecycle = "cancelled";
  else if (now.getTime() < startsAt.getTime()) lifecycle = "before";
  else if (now.getTime() <= endsAt.getTime()) lifecycle = "during";
  else lifecycle = "after";

  let action: InstructorSessionAction;
  if (lifecycle === "before" && !preparation.complete) {
    action = {
      kind: "finish_preparation",
      label: "Finish preparation",
      title: `Finish preparing Session ${input.sessionNumber}`,
      reason: preparation.incompleteReasons.join(" "),
      href: actionHref(input, "before"),
      rank: 3,
    };
  } else if (lifecycle === "before") {
    action = {
      kind: "review_lesson",
      label: "Review lesson",
      title: `Review Session ${input.sessionNumber}: ${input.topic}`,
      reason: "The lesson, materials, and class location are ready.",
      href: actionHref(input, "before"),
      rank: 5,
    };
  } else if (lifecycle === "during") {
    action = {
      kind: "take_attendance",
      label: "Take attendance",
      title: `Run Session ${input.sessionNumber}: ${input.topic}`,
      reason: "This session is happening now. Materials and attendance are together in the session workspace.",
      href: actionHref(input, "during"),
      rank: 0,
    };
  } else if (lifecycle === "after" && (attendance === "missing" || attendance === "partial")) {
    action = {
      kind: "take_attendance",
      label: attendance === "partial" ? "Finish attendance" : "Take attendance",
      title: `${attendance === "partial" ? "Finish" : "Record"} attendance for Session ${input.sessionNumber}`,
      reason:
        attendance === "partial"
          ? `${input.attendanceRecordCount} of ${input.activeStudentCount} students have an attendance mark.`
          : `Session ${input.sessionNumber} ended without attendance for its ${input.activeStudentCount} enrolled student${input.activeStudentCount === 1 ? "" : "s"}.`,
      href: actionHref(input, "during"),
      rank: 0,
    };
  } else if (lifecycle === "after" && !input.reflectionDone) {
    action = {
      kind: "add_recap",
      label: "Add session recap",
      title: `Add the recap for Session ${input.sessionNumber}`,
      reason: "Attendance is complete, but the post-session recap has not been submitted.",
      href: actionHref(input, "after"),
      rank: 1,
    };
  } else {
    action = {
      kind: "view_recap",
      label: "View class recap",
      title: `Review Session ${input.sessionNumber}`,
      reason:
        lifecycle === "cancelled"
          ? "This session was cancelled; its class record remains available."
          : "Attendance and the session recap are complete.",
      href: actionHref(input, "after"),
      rank: 9,
    };
  }

  return { lifecycle, startsAt, endsAt, preparation, attendance, action };
}
