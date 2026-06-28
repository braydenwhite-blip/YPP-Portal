// Class Runtime OS (Phase 5) — pure attendance helpers shared by the server
// actions and the cockpit UI. Kept free of prisma/server imports so the payload
// shape, completion status, tally, and permission rule are fully unit-testable.

import { z } from "zod";

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export const AttendanceMarkSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().max(500).optional(),
});

/** Bulk roster submission for one session — the "submit once" workflow. */
export const SubmitAttendanceSchema = z.object({
  offeringId: z.string().min(1),
  sessionId: z.string().min(1),
  marks: z.array(AttendanceMarkSchema).min(1).max(500),
});
export type SubmitAttendanceInput = z.infer<typeof SubmitAttendanceSchema>;

/** Single-student correction after the fact. */
export const UpdateAttendanceSchema = z.object({
  offeringId: z.string().min(1),
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().max(500).optional(),
});
export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceSchema>;

export type AttendanceCompletion = "missing" | "partial" | "submitted";

/** Where a session's attendance stands, given roster size vs. records taken. */
export function attendanceCompletion(enrolled: number, recorded: number): AttendanceCompletion {
  if (recorded <= 0) return "missing";
  if (recorded < enrolled) return "partial";
  return "submitted";
}

export type AttendanceTally = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  /** Present+late ÷ total, whole percent; null when no marks. */
  percent: number | null;
};

/** Tally a set of attendance statuses (present + late count toward the rate). */
export function tallyAttendance(statuses: AttendanceStatusValue[]): AttendanceTally {
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;
  for (const s of statuses) {
    if (s === "PRESENT") present += 1;
    else if (s === "ABSENT") absent += 1;
    else if (s === "LATE") late += 1;
    else excused += 1;
  }
  const total = statuses.length;
  return { present, absent, late, excused, total, percent: total ? Math.round(((present + late) / total) * 100) : null };
}

export type AttendanceViewer = { id: string; roles: string[] };
export type AttendanceOffering = { instructorId: string | null; chapterId: string | null };

/**
 * May this viewer record attendance for the class? Admins, the lead instructor,
 * a confirmed co-instructor, or the Chapter President managing the offering's
 * chapter (national leadership counts as managing every chapter). Pure so the
 * rule is testable; callers resolve `isConfirmedCoInstructor` / `managesChapter`.
 */
export function canManageClassAttendance(
  viewer: AttendanceViewer,
  offering: AttendanceOffering,
  opts: { isConfirmedCoInstructor?: boolean; managesChapter?: boolean } = {}
): boolean {
  if (viewer.roles.includes("ADMIN")) return true;
  if (offering.instructorId && offering.instructorId === viewer.id) return true;
  if (opts.isConfirmedCoInstructor) return true;
  if (opts.managesChapter) return true;
  return false;
}
