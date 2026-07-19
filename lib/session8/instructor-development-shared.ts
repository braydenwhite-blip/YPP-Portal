// Client-safe constants and helpers for the instructor development surfaces.
// Keep this module free of server-only imports (prisma, authorization) so
// "use client" components can import it directly.

/** Sunday(0) … Saturday(6), matching `InstructorAvailability.weekday`. */
export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export const SUPPORT_CATEGORIES = [
  "LOGISTICS",
  "MATERIALS",
  "ROSTER",
  "SCHEDULING",
  "ATTENDANCE",
  "STUDENT_SUPPORT",
  "TECHNICAL",
] as const;

export const SUPPORT_CATEGORY_LABELS: Record<(typeof SUPPORT_CATEGORIES)[number], string> = {
  LOGISTICS: "Logistics",
  MATERIALS: "Materials",
  ROSTER: "Roster",
  SCHEDULING: "Scheduling",
  ATTENDANCE: "Attendance",
  STUDENT_SUPPORT: "Student support",
  TECHNICAL: "Technical",
};
