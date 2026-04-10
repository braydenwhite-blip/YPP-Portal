import type {
  StudioCourseConfig,
  StudioReviewRubric,
  StudioUnderstandingChecks,
} from "@/lib/curriculum-draft-progress";

export const LESSON_STUDIO_ACTIVITY_TYPES = [
  "WARM_UP",
  "INSTRUCTION",
  "PRACTICE",
  "DISCUSSION",
  "ASSESSMENT",
  "BREAK",
  "REFLECTION",
  "GROUP_WORK",
] as const;

export type ActivityType = (typeof LESSON_STUDIO_ACTIVITY_TYPES)[number];

export type EnergyLevel = "HIGH" | "MEDIUM" | "LOW";

export const LESSON_STUDIO_AT_HOME_ASSIGNMENT_TYPES = [
  "REFLECTION_PROMPT",
  "PRACTICE_TASK",
  "QUIZ",
  "PRE_READING",
] as const;

export type AtHomeAssignmentType =
  (typeof LESSON_STUDIO_AT_HOME_ASSIGNMENT_TYPES)[number];

export function isActivityType(value: unknown): value is ActivityType {
  return LESSON_STUDIO_ACTIVITY_TYPES.includes(
    String(value ?? "").trim().toUpperCase() as ActivityType
  );
}

export function normalizeActivityType(value: unknown): ActivityType {
  return isActivityType(value)
    ? (String(value).trim().toUpperCase() as ActivityType)
    : "WARM_UP";
}

export function isAtHomeAssignmentType(
  value: unknown
): value is AtHomeAssignmentType {
  return LESSON_STUDIO_AT_HOME_ASSIGNMENT_TYPES.includes(
    String(value ?? "").trim().toUpperCase() as AtHomeAssignmentType
  );
}

export function normalizeAtHomeAssignmentType(
  value: unknown
): AtHomeAssignmentType {
  return isAtHomeAssignmentType(value)
    ? (String(value).trim().toUpperCase() as AtHomeAssignmentType)
    : "REFLECTION_PROMPT";
}

export interface AtHomeAssignment {
  type: AtHomeAssignmentType;
  title: string;
  description: string;
}

export interface WeekActivity {
  id: string;
  title: string;
  type: ActivityType;
  durationMin: number;
  // Stored as plain text for legacy content or a stringified Tiptap JSON document for rich content.
  description: string | null;
  resources: string | null;
  notes: string | null;
  sortOrder: number;
  materials: string | null;
  differentiationTips: string | null;
  energyLevel: EnergyLevel | null;
  standardsTags: string[];
  rubric: string | null;
}

export interface WeekPlan {
  id: string;
  weekNumber: number;
  sessionNumber: number;
  title: string;
  classDurationMin: number;
  activities: WeekActivity[];
  objective: string | null;
  teacherPrepNotes: string | null;
  materialsChecklist: string[];
  atHomeAssignment: AtHomeAssignment | null;
}

export interface LessonDesignDraftData {
  id: string;
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  courseConfig: unknown;
  weeklyPlans: unknown[];
  understandingChecks: unknown;
  reviewRubric: unknown;
  reviewNotes: string;
  reviewedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  generatedTemplateId: string | null;
  status: string;
  updatedAt: string;
}

export interface LessonDesignSnapshot {
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  courseConfig: StudioCourseConfig;
  weeklyPlans: WeekPlan[];
  understandingChecks: StudioUnderstandingChecks;
}

export interface LessonDesignHistoryVersion {
  savedAt: string;
  snapshot: LessonDesignSnapshot;
}

export type {
  StudioCourseConfig,
  StudioReviewRubric,
  StudioUnderstandingChecks,
};
