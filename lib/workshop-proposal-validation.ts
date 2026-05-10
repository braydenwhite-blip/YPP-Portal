/**
 * Pure validation helpers for workshop proposal payloads.
 *
 * Used in two places:
 *   * Applicant studio — surfaces blockers next to the Submit button so
 *     applicants know what's missing before they try.
 *   * Server actions — re-validate on submit; the studio is the UX, the
 *     action is the boundary. Never trust client validation alone.
 */

import {
  CustomWorkshopPayload,
  EMPTY_CUSTOM_WORKSHOP,
  EMPTY_REFLECTION,
  MAX_WORKSHOP_CAPACITY,
  MAX_WORKSHOP_LENGTH_MIN,
  MIN_LEARNING_OBJECTIVE_CHARS,
  MIN_MAIN_ACTIVITY_CHARS,
  MIN_REFLECTION_CHARS,
  MIN_WORKSHOP_CAPACITY,
  MIN_WORKSHOP_LENGTH_MIN,
  WORKSHOP_FORMATS,
  WorkshopFormat,
  WorkshopReflectionPayload,
} from "@/lib/workshop-proposal-constants";

// ---------------------------------------------------------------------------
// Normalization — defensive coercion from Json -> typed payloads
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asPositiveInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function asWorkshopFormat(value: unknown): WorkshopFormat | "" {
  if (typeof value !== "string") return "";
  return (WORKSHOP_FORMATS as readonly string[]).includes(value)
    ? (value as WorkshopFormat)
    : "";
}

export function normalizeCustomWorkshop(value: unknown): CustomWorkshopPayload {
  if (!value || typeof value !== "object") return { ...EMPTY_CUSTOM_WORKSHOP };
  const v = value as Record<string, unknown>;
  return {
    title: asString(v.title).trim(),
    targetAgeGroup: asString(v.targetAgeGroup).trim(),
    lengthMinutes: asPositiveInt(v.lengthMinutes),
    category: asString(v.category).trim(),
    learningObjective: asString(v.learningObjective).trim(),
    materials: asStringList(v.materials),
    openingHook: asString(v.openingHook).trim(),
    mainActivity: asString(v.mainActivity).trim(),
    participationPlan: asString(v.participationPlan).trim(),
    wrapUp: asString(v.wrapUp).trim(),
    backupPlan: asString(v.backupPlan).trim(),
    format: asWorkshopFormat(v.format),
    locationNotes: asString(v.locationNotes).trim(),
    capacity: asPositiveInt(v.capacity),
    availability: asString(v.availability).trim(),
    safetyNotes: asString(v.safetyNotes).trim(),
  };
}

export function normalizeReflection(value: unknown): WorkshopReflectionPayload {
  if (!value || typeof value !== "object") return { ...EMPTY_REFLECTION };
  const v = value as Record<string, unknown>;
  return {
    whyChosen: asString(v.whyChosen).trim(),
    audienceAdaptation: asString(v.audienceAdaptation).trim(),
    hardestPart: asString(v.hardestPart).trim(),
    engagementPlan: asString(v.engagementPlan).trim(),
  };
}

// ---------------------------------------------------------------------------
// Validators — return human-readable issues; empty array means submit-ready.
// ---------------------------------------------------------------------------

export function customWorkshopIssues(payload: CustomWorkshopPayload): string[] {
  const issues: string[] = [];
  if (!payload.title) issues.push("Workshop title is required.");
  if (!payload.targetAgeGroup) issues.push("Target age group is required.");
  if (!payload.category) issues.push("Topic / category is required.");
  if (
    payload.lengthMinutes < MIN_WORKSHOP_LENGTH_MIN ||
    payload.lengthMinutes > MAX_WORKSHOP_LENGTH_MIN
  ) {
    issues.push(
      `Workshop length must be between ${MIN_WORKSHOP_LENGTH_MIN} and ${MAX_WORKSHOP_LENGTH_MIN} minutes.`
    );
  }
  if (
    !payload.learningObjective ||
    payload.learningObjective.length < MIN_LEARNING_OBJECTIVE_CHARS
  ) {
    issues.push(
      `Learning objective needs at least ${MIN_LEARNING_OBJECTIVE_CHARS} characters of detail.`
    );
  }
  if (
    !payload.mainActivity ||
    payload.mainActivity.length < MIN_MAIN_ACTIVITY_CHARS
  ) {
    issues.push(
      `Main activity needs at least ${MIN_MAIN_ACTIVITY_CHARS} characters — describe what students do step by step.`
    );
  }
  if (!payload.openingHook) issues.push("Opening hook is required — how do you grab attention in the first minutes?");
  if (!payload.participationPlan) issues.push("Student participation plan is required.");
  if (!payload.wrapUp) issues.push("Wrap-up / takeaway is required.");
  if (!payload.backupPlan) issues.push("Backup plan is required — what do you do if the room is quiet or confused?");
  if (!payload.format) {
    issues.push("Pick a workshop format (in person, virtual, or hybrid).");
  }
  // Location is required for any in-person/hybrid workshop and unnecessary
  // for virtual; gating it this way avoids forcing virtual proposals to
  // type "n/a".
  if (
    (payload.format === "IN_PERSON" || payload.format === "HYBRID") &&
    !payload.locationNotes
  ) {
    issues.push("Location is required for in-person and hybrid workshops.");
  }
  if (
    payload.capacity < MIN_WORKSHOP_CAPACITY ||
    payload.capacity > MAX_WORKSHOP_CAPACITY
  ) {
    issues.push(
      `Capacity must be between ${MIN_WORKSHOP_CAPACITY} and ${MAX_WORKSHOP_CAPACITY} students.`
    );
  }
  if (!payload.availability) {
    issues.push(
      "Availability is required — when can you actually run this workshop?"
    );
  }
  if (
    (payload.format === "IN_PERSON" || payload.format === "HYBRID") &&
    !payload.safetyNotes
  ) {
    issues.push(
      "Safety notes are required for in-person and hybrid workshops."
    );
  }
  return issues;
}

export function reflectionIssues(payload: WorkshopReflectionPayload): string[] {
  const issues: string[] = [];
  const fields: { key: keyof WorkshopReflectionPayload; label: string }[] = [
    { key: "whyChosen", label: "Why you chose this workshop" },
    { key: "audienceAdaptation", label: "How you'd adapt it for your audience" },
    { key: "hardestPart", label: "What part might be hardest to teach" },
    { key: "engagementPlan", label: "How you'd keep students engaged" },
  ];
  for (const f of fields) {
    const text = payload[f.key];
    if (!text) {
      issues.push(`${f.label} is required.`);
    } else if (text.length < MIN_REFLECTION_CHARS) {
      issues.push(
        `${f.label} needs at least ${MIN_REFLECTION_CHARS} characters of detail.`
      );
    }
  }
  return issues;
}

/**
 * Combined validator. Used by the submit action: a CUSTOM_DESIGN submission
 * still includes a (shorter) reflection because it lets reviewers compare
 * applicants on the same engagement/audience questions.
 *
 * For TEMPLATE_SELECTION submissions, only the reflection is required —
 * the template itself is a fixed admin asset.
 */
export function submissionIssues(opts: {
  sourceType: "CUSTOM_DESIGN" | "TEMPLATE_SELECTION";
  custom?: CustomWorkshopPayload | null;
  reflection: WorkshopReflectionPayload;
  templateId?: string | null;
}): string[] {
  const issues: string[] = [];
  if (opts.sourceType === "CUSTOM_DESIGN") {
    if (!opts.custom) {
      issues.push("Workshop outline is missing.");
    } else {
      issues.push(...customWorkshopIssues(opts.custom));
    }
  } else {
    if (!opts.templateId) {
      issues.push("Pick a workshop from the library before submitting.");
    }
  }
  issues.push(...reflectionIssues(opts.reflection));
  return issues;
}
