/**
 * Reusable condition presets for APPROVE_WITH_CONDITIONS.
 * The vast majority of chair-imposed conditions come from this vocabulary; the
 * editor exposes a custom field for the rare exception.
 *
 * NOTE: APPROVE_WITH_CONDITIONS is a Phase 2D follow-up that requires extending
 * the `ChairDecisionAction` enum in `prisma/schema.prisma`. Until that lands,
 * the editor is exposed but the action is gated behind the schema change. The
 * preset list is shipped in Phase 2C so product can review the vocabulary in
 * advance.
 */

export interface ConditionPreset {
  id: string;
  label: string;
  defaultOwner: "CHAIR" | "CHAPTER_LEAD" | "INSTRUCTOR" | null;
  defaultDueOffsetDays: number | null;
}

export const CONDITION_PRESETS: ConditionPreset[] = [
  {
    id: "mentorship-pair-up",
    label: "Mentorship pair-up for first semester",
    defaultOwner: "CHAPTER_LEAD",
    defaultDueOffsetDays: 14,
  },
  {
    id: "mid-semester-check-in",
    label: "Mid-semester instructor check-in with chair",
    defaultOwner: "CHAIR",
    defaultDueOffsetDays: 60,
  },
  {
    id: "teaching-shadow",
    label: "Teaching shadow with an experienced instructor before first class",
    defaultOwner: "CHAPTER_LEAD",
    defaultDueOffsetDays: 21,
  },
  {
    id: "async-onboarding-module",
    label: "Complete asynchronous onboarding module 1 before class start",
    defaultOwner: "INSTRUCTOR",
    defaultDueOffsetDays: 21,
  },
  {
    id: "signed-agreement",
    label: "Submit signed agreement form by due date",
    defaultOwner: "INSTRUCTOR",
    defaultDueOffsetDays: 7,
  },
  {
    id: "chapter-president-1on1",
    label: "Attend chapter president 1:1 within first 2 weeks",
    defaultOwner: "CHAPTER_LEAD",
    defaultDueOffsetDays: 14,
  },
  {
    id: "first-class-observation",
    label: "First-class observation by chapter lead",
    defaultOwner: "CHAPTER_LEAD",
    defaultDueOffsetDays: 35,
  },
];
