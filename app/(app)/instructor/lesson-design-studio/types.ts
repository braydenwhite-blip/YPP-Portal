import type {
  StudioCourseConfig,
  StudioReviewRubric,
  StudioUnderstandingChecks,
} from "@/lib/curriculum-draft-progress";

export type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

export type EnergyLevel = "HIGH" | "MEDIUM" | "LOW";

export type AtHomeAssignmentType =
  | "REFLECTION_PROMPT"
  | "PRACTICE_TASK"
  | "QUIZ"
  | "PRE_READING";

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
