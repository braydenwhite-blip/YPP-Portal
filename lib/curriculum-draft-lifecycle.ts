import {
  DEFAULT_COURSE_CONFIG,
  buildUnderstandingChecksState,
  emptyReviewRubric,
  getCurriculumDraftProgress,
  normalizeCourseConfig,
  normalizeUnderstandingChecks,
  syncSessionPlansToCourseConfig,
} from "@/lib/curriculum-draft-progress";

export const EDITABLE_CURRICULUM_DRAFT_STATUSES = [
  "IN_PROGRESS",
  "COMPLETED",
  "NEEDS_REVISION",
] as const;

export const READ_ONLY_CURRICULUM_DRAFT_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

type DraftStatusValue = string | null | undefined;

type DraftOrderable = {
  status?: DraftStatusValue;
  updatedAt?: Date | string | null;
};

export type CurriculumDraftSummaryRecord = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  generatedTemplateId: string | null;
  isEditable: boolean;
  isPrimaryEditable: boolean;
};

function normalizeStatus(status: DraftStatusValue) {
  return String(status ?? "").trim().toUpperCase();
}

function getUpdatedAtValue(value: Date | string | null | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function isEditableCurriculumDraftStatus(status: DraftStatusValue) {
  return EDITABLE_CURRICULUM_DRAFT_STATUSES.includes(
    normalizeStatus(status) as (typeof EDITABLE_CURRICULUM_DRAFT_STATUSES)[number]
  );
}

export function isReadOnlyCurriculumDraftStatus(status: DraftStatusValue) {
  return READ_ONLY_CURRICULUM_DRAFT_STATUSES.includes(
    normalizeStatus(status) as (typeof READ_ONLY_CURRICULUM_DRAFT_STATUSES)[number]
  );
}

export function pickPrimaryEditableCurriculumDraft<T extends DraftOrderable>(
  drafts: T[]
) {
  return drafts
    .filter((draft) => isEditableCurriculumDraftStatus(draft.status))
    .sort((left, right) => {
      return getUpdatedAtValue(right.updatedAt) - getUpdatedAtValue(left.updatedAt);
    })[0] ?? null;
}

export function sortCurriculumDraftsForChooser<T extends DraftOrderable & { id: string }>(
  drafts: T[]
) {
  const primaryEditableDraft = pickPrimaryEditableCurriculumDraft(drafts);

  return [...drafts].sort((left, right) => {
    const leftIsPrimary = primaryEditableDraft?.id === left.id;
    const rightIsPrimary = primaryEditableDraft?.id === right.id;

    if (leftIsPrimary !== rightIsPrimary) {
      return leftIsPrimary ? -1 : 1;
    }

    return getUpdatedAtValue(right.updatedAt) - getUpdatedAtValue(left.updatedAt);
  });
}

export function deriveEditableCurriculumDraftStatus(input: {
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  courseConfig?: unknown;
  weeklyPlans?: unknown;
  understandingChecks?: unknown;
}) {
  return getCurriculumDraftProgress(input).readyForSubmission
    ? "COMPLETED"
    : "IN_PROGRESS";
}

export function buildBlankCurriculumDraftRecord() {
  return {
    title: "",
    description: null as string | null,
    interestArea: "",
    outcomes: [] as string[],
    courseConfig: DEFAULT_COURSE_CONFIG,
    weeklyPlans: [] as unknown[],
    understandingChecks: buildUnderstandingChecksState({}),
    reviewRubric: emptyReviewRubric(),
    reviewNotes: null as string | null,
    reviewedAt: null as Date | null,
    submittedAt: null as Date | null,
    approvedAt: null as Date | null,
    generatedTemplateId: null as string | null,
    status: "IN_PROGRESS",
    completedAt: null as Date | null,
  };
}

export function buildWorkingCopyCurriculumDraftRecord(source: {
  title: string;
  description: string | null;
  interestArea: string;
  outcomes: string[];
  courseConfig: unknown;
  weeklyPlans: unknown;
  understandingChecks: unknown;
}) {
  const normalizedCourseConfig = normalizeCourseConfig(source.courseConfig);
  const normalizedUnderstandingChecks = normalizeUnderstandingChecks(
    source.understandingChecks
  );
  const weeklyPlans = syncSessionPlansToCourseConfig(
    source.weeklyPlans,
    normalizedCourseConfig
  );
  const status = deriveEditableCurriculumDraftStatus({
    title: source.title,
    interestArea: source.interestArea,
    outcomes: source.outcomes,
    courseConfig: normalizedCourseConfig,
    weeklyPlans,
    understandingChecks: normalizedUnderstandingChecks,
  });

  return {
    title: source.title,
    description: source.description,
    interestArea: source.interestArea,
    outcomes: source.outcomes,
    courseConfig: normalizedCourseConfig,
    weeklyPlans,
    understandingChecks: normalizedUnderstandingChecks,
    reviewRubric: emptyReviewRubric(),
    reviewNotes: null as string | null,
    reviewedAt: null as Date | null,
    submittedAt: null as Date | null,
    approvedAt: null as Date | null,
    generatedTemplateId: null as string | null,
    status,
    completedAt: status === "COMPLETED" ? new Date() : null,
  };
}
