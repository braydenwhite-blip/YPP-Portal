import {
  MIN_CURRICULUM_OUTCOMES,
  getCurriculumDraftProgress,
  type CurriculumDraftProgress,
} from "@/lib/curriculum-draft-progress";

export type StudioPhase =
  | "START"
  | "COURSE_MAP"
  | "SESSIONS"
  | "READINESS"
  | "REVIEW_LAUNCH";

export type StudioEntryContext =
  | "DIRECT"
  | "NAV"
  | "TRAINING"
  | "APPLICATION_STATUS"
  | "REVIEW";

export type GuidedStudioStepStatus = "complete" | "current" | "upcoming";

export interface GuidedStudioStepMeta {
  id: StudioPhase;
  label: string;
  shortLabel: string;
  headline: string;
  description: string;
  whyItMatters: string;
}

export interface GuidedStudioStep extends GuidedStudioStepMeta {
  status: GuidedStudioStepStatus;
  blockers: string[];
  recommendedAction: string;
}

export interface GuidedStudioJourney {
  activePhase: StudioPhase;
  steps: GuidedStudioStep[];
  blockers: string[];
  blockerCount: number;
  recommendedAction: string;
}

export const STUDIO_PHASES: Array<{
  id: StudioPhase;
  label: string;
  shortLabel: string;
}> = [
  { id: "START", label: "Start", shortLabel: "Start" },
  { id: "COURSE_MAP", label: "Course Map", shortLabel: "Map" },
  { id: "SESSIONS", label: "Sessions", shortLabel: "Plan" },
  { id: "READINESS", label: "Readiness", shortLabel: "Checks" },
  { id: "REVIEW_LAUNCH", label: "Review & Launch", shortLabel: "Submit" },
];

const GUIDED_PHASE_META: Record<StudioPhase, GuidedStudioStepMeta> = {
  START: {
    id: "START",
    label: "Start",
    shortLabel: "Start",
    headline: "Start with support, not a blank wall",
    description:
      "Choose the kind of help you want so the studio can give you momentum right away.",
    whyItMatters:
      "The first move should lower pressure. A strong starter draft helps new instructors begin with structure and confidence.",
  },
  COURSE_MAP: {
    id: "COURSE_MAP",
    label: "Course Map",
    shortLabel: "Map",
    headline: "Give the course a clear promise",
    description:
      "Name what this course is, who it serves, and what students should be able to do by the end.",
    whyItMatters:
      "A clear course promise keeps every later session from feeling random or disconnected.",
  },
  SESSIONS: {
    id: "SESSIONS",
    label: "Sessions",
    shortLabel: "Plan",
    headline: "Build one teachable session at a time",
    description:
      "Focus on the next session, keep the whole roadmap visible, and make each lesson arc feel realistic.",
    whyItMatters:
      "Students experience the curriculum session by session. Strong pacing, purpose, and homework turn a concept into something teachable.",
  },
  READINESS: {
    id: "READINESS",
    label: "Readiness",
    shortLabel: "Checks",
    headline: "Tighten the teaching moves before launch",
    description:
      "Clear the last blockers, answer the teaching checks, and make sure the draft feels ready for a real classroom.",
    whyItMatters:
      "Readiness is where a decent draft becomes something another instructor could actually run with confidence.",
  },
  REVIEW_LAUNCH: {
    id: "REVIEW_LAUNCH",
    label: "Review & Launch",
    shortLabel: "Submit",
    headline: "Review, submit, and move toward launch",
    description:
      "Use this final hub to understand feedback, submit with confidence, and carry the curriculum into the next real step.",
    whyItMatters:
      "The goal is not just a finished document. The goal is a curriculum that can survive review and move toward real teaching.",
  },
};

type SearchParamValue = string | string[] | undefined;
type SearchParamsRecord = Record<string, SearchParamValue>;

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeStudioEntryContext(value: unknown): StudioEntryContext {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "nav":
      return "NAV";
    case "training":
      return "TRAINING";
    case "application-status":
    case "application_status":
    case "application":
      return "APPLICATION_STATUS";
    case "review":
      return "REVIEW";
    default:
      return "DIRECT";
  }
}

export function serializeStudioEntryContext(value: StudioEntryContext) {
  switch (value) {
    case "NAV":
      return "nav";
    case "TRAINING":
      return "training";
    case "APPLICATION_STATUS":
      return "application-status";
    case "REVIEW":
      return "review";
    default:
      return "direct";
  }
}

export function getStudioEntryContextFromSearchParams(
  searchParams: SearchParamsRecord
) {
  return normalizeStudioEntryContext(firstValue(searchParams.entry));
}

export function getStudioDraftIdFromSearchParams(
  searchParams: SearchParamsRecord
) {
  const draftId = firstValue(searchParams.draftId);
  return typeof draftId === "string" && draftId.trim().length > 0
    ? draftId.trim()
    : null;
}

/** URL segment for each studio phase (path-based editor pages). */
export const STUDIO_STEP_SLUGS = [
  "setup",
  "plan",
  "sessions",
  "checks",
  "submit",
] as const;

export type StudioStepSlug = (typeof STUDIO_STEP_SLUGS)[number];

const PHASE_TO_SLUG: Record<StudioPhase, StudioStepSlug> = {
  START: "setup",
  COURSE_MAP: "plan",
  SESSIONS: "sessions",
  READINESS: "checks",
  REVIEW_LAUNCH: "submit",
};

const SLUG_TO_PHASE: Record<StudioStepSlug, StudioPhase> = {
  setup: "START",
  plan: "COURSE_MAP",
  sessions: "SESSIONS",
  checks: "READINESS",
  submit: "REVIEW_LAUNCH",
};

export function studioPhaseToStepSlug(phase: StudioPhase): StudioStepSlug {
  return PHASE_TO_SLUG[phase];
}

export function studioStepSlugToPhase(slug: string): StudioPhase | null {
  if (slug in SLUG_TO_PHASE) {
    return SLUG_TO_PHASE[slug as StudioStepSlug];
  }
  return null;
}

export function buildLessonDesignStudioHref(args?: {
  entryContext?: StudioEntryContext;
  draftId?: string | null;
  notice?: string | null;
  /** When opening a draft, which editor page (defaults to Start / setup). */
  phase?: StudioPhase | null;
}) {
  const next = new URLSearchParams();

  if (args?.entryContext && args.entryContext !== "DIRECT") {
    next.set("entry", serializeStudioEntryContext(args.entryContext));
  }

  if (args?.notice) {
    next.set("notice", args.notice);
  }

  const query = next.toString();

  if (args?.draftId) {
    const slug = studioPhaseToStepSlug(args.phase ?? "START");
    const path = `/instructor/lesson-design-studio/${args.draftId}/${slug}`;
    return query ? `${path}?${query}` : path;
  }

  return query
    ? `/instructor/lesson-design-studio?${query}`
    : "/instructor/lesson-design-studio";
}

export function getCanonicalStudioHref(searchParams: SearchParamsRecord) {
  const entryContext = getStudioEntryContextFromSearchParams(searchParams);
  const draftId = getStudioDraftIdFromSearchParams(searchParams);
  const notice = firstValue(searchParams.notice);
  const hasLegacyTemplateId = Boolean(firstValue(searchParams.templateId));
  const hasEntryParam = typeof firstValue(searchParams.entry) === "string";

  if (!hasLegacyTemplateId && (!hasEntryParam || entryContext === "DIRECT")) {
    return null;
  }

  return buildLessonDesignStudioHref({
    entryContext,
    draftId,
    notice: typeof notice === "string" ? notice : null,
  });
}

function hasStartedStudioWork(input: {
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  progress: CurriculumDraftProgress;
}) {
  const nonEmptyOutcomes = Array.isArray(input.outcomes)
    ? input.outcomes.filter((outcome) => outcome.trim().length > 0)
    : [];

  return (
    (input.title ?? "").trim().length > 0 ||
    (input.interestArea ?? "").trim().length > 0 ||
    nonEmptyOutcomes.length > 0 ||
    input.progress.sessionsWithTitles > 0 ||
    input.progress.sessionsWithObjectives > 0 ||
    input.progress.sessionsWithThreeActivities > 0 ||
    input.progress.sessionsWithAtHomeAssignments > 0
  );
}

export function deriveStudioPhase(input: {
  status?: string | null;
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  weeklyPlans?: unknown;
  courseConfig?: unknown;
  understandingChecks?: unknown;
  progress?: CurriculumDraftProgress;
}): StudioPhase {
  const progress =
    input.progress ??
    getCurriculumDraftProgress({
      title: input.title,
      interestArea: input.interestArea,
      outcomes: input.outcomes,
      weeklyPlans: input.weeklyPlans,
      courseConfig: input.courseConfig,
      understandingChecks: input.understandingChecks,
    });

  const status = String(input.status ?? "").trim().toUpperCase();
  const nonEmptyOutcomes = Array.isArray(input.outcomes)
    ? input.outcomes.filter((outcome) => typeof outcome === 'string' && outcome.trim().length > 0)
    : [];
  const hasStartedDraft = hasStartedStudioWork({
    title: input.title,
    interestArea: input.interestArea,
    outcomes: input.outcomes,
    progress,
  });

  const hasCourseMapReady =
    (input.title ?? "").trim().length > 0 &&
    (input.interestArea ?? "").trim().length > 0 &&
    nonEmptyOutcomes.length >= MIN_CURRICULUM_OUTCOMES;

  const sessionBuildComplete =
    progress.sessionsWithTitles === progress.totalSessionsExpected &&
    progress.sessionsWithObjectives === progress.totalSessionsExpected &&
    progress.sessionsWithThreeActivities === progress.totalSessionsExpected &&
    progress.sessionsWithAtHomeAssignments === progress.totalSessionsExpected &&
    progress.sessionsWithinTimeBudget === progress.totalSessionsExpected;

  if (
    status === "COMPLETED" ||
    status === "SUBMITTED" ||
    status === "NEEDS_REVISION" ||
    status === "APPROVED" ||
    status === "REJECTED"
  ) {
    return "REVIEW_LAUNCH";
  }

  if (!hasStartedDraft) {
    return "START";
  }

  if (!hasCourseMapReady) {
    return "COURSE_MAP";
  }

  if (!sessionBuildComplete) {
    return "SESSIONS";
  }

  if (!progress.readyForSubmission) {
    return "READINESS";
  }

  return "REVIEW_LAUNCH";
}

export function getStudioPhaseIndex(phase: StudioPhase) {
  return STUDIO_PHASES.findIndex((step) => step.id === phase);
}

export function getStudioPhaseMeta(phase: StudioPhase): GuidedStudioStepMeta {
  return GUIDED_PHASE_META[phase];
}

function buildStartBlockers(input: {
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  progress: CurriculumDraftProgress;
}) {
  return hasStartedStudioWork(input)
    ? []
    : ["Choose the level of starter support you want before you begin writing."];
}

function buildCourseMapBlockers(input: {
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  progress: CurriculumDraftProgress;
}) {
  const blockers: string[] = [];
  const nonEmptyOutcomes = Array.isArray(input.outcomes)
    ? input.outcomes.filter((outcome) => typeof outcome === 'string' && outcome.trim().length > 0)
    : [];

  if ((input.title ?? "").trim().length === 0) {
    blockers.push("Name the curriculum so the course promise feels real.");
  }

  if ((input.interestArea ?? "").trim().length === 0) {
    blockers.push("Choose the interest area so examples and coaching can stay relevant.");
  }

  if (nonEmptyOutcomes.length < MIN_CURRICULUM_OUTCOMES) {
    blockers.push(
      `Write ${MIN_CURRICULUM_OUTCOMES - nonEmptyOutcomes.length} more learning outcome${MIN_CURRICULUM_OUTCOMES - nonEmptyOutcomes.length === 1 ? "" : "s"} so the course has a clear finish line.`
    );
  }

  return blockers;
}

function buildSessionBlockers(progress: CurriculumDraftProgress) {
  const blockers: string[] = [];
  const sessionsLeftForTitles =
    progress.totalSessionsExpected - progress.sessionsWithTitles;
  const sessionsLeftForObjectives =
    progress.totalSessionsExpected - progress.sessionsWithObjectives;
  const sessionsLeftForActivities =
    progress.totalSessionsExpected - progress.sessionsWithThreeActivities;
  const sessionsLeftForHomework =
    progress.totalSessionsExpected - progress.sessionsWithAtHomeAssignments;
  const sessionsLeftForBudget =
    progress.totalSessionsExpected - progress.sessionsWithinTimeBudget;

  if (sessionsLeftForTitles > 0) {
    blockers.push(
      `Give ${sessionsLeftForTitles} more session${sessionsLeftForTitles === 1 ? "" : "s"} a clear title.`
    );
  }

  if (sessionsLeftForObjectives > 0) {
    blockers.push(
      `Write ${sessionsLeftForObjectives} more session objective${sessionsLeftForObjectives === 1 ? "" : "s"} so each lesson has a clear point.`
    );
  }

  if (sessionsLeftForActivities > 0) {
    blockers.push(
      `Add stronger activity arcs to ${sessionsLeftForActivities} more session${sessionsLeftForActivities === 1 ? "" : "s"}.`
    );
  }

  if (sessionsLeftForHomework > 0) {
    blockers.push(
      `Add at-home work to ${sessionsLeftForHomework} more session${sessionsLeftForHomework === 1 ? "" : "s"} so the learning keeps going after class.`
    );
  }

  if (sessionsLeftForBudget > 0) {
    blockers.push(
      `Rebalance pacing in ${sessionsLeftForBudget} more session${sessionsLeftForBudget === 1 ? "" : "s"} so everything fits the real class time.`
    );
  }

  return blockers;
}

function buildReadinessBlockers(progress: CurriculumDraftProgress) {
  return progress.submissionIssues.filter((issue) => issue.trim().length > 0);
}

function buildReviewBlockers(input: {
  status?: string | null;
  reviewNotes?: string | null;
  reviewRubric?: {
    sectionNotes?: {
      overview?: string;
      courseStructure?: string;
      sessionPlans?: string;
      studentAssignments?: string;
    };
    summary?: string;
  } | null;
}) {
  const status = String(input.status ?? "").trim().toUpperCase();
  if (status !== "NEEDS_REVISION" && status !== "REJECTED") {
    return [];
  }

  const blockers = [
    input.reviewRubric?.summary,
    input.reviewRubric?.sectionNotes?.overview,
    input.reviewRubric?.sectionNotes?.courseStructure,
    input.reviewRubric?.sectionNotes?.sessionPlans,
    input.reviewRubric?.sectionNotes?.studentAssignments,
    input.reviewNotes,
  ]
    .filter((note): note is string => typeof note === "string" && note.trim().length > 0)
    .map((note) => note.trim());

  return blockers.length > 0
    ? blockers
    : ["A reviewer asked for revision. Walk through the flagged parts of the curriculum and tighten them before resubmitting."];
}

function getRecommendedActionForPhase(args: {
  phase: StudioPhase;
  status?: string | null;
  blockers: string[];
  progress: CurriculumDraftProgress;
}) {
  const status = String(args.status ?? "").trim().toUpperCase();

  switch (args.phase) {
    case "START":
      return args.blockers.length === 0
        ? "Move into the course map"
        : "Pick a starter scaffold";
    case "COURSE_MAP":
      return args.blockers.length === 0
        ? "Move into session building"
        : "Tighten the course promise";
    case "SESSIONS":
      return args.progress.fullyBuiltSessions === 0
        ? "Build the first session"
        : "Keep building the next session";
    case "READINESS":
      return args.progress.understandingChecksPassed
        ? "Open the launch hub"
        : "Clear the teaching checks";
    case "REVIEW_LAUNCH":
      if (status === "APPROVED") return "Move toward launch";
      if (status === "SUBMITTED") return "Review the submitted package";
      if (status === "NEEDS_REVISION" || status === "REJECTED") {
        return "Follow the revision path";
      }
      return args.progress.readyForSubmission
        ? "Submit curriculum for review"
        : "Finish the remaining blockers";
    default:
      return "Keep building";
  }
}

function getBlockersForPhase(args: {
  phase: StudioPhase;
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  progress: CurriculumDraftProgress;
  status?: string | null;
  reviewNotes?: string | null;
  reviewRubric?: {
    sectionNotes?: {
      overview?: string;
      courseStructure?: string;
      sessionPlans?: string;
      studentAssignments?: string;
    };
    summary?: string;
  } | null;
}) {
  switch (args.phase) {
    case "START":
      return buildStartBlockers(args);
    case "COURSE_MAP":
      return buildCourseMapBlockers(args);
    case "SESSIONS":
      return buildSessionBlockers(args.progress);
    case "READINESS":
      return buildReadinessBlockers(args.progress);
    case "REVIEW_LAUNCH":
      return buildReviewBlockers(args);
    default:
      return [];
  }
}

export function buildGuidedStudioJourney(input: {
  activePhase?: StudioPhase;
  status?: string | null;
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  weeklyPlans?: unknown;
  courseConfig?: unknown;
  understandingChecks?: unknown;
  progress?: CurriculumDraftProgress;
  reviewNotes?: string | null;
  reviewRubric?: {
    sectionNotes?: {
      overview?: string;
      courseStructure?: string;
      sessionPlans?: string;
      studentAssignments?: string;
    };
    summary?: string;
  } | null;
}): GuidedStudioJourney {
  const progress =
    input.progress ??
    getCurriculumDraftProgress({
      title: input.title,
      interestArea: input.interestArea,
      outcomes: input.outcomes,
      weeklyPlans: input.weeklyPlans,
      courseConfig: input.courseConfig,
      understandingChecks: input.understandingChecks,
    });
  const derivedPhase = deriveStudioPhase({
    status: input.status,
    title: input.title,
    interestArea: input.interestArea,
    outcomes: input.outcomes,
    weeklyPlans: input.weeklyPlans,
    courseConfig: input.courseConfig,
    understandingChecks: input.understandingChecks,
    progress,
  });
  const activePhase = input.activePhase ?? derivedPhase;

  const steps = STUDIO_PHASES.map((phase) => {
    const meta = getStudioPhaseMeta(phase.id);
    const blockers = getBlockersForPhase({
      phase: phase.id,
      title: input.title,
      interestArea: input.interestArea,
      outcomes: input.outcomes,
      progress,
      status: input.status,
      reviewNotes: input.reviewNotes,
      reviewRubric: input.reviewRubric,
    });
    const phaseIndex = getStudioPhaseIndex(phase.id);
    const completionIndex = getStudioPhaseIndex(derivedPhase);
    const status: GuidedStudioStepStatus =
      phase.id === activePhase
        ? "current"
        : phaseIndex < completionIndex
          ? "complete"
          : "upcoming";

    return {
      ...meta,
      status,
      blockers,
      recommendedAction: getRecommendedActionForPhase({
        phase: phase.id,
        status: input.status,
        blockers,
        progress,
      }),
    };
  });

  const activeStep = steps.find((step) => step.id === activePhase) ?? steps[0];

  return {
    activePhase,
    steps,
    blockers: activeStep.blockers,
    blockerCount: activeStep.blockers.length,
    recommendedAction: activeStep.recommendedAction,
  };
}
