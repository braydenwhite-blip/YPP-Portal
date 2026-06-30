// ============================================================================
// YPP Portal Automation Brain — canonical contracts
// ============================================================================
//
// This is the reuse-first "automation intelligence" layer. It does NOT replace
// the existing Chapter Operating System (`lib/chapters/*`). Instead it defines a
// single, normalized contract — the `AutomationItem` — that every existing
// signal source (the deterministic `ChapterBlocker` engine in
// `needs-attention-rules.ts`, the unified room `RoomNeedsItem` feed in
// `rooms.ts`, the `StudentCommunityNeed` feed, and the new playbook/readiness/
// escalation generators here) is projected into. On top of that it adds the
// genuinely-missing pieces the existing OS does not provide:
//
//   • a 12-week PLAYBOOK INTERPRETER (expected vs done vs missing/overdue)
//   • a multi-stage CHAPTER STAGE detector
//   • a WORKFLOW recipe registry
//   • a chapter-wide READINESS engine
//   • a leadership ESCALATION read model
//
// Everything here is PURE + serializable (no Prisma, no `server-only`, dates are
// ISO strings) so it crosses the server→client boundary cleanly and is fully
// unit-testable. Persistence (dismiss/snooze) is intentionally a read-model
// concern for now — see `canDismiss`/`canSnooze` + `lib/automation/item-identity.ts`.

// ---------------------------------------------------------------------------
// Severity / urgency / status
// ---------------------------------------------------------------------------

/** How much an automation item matters, escalating left→right. */
export type AutomationSeverity = "INFO" | "ATTENTION" | "URGENT" | "BLOCKING";

export const AUTOMATION_SEVERITIES: readonly AutomationSeverity[] = [
  "INFO",
  "ATTENTION",
  "URGENT",
  "BLOCKING",
] as const;

/** Lower = more severe (for sorting). */
export const SEVERITY_RANK: Record<AutomationSeverity, number> = {
  BLOCKING: 0,
  URGENT: 1,
  ATTENTION: 2,
  INFO: 3,
};

/** Lifecycle of a read-model item. Pure builds always emit OPEN; SNOOZED /
 *  DISMISSED / RESOLVED are applied by an (optional, future) persistence layer. */
export type AutomationStatus = "OPEN" | "SNOOZED" | "DISMISSED" | "RESOLVED";

// ---------------------------------------------------------------------------
// Workflow lanes (Layer 4 — the multi-step processes automation belongs to)
// ---------------------------------------------------------------------------

export type AutomationWorkflow =
  | "PARTNERS"
  | "INSTRUCTORS"
  | "CURRICULUM"
  | "CLASSES"
  | "STUDENTS"
  | "ENROLLMENT"
  | "ATTENDANCE"
  | "MEETINGS"
  | "IMPACT_MEETINGS"
  | "SESSION_REVIEW"
  | "CHAPTER_READINESS";

export const AUTOMATION_WORKFLOWS: readonly AutomationWorkflow[] = [
  "PARTNERS",
  "INSTRUCTORS",
  "CURRICULUM",
  "CLASSES",
  "STUDENTS",
  "ENROLLMENT",
  "ATTENDANCE",
  "MEETINGS",
  "IMPACT_MEETINGS",
  "SESSION_REVIEW",
  "CHAPTER_READINESS",
] as const;

export const WORKFLOW_LABELS: Record<AutomationWorkflow, string> = {
  PARTNERS: "Partners",
  INSTRUCTORS: "Instructors",
  CURRICULUM: "Curriculum",
  CLASSES: "Classes",
  STUDENTS: "Students",
  ENROLLMENT: "Enrollment",
  ATTENDANCE: "Attendance",
  MEETINGS: "Meetings",
  IMPACT_MEETINGS: "Impact Meetings",
  SESSION_REVIEW: "Session Review",
  CHAPTER_READINESS: "Chapter Readiness",
};

// ---------------------------------------------------------------------------
// Automation item types (Layer 3 — the concrete generated work)
// ---------------------------------------------------------------------------

export type AutomationItemType =
  // Partners
  | "PARTNER_RESEARCH_NOT_STARTED"
  | "PARTNER_OUTREACH_BELOW_TARGET"
  | "PARTNER_FOLLOW_UP_DUE"
  | "PARTNER_MEETING_OUTCOME_MISSING"
  | "PARTNER_LOGISTICS_INCOMPLETE"
  | "PARTNER_ISSUE_UNRESOLVED"
  | "PARTNER_WEEKLY_CHECKIN_DUE"
  // Instructors
  | "INSTRUCTOR_RECRUITING_NOT_STARTED"
  | "INSTRUCTOR_OUTREACH_BELOW_TARGET"
  | "INSTRUCTOR_APPLICATION_REVIEW_DUE"
  | "INSTRUCTOR_INTERVIEW_UNSCHEDULED"
  | "INSTRUCTOR_INTERVIEW_DECISION_DUE"
  | "INSTRUCTOR_ORIENTATION_MISSING"
  | "INSTRUCTOR_READINESS_CHECK_DUE"
  | "INSTRUCTOR_ASSIGNMENT_UNCONFIRMED"
  // Curriculum
  | "CURRICULUM_SUBMISSION_MISSING"
  | "CURRICULUM_REVIEW_DUE"
  | "CURRICULUM_REVISION_OVERDUE"
  | "CURRICULUM_GLOBAL_REVIEW_READY"
  // Classes
  | "CLASS_MISSING_INSTRUCTOR"
  | "CLASS_MISSING_LOCATION"
  | "CLASS_MISSING_TIME"
  | "CLASS_NOT_PUBLIC"
  | "LAUNCH_DATE_MISSING"
  | "PRE_LAUNCH_REMINDER_DUE"
  // Enrollment / advertising
  | "ENROLLMENT_LOW"
  | "ENROLLMENT_TREND_RISK"
  | "ADVERTISING_NOT_STARTED"
  | "ADVERTISING_CHANNEL_MISSING"
  // Attendance / retention
  | "STUDENT_ABSENCE_STREAK"
  | "ATTENDANCE_DROP"
  | "FEEDBACK_COLLECTION_DUE"
  // Live operations
  | "INSTRUCTOR_WEEKLY_CHECKIN_DUE"
  | "CLASS_OBSERVATION_DUE"
  // Session 2 / review
  | "SESSION_2_RETURNING_INSTRUCTOR_RESPONSE_DUE"
  | "SESSION_2_RECRUITING_DUE"
  | "SESSION_REVIEW_DUE"
  // Impact meetings
  | "IMPACT_MEETING_PREP_DUE"
  | "IMPACT_MEETING_NUMBERS_MISSING"
  // Chapter readiness / playbook
  | "CHAPTER_BEHIND_PLAYBOOK";

// ---------------------------------------------------------------------------
// Entity links (align with the existing `entityType` vocabulary in
// needs-attention-rules.ts / rooms.ts, extended for the brain's new sources)
// ---------------------------------------------------------------------------

export type AutomationEntityType =
  | "PARTNER"
  | "INSTRUCTOR_APPLICATION"
  | "CLASS_OFFERING"
  | "CURRICULUM"
  | "CLASS_SESSION"
  | "STUDENT"
  | "MEETING"
  | "CHAPTER";

// ---------------------------------------------------------------------------
// Cross-cutting relevance signals
// ---------------------------------------------------------------------------

/** How relevant an item is to the next Chapter Impact Meeting. */
export type ImpactMeetingRelevance =
  | "none"
  | "fyi" // worth a mention
  | "bring" // bring the numbers / status to the meeting
  | "decision"; // needs a decision from global leadership

/** Why/how an item should escalate to global leadership (null = stays local). */
export type AutomationEscalation = {
  /** Plain-language reason this rose above the Chapter President. */
  reason: string;
  /** The concrete move global leadership should make. */
  recommendedLeadershipAction: string;
  /** How long (hours) the underlying condition has persisted, when known. */
  ageHours?: number;
};

// ---------------------------------------------------------------------------
// THE canonical automation item
// ---------------------------------------------------------------------------

export type AutomationItem = {
  /** Deterministic, stable id — see `lib/automation/item-identity.ts`. */
  id: string;
  type: AutomationItemType;
  workflow: AutomationWorkflow;
  chapterId: string;

  /** What this item is about (a partner, applicant, class, etc.). */
  entityType: AutomationEntityType | null;
  entityId: string | null;

  /** Plain-language problem statement, e.g. "Follow up with Bronxville Library". */
  title: string;
  /** One line on what to do. */
  description: string;
  /**
   * The EXPLAINABILITY string — never "Follow-up needed". Always evidence +
   * playbook rule, e.g. "You emailed Bronxville Public Library 6 business days
   * ago and no response has been logged. The CP guide expects follow-up after
   * 5–7 business days."
   */
  why: string;

  /** ISO timestamp the work is due (null = no hard due date). */
  dueAt: string | null;
  /** ISO timestamp the item was generated (the build `now`). */
  createdAt: string;

  severity: AutomationSeverity;
  /** 0–100 sort score: severity + overdue + due-soon + playbook pressure. */
  urgency: number;
  status: AutomationStatus;

  /** Suggested owner (defaults to the chapter president when null). */
  ownerId: string | null;

  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel: string | null;
  secondaryActionHref: string | null;

  /** Raw evidence numbers behind the item (counts, dates, thresholds). */
  sourceData: Record<string, unknown>;
  /** Human-readable resolution condition, e.g. "Log a partner meeting outcome". */
  resolvesWhen: string;

  canDismiss: boolean;
  canSnooze: boolean;

  /** Non-null when this should rise to global leadership. */
  escalation: AutomationEscalation | null;
  impactMeetingRelevance: ImpactMeetingRelevance;
  /** The playbook week this item primarily belongs to (null = always-on). */
  playbookWeekRelevance: number | null;
};

// ---------------------------------------------------------------------------
// Per-type static metadata (workflow + default severity/relevance/copy).
// This is the single source of truth that lets normalizers and net-new
// generators emit consistent items without repeating themselves.
// ---------------------------------------------------------------------------

export type AutomationTypeMeta = {
  workflow: AutomationWorkflow;
  /** Default severity (a generator may upgrade it, e.g. when overdue). */
  defaultSeverity: AutomationSeverity;
  impactMeetingRelevance: ImpactMeetingRelevance;
  /** Whether a CP may dismiss / snooze this class of item. */
  canDismiss: boolean;
  canSnooze: boolean;
  /** Short noun phrase for the item class (used in copy + grouping). */
  label: string;
};

export const AUTOMATION_TYPE_META: Record<AutomationItemType, AutomationTypeMeta> = {
  // Partners
  PARTNER_RESEARCH_NOT_STARTED: { workflow: "PARTNERS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Partner research" },
  PARTNER_OUTREACH_BELOW_TARGET: { workflow: "PARTNERS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Partner outreach" },
  PARTNER_FOLLOW_UP_DUE: { workflow: "PARTNERS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Partner follow-up" },
  PARTNER_MEETING_OUTCOME_MISSING: { workflow: "PARTNERS", defaultSeverity: "URGENT", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Meeting outcome" },
  PARTNER_LOGISTICS_INCOMPLETE: { workflow: "PARTNERS", defaultSeverity: "URGENT", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Partner logistics" },
  PARTNER_ISSUE_UNRESOLVED: { workflow: "PARTNERS", defaultSeverity: "URGENT", impactMeetingRelevance: "decision", canDismiss: false, canSnooze: false, label: "Partner issue" },
  PARTNER_WEEKLY_CHECKIN_DUE: { workflow: "PARTNERS", defaultSeverity: "INFO", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Partner check-in" },
  // Instructors
  INSTRUCTOR_RECRUITING_NOT_STARTED: { workflow: "INSTRUCTORS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Instructor recruiting" },
  INSTRUCTOR_OUTREACH_BELOW_TARGET: { workflow: "INSTRUCTORS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Instructor outreach" },
  INSTRUCTOR_APPLICATION_REVIEW_DUE: { workflow: "INSTRUCTORS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Application review" },
  INSTRUCTOR_INTERVIEW_UNSCHEDULED: { workflow: "INSTRUCTORS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Interview scheduling" },
  INSTRUCTOR_INTERVIEW_DECISION_DUE: { workflow: "INSTRUCTORS", defaultSeverity: "URGENT", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: false, label: "Interview decision" },
  INSTRUCTOR_ORIENTATION_MISSING: { workflow: "INSTRUCTORS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Orientation" },
  INSTRUCTOR_READINESS_CHECK_DUE: { workflow: "INSTRUCTORS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Readiness check" },
  INSTRUCTOR_ASSIGNMENT_UNCONFIRMED: { workflow: "INSTRUCTORS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Assignment confirmation" },
  // Curriculum
  CURRICULUM_SUBMISSION_MISSING: { workflow: "CURRICULUM", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Curriculum submission" },
  CURRICULUM_REVIEW_DUE: { workflow: "CURRICULUM", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Curriculum review" },
  CURRICULUM_REVISION_OVERDUE: { workflow: "CURRICULUM", defaultSeverity: "URGENT", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Curriculum revision" },
  CURRICULUM_GLOBAL_REVIEW_READY: { workflow: "CURRICULUM", defaultSeverity: "INFO", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Global review" },
  // Classes
  CLASS_MISSING_INSTRUCTOR: { workflow: "CLASSES", defaultSeverity: "URGENT", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Class instructor" },
  CLASS_MISSING_LOCATION: { workflow: "CLASSES", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Class location" },
  CLASS_MISSING_TIME: { workflow: "CLASSES", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Class time" },
  CLASS_NOT_PUBLIC: { workflow: "CLASSES", defaultSeverity: "URGENT", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Class listing" },
  LAUNCH_DATE_MISSING: { workflow: "CLASSES", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Launch date" },
  PRE_LAUNCH_REMINDER_DUE: { workflow: "CLASSES", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Pre-launch reminder" },
  // Enrollment / advertising
  ENROLLMENT_LOW: { workflow: "ENROLLMENT", defaultSeverity: "URGENT", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Low enrollment" },
  ENROLLMENT_TREND_RISK: { workflow: "ENROLLMENT", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Enrollment trend" },
  ADVERTISING_NOT_STARTED: { workflow: "ENROLLMENT", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Advertising" },
  ADVERTISING_CHANNEL_MISSING: { workflow: "ENROLLMENT", defaultSeverity: "INFO", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Advertising channel" },
  // Attendance / retention
  STUDENT_ABSENCE_STREAK: { workflow: "ATTENDANCE", defaultSeverity: "URGENT", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Absence streak" },
  ATTENDANCE_DROP: { workflow: "ATTENDANCE", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Attendance drop" },
  FEEDBACK_COLLECTION_DUE: { workflow: "STUDENTS", defaultSeverity: "INFO", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Feedback collection" },
  // Live operations
  INSTRUCTOR_WEEKLY_CHECKIN_DUE: { workflow: "INSTRUCTORS", defaultSeverity: "INFO", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Instructor check-in" },
  CLASS_OBSERVATION_DUE: { workflow: "CLASSES", defaultSeverity: "INFO", impactMeetingRelevance: "fyi", canDismiss: true, canSnooze: true, label: "Class observation" },
  // Session 2 / review
  SESSION_2_RETURNING_INSTRUCTOR_RESPONSE_DUE: { workflow: "SESSION_REVIEW", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Returning instructor" },
  SESSION_2_RECRUITING_DUE: { workflow: "SESSION_REVIEW", defaultSeverity: "ATTENTION", impactMeetingRelevance: "fyi", canDismiss: false, canSnooze: true, label: "Session 2 recruiting" },
  SESSION_REVIEW_DUE: { workflow: "SESSION_REVIEW", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Session review" },
  // Impact meetings
  IMPACT_MEETING_PREP_DUE: { workflow: "IMPACT_MEETINGS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Impact meeting prep" },
  IMPACT_MEETING_NUMBERS_MISSING: { workflow: "IMPACT_MEETINGS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "bring", canDismiss: false, canSnooze: true, label: "Impact meeting numbers" },
  // Chapter readiness / playbook
  CHAPTER_BEHIND_PLAYBOOK: { workflow: "CHAPTER_READINESS", defaultSeverity: "ATTENTION", impactMeetingRelevance: "decision", canDismiss: false, canSnooze: false, label: "Playbook pacing" },
};

// ---------------------------------------------------------------------------
// Facts (Layer 1) — the minimal, serializable count-bag every pure generator
// reads. This is intentionally derivable entirely from the EXISTING Chapter
// Operating System read model (`ChapterImpactMetrics` + the pipeline summaries
// + the student-community metrics), so the brain adds NO new DB reads.
// ---------------------------------------------------------------------------

export type ChapterFacts = {
  chapterId: string;
  chapterName: string;
  /** 1-based week of the launch cycle (from `chapterWeekNumber`). */
  weekNumber: number;
  /** ISO baseline the cycle is dated from (launch/first-meeting/created). */
  cycleStartISO: string | null;
  /** ISO target launch date when set. */
  launchTargetISO: string | null;
  lifecycleStatus: string;
  presidentId: string | null;

  // Partners
  partnersTotal: number;
  partnersContacted: number;
  partnersResponded: number;
  partnersMeetingScheduled: number;
  partnersMeetingsCompleted: number;
  partnersConfirmed: number;
  partnerFollowUpsDue: number;
  partnersConfirmedLogisticsIncomplete: number;

  // Instructors
  instructorApplicants: number;
  instructorsUnderReview: number;
  instructorApplicationsAwaitingReview: number;
  interviewsScheduled: number;
  interviewsCompleted: number;
  interviewDecisionsOverdue: number;
  instructorsHired: number;

  // Curriculum
  curriculaSubmitted: number;
  curriculaApproved: number;
  curriculaCpReviewNeeded: number;
  curriculaCpReviewOverdue: number;
  curriculaNeedsRevision: number;

  // Classes
  classesTotal: number;
  classesPublic: number;
  classesLaunched: number;
  classesRunning: number;
  classesReady: number;
  classesUnderEnrolled: number;
  classesLaunchingSoonNotReady: number;

  // Students / enrollment / attendance
  enrollmentTotal: number;
  hasAttendanceData: boolean;
  attendancePercent: number;
  retentionPercent: number;
  retentionBase: number;
  consecutiveAbsentees: number;
  decliningClasses: number;
  feedbackCount: number;

  /** Count of unresolved automation/blocker items (for "behind" detection). */
  unresolvedBlockers: number;
};
