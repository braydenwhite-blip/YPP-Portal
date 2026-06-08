/**
 * Single source of truth for **public-facing** class status + schedule display.
 *
 * The `ClassOffering.status` enum is intentionally coarse (DRAFT | PUBLISHED |
 * IN_PROGRESS | COMPLETED | CANCELLED) and the review lifecycle lives in
 * `ClassOfferingApproval`. Student-facing surfaces need a richer, derived label
 * (Open / Almost full / Waitlist / Starts soon / In session / Completed) computed
 * from capacity, enrollment count, the registration switch, and the calendar.
 *
 * Deriving every public surface from this one helper guarantees a card, a detail
 * header, and a CTA never contradict each other (e.g. a badge that says "Open"
 * next to a button that says "Closed"). Pure + dependency-free so it renders in
 * server and client components and is trivially unit-testable.
 */

export type PublicClassStatus =
  | "OPEN"
  | "ALMOST_FULL"
  | "FULL_WAITLIST"
  | "STARTS_SOON"
  | "REGISTRATION_CLOSED"
  | "RUNNING"
  | "COMPLETED"
  | "CANCELLED";

export type ClassStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "neutral";

export type OfferingStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface PublicClassStatusInput {
  /** Raw offering status, when known. Catalog only surfaces PUBLISHED/IN_PROGRESS. */
  status?: OfferingStatus | null;
  enrollmentOpen: boolean;
  capacity: number;
  enrolledCount: number;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

export interface PublicClassStatusInfo {
  status: PublicClassStatus;
  /** Short badge label, e.g. "Almost full". */
  label: string;
  tone: ClassStatusTone;
  /** Primary CTA label, e.g. "Sign up" / "Join waitlist" / "Registration closed". */
  cta: string;
  /** Whether the primary CTA creates an enrollment (enroll or waitlist). */
  canSignUp: boolean;
  /** Whether the CTA joins a waitlist rather than taking a confirmed seat. */
  isWaitlist: boolean;
  spotsLeft: number;
  capacity: number;
  enrolledCount: number;
  /** One short sentence of helper copy, or null. */
  helper: string | null;
}

/** A class is "almost full" once this many seats (or fewer) remain. */
export const ALMOST_FULL_THRESHOLD = 3;
/** A class "starts soon" once the first session is within this many days. */
export const STARTS_SOON_DAYS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Derive the public status + CTA for a class. Order matters: terminal lifecycle
 * states (cancelled / completed / running) win over registration states, and
 * within registration we surface the most decision-relevant signal first
 * (full → almost full → starts soon → open).
 */
export function derivePublicClassStatus(
  input: PublicClassStatusInput,
): PublicClassStatusInfo {
  const now = input.now ?? new Date();
  const capacity = Math.max(0, input.capacity);
  const enrolledCount = Math.max(0, input.enrolledCount);
  const spotsLeft = Math.max(0, capacity - enrolledCount);
  const isFull = capacity > 0 && enrolledCount >= capacity;
  const start = toDate(input.startDate);
  const end = toDate(input.endDate);

  const base = { spotsLeft, capacity, enrolledCount };

  if (input.status === "CANCELLED") {
    return {
      ...base,
      status: "CANCELLED",
      label: "Cancelled",
      tone: "danger",
      cta: "Class cancelled",
      canSignUp: false,
      isWaitlist: false,
      helper: "This class is no longer running.",
    };
  }

  const hasEnded = input.status === "COMPLETED" || (end != null && now > end);
  if (hasEnded) {
    return {
      ...base,
      status: "COMPLETED",
      label: "Completed",
      tone: "neutral",
      cta: "Class completed",
      canSignUp: false,
      isWaitlist: false,
      helper: "This class has wrapped up.",
    };
  }

  const isRunning =
    input.status === "IN_PROGRESS" ||
    (start != null && now >= start && (end == null || now <= end));
  if (isRunning) {
    return {
      ...base,
      status: "RUNNING",
      label: "In session",
      tone: "purple",
      cta: "Class in session",
      canSignUp: false,
      isWaitlist: false,
      helper: "This class is currently running.",
    };
  }

  // Upcoming class — registration sub-states.
  if (!input.enrollmentOpen) {
    return {
      ...base,
      status: "REGISTRATION_CLOSED",
      label: "Registration closed",
      tone: "neutral",
      cta: "Registration closed",
      canSignUp: false,
      isWaitlist: false,
      helper: "Registration is closed for this class.",
    };
  }

  if (isFull) {
    return {
      ...base,
      status: "FULL_WAITLIST",
      label: "Waitlist open",
      tone: "warning",
      cta: "Join waitlist",
      canSignUp: true,
      isWaitlist: true,
      helper: "This class is full — join the waitlist and we'll hold your place in line.",
    };
  }

  if (spotsLeft <= ALMOST_FULL_THRESHOLD) {
    return {
      ...base,
      status: "ALMOST_FULL",
      label: "Almost full",
      tone: "warning",
      cta: "Sign up",
      canSignUp: true,
      isWaitlist: false,
      helper: `Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.`,
    };
  }

  const startsSoon =
    start != null && start.getTime() - now.getTime() <= STARTS_SOON_DAYS * DAY_MS;
  if (startsSoon) {
    return {
      ...base,
      status: "STARTS_SOON",
      label: "Starts soon",
      tone: "info",
      cta: "Sign up",
      canSignUp: true,
      isWaitlist: false,
      helper: "Starting soon — sign up before it begins.",
    };
  }

  return {
    ...base,
    status: "OPEN",
    label: "Open",
    tone: "success",
    cta: "Sign up",
    canSignUp: true,
    isWaitlist: false,
    helper: capacity > 0 ? `${spotsLeft} of ${capacity} spots open.` : null,
  };
}

// ── Display helpers ──────────────────────────────────────────────────────────

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** "Jul 8 – Jul 29" (year added only when the range crosses into a new year). */
export function formatClassDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
): string {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start && !end) return "Schedule TBD";
  if (start && !end) return start.toLocaleDateString("en-US", SHORT_DATE);
  if (!start && end) return end.toLocaleDateString("en-US", SHORT_DATE);
  const crossesYear = start!.getFullYear() !== end!.getFullYear();
  const opts: Intl.DateTimeFormatOptions = crossesYear
    ? { ...SHORT_DATE, year: "numeric" }
    : SHORT_DATE;
  return `${start!.toLocaleDateString("en-US", opts)} – ${end!.toLocaleDateString("en-US", { ...SHORT_DATE, year: "numeric" })}`;
}

/** "Mon/Wed" from ["Monday","Wednesday"]; empty string when no days set. */
export function formatMeetingDays(days: string[] | null | undefined): string {
  if (!days || days.length === 0) return "";
  return days.map((d) => d.slice(0, 3)).join("/");
}

/**
 * One-line human schedule summary, e.g.
 *   "4 sessions · Mon/Wed 4:00 PM · Jul 8 – Jul 29"   (multi-session)
 *   "One-time workshop · Sun, Jul 14 · 7:00 PM"        (single session)
 */
export function formatScheduleSummary(input: {
  sessionCount?: number | null;
  meetingDays?: string[] | null;
  meetingTime?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): string {
  const count = input.sessionCount ?? null;
  const days = formatMeetingDays(input.meetingDays);
  const time = input.meetingTime?.trim() || "";
  const range = formatClassDateRange(input.startDate, input.endDate);

  if (count === 1) {
    const start = toDate(input.startDate);
    const day = start
      ? start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : range;
    return ["One-time workshop", day, time].filter(Boolean).join(" · ");
  }

  const countLabel = count && count > 0 ? `${count} sessions` : "Multi-session";
  const dayTime = [days, time].filter(Boolean).join(" ");
  return [countLabel, dayTime, range].filter(Boolean).join(" · ");
}
