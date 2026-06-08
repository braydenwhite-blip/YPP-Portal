/**
 * Publish-readiness checklist for a `ClassOffering`.
 *
 * Before this, the "can this class go live?" rules were scattered across the
 * instructor settings form, the approval action, and `adminPublishClassOffering`
 * — so instructors only discovered a missing meeting link at the very last step.
 * This is the single, pure definition of what a class needs before it can be
 * published, surfaced as a friendly "Missing before publish" checklist on both
 * the instructor settings page and the admin class detail page.
 *
 * Pure + dependency-free so it renders anywhere and is unit-testable. It does not
 * replace the server-side guards in `adminPublishClassOffering` (defense in depth)
 * — it makes them legible ahead of time.
 */

export type OfferingApprovalStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED";

export interface PublishReadinessInput {
  title?: string | null;
  description?: string | null;
  instructorId?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  meetingDays?: string[] | null;
  meetingTime?: string | null;
  capacity?: number | null;
  targetAgeGroup?: string | null;
  deliveryMode?: "IN_PERSON" | "VIRTUAL" | "HYBRID" | null;
  locationName?: string | null;
  locationAddress?: string | null;
  zoomLink?: string | null;
  sessionCount?: number | null;
  approvalStatus?: OfferingApprovalStatus | null;
  grandfatheredTrainingExemption?: boolean;
  /** Where the "fix this" links should point (e.g. instructor settings url). */
  editHref?: string;
  /** Review page url for the approval item. */
  reviewHref?: string;
}

export interface PublishReadinessItem {
  key: string;
  label: string;
  done: boolean;
  /** Blocks publishing when false; recommended items inform but don't block. */
  required: boolean;
  detail?: string;
  href?: string;
}

export interface PublishReadiness {
  items: PublishReadinessItem[];
  /** Required items still outstanding. */
  missing: PublishReadinessItem[];
  /** Recommended (non-blocking) items still outstanding. */
  recommended: PublishReadinessItem[];
  /** True when every required item is satisfied. */
  ready: boolean;
  requiredDone: number;
  requiredTotal: number;
}

function has(value?: string | null): boolean {
  return Boolean(value && String(value).trim().length > 0);
}

export function computePublishReadiness(input: PublishReadinessInput): PublishReadiness {
  const edit = input.editHref;
  const mode = input.deliveryMode ?? "VIRTUAL";
  const needsLocation = mode === "IN_PERSON";
  const needsLink = mode === "VIRTUAL" || mode === "HYBRID";
  const approved =
    input.grandfatheredTrainingExemption === true || input.approvalStatus === "APPROVED";

  const items: PublishReadinessItem[] = [
    {
      key: "title",
      label: "Add a class title",
      done: has(input.title),
      required: true,
      href: edit,
    },
    {
      key: "description",
      label: "Add a class description",
      done: has(input.description),
      required: true,
      detail: "What the class is about and what students will do.",
      href: edit,
    },
    {
      key: "instructor",
      label: "Assign an instructor",
      done: has(input.instructorId),
      required: true,
      href: edit,
    },
    {
      key: "startDate",
      label: "Set a start date",
      done: input.startDate != null,
      required: true,
      href: edit,
    },
    {
      key: "meetingTime",
      label: "Set a meeting time",
      done: has(input.meetingTime),
      required: true,
      href: edit,
    },
    {
      key: "capacity",
      label: "Set a class capacity",
      done: typeof input.capacity === "number" && input.capacity > 0,
      required: true,
      detail: "How many students can enroll before the waitlist opens.",
      href: edit,
    },
    {
      key: "logistics",
      label: needsLocation ? "Add a location & address" : "Add a meeting link",
      done: needsLocation
        ? has(input.locationName) && has(input.locationAddress)
        : needsLink
          ? has(input.zoomLink)
          : true,
      required: true,
      detail: needsLocation
        ? "In-person classes need a place to meet."
        : "Online and hybrid classes need a link students can join.",
      href: edit,
    },
    {
      key: "approval",
      label: "Get admin approval",
      done: approved,
      required: true,
      detail: approved
        ? undefined
        : input.approvalStatus === "CHANGES_REQUESTED"
          ? "Revisions were requested — update and resubmit."
          : input.approvalStatus === "REJECTED"
            ? "This proposal was rejected."
            : input.approvalStatus === "REQUESTED" || input.approvalStatus === "UNDER_REVIEW"
              ? "Submitted — waiting on an admin review."
              : "Submit the class for review.",
      href: input.reviewHref,
    },
    // Recommended (non-blocking) — strengthen the class but don't gate publish.
    {
      key: "endDate",
      label: "Set an end date",
      done: input.endDate != null,
      required: false,
      href: edit,
    },
    {
      key: "meetingDays",
      label: "Set meeting days",
      done: Array.isArray(input.meetingDays) && input.meetingDays.length > 0,
      required: false,
      href: edit,
    },
    {
      key: "ageRange",
      label: "Add age / grade guidance",
      done: has(input.targetAgeGroup),
      required: false,
      detail: "Helps students and parents know who the class is for.",
      href: edit,
    },
    {
      key: "sessions",
      label: "Generate the session schedule",
      done: typeof input.sessionCount === "number" && input.sessionCount > 0,
      required: false,
      href: edit,
    },
  ];

  const missing = items.filter((i) => i.required && !i.done);
  const recommended = items.filter((i) => !i.required && !i.done);
  const requiredItems = items.filter((i) => i.required);

  return {
    items,
    missing,
    recommended,
    ready: missing.length === 0,
    requiredDone: requiredItems.filter((i) => i.done).length,
    requiredTotal: requiredItems.length,
  };
}
