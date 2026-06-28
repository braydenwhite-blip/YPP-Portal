// Class Runtime OS (Phase 5) — pure rules for the public class catalog + family
// signup. A class is only advertised when it is genuinely safe to show families,
// and the signup availability/spots are derived deterministically. Prisma-free +
// testable; the loader fills `PublicClassInput` and the enroll path reuses the
// existing race-safe enrollInClass.

const PUBLIC_STATUSES = ["PUBLISHED", "IN_PROGRESS"];

export type PublicClassInput = {
  id: string;
  title: string;
  /** ClassOfferingStatus. */
  status: string;
  /** ClassOfferingApproval.status, or null. */
  approvalStatus: string | null;
  grandfathered: boolean;
  enrollmentOpen: boolean;
  capacity: number;
  enrolledCount: number;
  startDate: Date | null;
  hasDescription: boolean;
  hasSchedule: boolean;
};

/**
 * Is this class safe to advertise publicly? Published/in-progress + a real
 * approval (or the grandfather flag) + a title, description, and schedule a
 * family can act on. This is the trust gate on the catalog.
 */
export function isClassPubliclyAdvertisable(c: PublicClassInput): boolean {
  const visible = PUBLIC_STATUSES.includes(c.status) && (c.approvalStatus === "APPROVED" || c.grandfathered);
  return visible && c.title.trim().length > 0 && c.hasDescription && c.hasSchedule;
}

/** Spots left, or null when the class has no capacity limit. */
export function getSpotsRemaining(c: Pick<PublicClassInput, "capacity" | "enrolledCount">): number | null {
  if (c.capacity <= 0) return null;
  return Math.max(0, c.capacity - c.enrolledCount);
}

export type SignupAvailability = "open" | "waitlist" | "closed";

/** Whether a family can sign up now, join a waitlist, or signup is closed. */
export function getSignupAvailability(c: PublicClassInput): SignupAvailability {
  if (!c.enrollmentOpen) return "closed";
  const spots = getSpotsRemaining(c);
  if (spots == null || spots > 0) return "open";
  return "waitlist";
}

/** A student already enrolled / waitlisted / completed shouldn't re-enroll. */
export function detectDuplicateEnrollment(existingStatuses: string[]): boolean {
  return existingStatuses.some((s) => s === "ENROLLED" || s === "WAITLISTED" || s === "COMPLETED");
}

export type SignupConfirmation = {
  title: string;
  scheduleLabel: string;
  locationLabel: string;
  waitlisted: boolean;
  waitlistPosition?: number;
  nextSteps: string[];
};

/** The "what happens next" payload shown after a successful signup. */
export function buildSignupConfirmation(input: {
  title: string;
  scheduleLabel: string;
  locationLabel: string;
  waitlisted: boolean;
  waitlistPosition?: number | null;
}): SignupConfirmation {
  return {
    title: input.title,
    scheduleLabel: input.scheduleLabel,
    locationLabel: input.locationLabel,
    waitlisted: input.waitlisted,
    waitlistPosition: input.waitlistPosition ?? undefined,
    nextSteps: input.waitlisted
      ? [
          "You're on the waitlist — we'll email you the moment a spot opens.",
          "No payment or further action is needed right now.",
        ]
      : [
          "You're enrolled! Watch your email for class details and reminders.",
          `Add the first session to your calendar: ${input.scheduleLabel}.`,
          "Reach out to your chapter with any questions before day one.",
        ],
  };
}
