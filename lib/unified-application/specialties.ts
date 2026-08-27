/**
 * Phase 2 specialty prompts — applicant picks 0–4 after passing Phase 1 review.
 * Configure matching fields in Admin → Form templates (INSTRUCTOR role, phase 2).
 */

export type UnifiedSpecialtyPrompt = {
  id: string;
  label: string;
  description: string;
  /** Suggested ApplicationFormField label prefix for admin template builder. */
  templateLabel: string;
};

/** Required for every applicant in Phase 2. */
export const PHASE_2_UNIVERSAL_PROMPT = {
  id: "universal_why_ypp",
  label: "Why YPP",
  description: "One prompt everyone answers after Phase 1 approval.",
  templateLabel: "[Required] Why do you want to join YPP?",
  required: true,
} as const;

/** Applicant may complete any subset (0–4). */
export const PHASE_2_SPECIALTY_PROMPTS: UnifiedSpecialtyPrompt[] = [
  {
    id: "teaching_curriculum",
    label: "Teaching & curriculum",
    description: "Course ideas, subject expertise, and classroom readiness.",
    templateLabel: "[Specialty: Teaching] Course vision and teaching experience",
  },
  {
    id: "chapter_leadership",
    label: "Chapter leadership",
    description: "Leading a chapter, vision, recruitment, and partnerships.",
    templateLabel: "[Specialty: Leadership] Chapter president vision and experience",
  },
  {
    id: "partnerships_outreach",
    label: "Partnerships & outreach",
    description: "Community partners, marketing, and growth.",
    templateLabel: "[Specialty: Partnerships] Partnerships and outreach experience",
  },
  {
    id: "operations_technology",
    label: "Operations & technology",
    description: "Systems, tooling, and behind-the-scenes contribution.",
    templateLabel: "[Specialty: Operations] Operations and technology contribution",
  },
];

export const PHASE_2_SPECIALTY_MIN = 0;
export const PHASE_2_SPECIALTY_MAX = 4;

export function specialtyById(id: string): UnifiedSpecialtyPrompt | undefined {
  return PHASE_2_SPECIALTY_PROMPTS.find((s) => s.id === id);
}
