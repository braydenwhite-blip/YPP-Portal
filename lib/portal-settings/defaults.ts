// Portal-wide settings — DEFAULTS (single source of truth).
//
// Every admin-editable business-rule number lives here, grouped by module. This
// file is PURE (no imports, no `server-only`, no prisma) so it is safe to import
// from client components, tests, and isomorphic modules. The DB only ever stores
// *overrides*; `getPortalSettings()` (./index) merges any stored override OVER
// these defaults, so an unset key always falls back to the value below — there is
// zero behaviour change until an admin saves an override.
//
// ── How to make another hardcoded constant editable ─────────────────────────
//   1. Move the literal into the right group below (and have its original module
//      re-export it from here, or keep the `export const` as a thin alias, so
//      existing imports/tests stay untouched).
//   2. Add the key to the matching zod group in ./schema.ts (optional + coerced).
//   3. In the surface's TOP-LEVEL server loader, `await getPortalSettings()` and
//      pass the value into the pure function via an optional param that defaults
//      to the constant (so call sites and unit tests don't change).
//   4. Add a field to the matching group in the admin form and revalidate that
//      surface's path in ./actions.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Ordering map: status key → sort rank (lower = more urgent / shown first). */
export type StatusOrder = Record<string, number>;

export type ChapterOsSettings = {
  /** Max evidence rows rendered per Deliberable table (stats reflect the full set). */
  deliberableRowCap: number;
  /** Partner follow-up this many days overdue ⇒ "stuck". */
  partnerFollowUpOverdueStuckDays: number;
  /** No partner contact for this many days ⇒ "stuck". */
  partnerSinceContactStuckDays: number;
  /** Hours a chair has after an interview to record a decision before it's overdue. */
  instructorDecisionSlaHours: number;
  /** Applicant stalled in triage this many days ⇒ "at risk". */
  instructorTriageStaleDays: number;
  partnerStatusOrder: StatusOrder;
  instructorStatusOrder: StatusOrder;
  curriculumStatusOrder: StatusOrder;
  classStatusOrder: StatusOrder;
};

export type PeopleStrategySettings = {
  /** Days an open item goes unreviewed before it counts as "stale". */
  staleActivityDays: number;
  /** Open-item load above which an owner is flagged as potentially overloaded. */
  overloadedOpenItems: number;
  /** Default deadline (days out) applied to a newly created action item. */
  defaultActionDeadlineDays: number;
  /** Window (days) within which an upcoming due date counts as "due soon". */
  actionDueSoonDays: number;
};

export type ClassFeedbackSettings = {
  /** Average rating at or above which feedback counts as "good". */
  goodFeedbackMinRating: number;
  /** Minimum responses required before "good feedback" can be inferred. */
  goodFeedbackMinResponses: number;
};

export type InstructorMentorshipSettings = {
  /** Mentorship session with no activity for this many days ⇒ "stale". */
  staleSessionDays: number;
};

export type PortalSettings = {
  chapterOs: ChapterOsSettings;
  peopleStrategy: PeopleStrategySettings;
  classFeedback: ClassFeedbackSettings;
  instructorMentorship: InstructorMentorshipSettings;
};

export const PORTAL_SETTINGS_DEFAULTS: PortalSettings = {
  chapterOs: {
    deliberableRowCap: 8,
    partnerFollowUpOverdueStuckDays: 7,
    partnerSinceContactStuckDays: 14,
    instructorDecisionSlaHours: 12,
    instructorTriageStaleDays: 7,
    partnerStatusOrder: { stuck: 0, at_risk: 1, on_track: 2 },
    instructorStatusOrder: { at_risk: 0, on_track: 1, strong: 2 },
    curriculumStatusOrder: { needs_feedback: 0, not_started: 1, ready: 2 },
    classStatusOrder: { not_ready: 0, needs_attention: 1, ready: 2 },
  },
  peopleStrategy: {
    staleActivityDays: 14,
    overloadedOpenItems: 6,
    defaultActionDeadlineDays: 3,
    actionDueSoonDays: 3,
  },
  classFeedback: {
    goodFeedbackMinRating: 4,
    goodFeedbackMinResponses: 2,
  },
  instructorMentorship: {
    staleSessionDays: 30,
  },
};

export type PortalSettingsGroupKey = keyof PortalSettings;
