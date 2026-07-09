/**
 * Monthly self-reflection question copy — the label/hint text shown for each
 * fixed MonthlySelfReflection field. The underlying data model never changes
 * (five sections, fixed columns); only the displayed wording is templated
 * per cycle via ReviewCycle.reflectionQuestionsJson, so a Chief of Staff/
 * admin can retune the prompts for a cycle without touching the form engine.
 */

export type ReflectionQuestionKey =
  | "overallReflection"
  | "engagementOverall"
  | "workingWell"
  | "supportNeeded"
  | "mentorHelpfulness"
  | "collaborationAssessment"
  | "teamMembersAboveAndBeyond"
  | "collaborationImprovements"
  | "goalProgressMade"
  | "goalAccomplishments"
  | "goalBlockers"
  | "goalNextMonthPlans"
  | "additionalReflections";

export type ReflectionQuestionCopy = { label: string; hint: string };

export type ReflectionQuestionSet = Record<ReflectionQuestionKey, ReflectionQuestionCopy>;

/** Partial per-field overrides, as stored in ReviewCycle.reflectionQuestionsJson. */
export type ReflectionQuestionOverrides = Partial<
  Record<ReflectionQuestionKey, Partial<ReflectionQuestionCopy>>
>;

export const REFLECTION_QUESTION_KEYS: ReflectionQuestionKey[] = [
  "overallReflection",
  "engagementOverall",
  "workingWell",
  "supportNeeded",
  "mentorHelpfulness",
  "collaborationAssessment",
  "teamMembersAboveAndBeyond",
  "collaborationImprovements",
  "goalProgressMade",
  "goalAccomplishments",
  "goalBlockers",
  "goalNextMonthPlans",
  "additionalReflections",
];

export const DEFAULT_REFLECTION_QUESTIONS: ReflectionQuestionSet = {
  overallReflection: {
    label: "Overall Reflection",
    hint: "Reflect on this past month overall — what stood out, what you learned, how you've grown.",
  },
  engagementOverall: {
    label: "Overall Engagement & Fulfillment",
    hint: "How engaged and fulfilled have you felt in your YPP role this month overall?",
  },
  workingWell: {
    label: "What's Working Well",
    hint: "What specific aspects of your role have been working especially well?",
  },
  supportNeeded: {
    label: "Support Needed",
    hint: "What support, resources, or changes would help you be more effective?",
  },
  mentorHelpfulness: {
    label: "Mentor Helpfulness",
    hint: "How helpful has your mentor been this month? What could they do more or differently?",
  },
  collaborationAssessment: {
    label: "Team Collaboration Assessment",
    hint: "How has collaboration with your leadership team been this month? Highlight what's worked and any friction.",
  },
  teamMembersAboveAndBeyond: {
    label: "Team Members Above & Beyond (optional)",
    hint: "Optional — shout out any team members who went above and beyond.",
  },
  collaborationImprovements: {
    label: "Collaboration Improvements (optional)",
    hint: "Optional — what could improve about how the team collaborates?",
  },
  goalProgressMade: {
    label: "Progress Made",
    hint: "What concrete progress did you make on this goal this month?",
  },
  goalAccomplishments: {
    label: "Accomplishments",
    hint: "List specific accomplishments, wins, or milestones reached.",
  },
  goalBlockers: {
    label: "Blockers (optional)",
    hint: "Optional — what obstacles or blockers did you encounter?",
  },
  goalNextMonthPlans: {
    label: "Next Month's Plans",
    hint: "What do you plan to focus on for this goal next month?",
  },
  additionalReflections: {
    label: "Additional Reflections (optional)",
    hint: "Optional — anything else you'd like your mentor or program chair to know.",
  },
};

/** Merge a cycle's partial overrides onto the default question copy. Never mutates the defaults. */
export function resolveReflectionQuestions(
  overrides?: ReflectionQuestionOverrides | null
): ReflectionQuestionSet {
  if (!overrides) return DEFAULT_REFLECTION_QUESTIONS;
  const result = { ...DEFAULT_REFLECTION_QUESTIONS };
  for (const key of REFLECTION_QUESTION_KEYS) {
    const override = overrides[key];
    if (!override) continue;
    result[key] = {
      label: override.label?.trim() || result[key].label,
      hint: override.hint?.trim() || result[key].hint,
    };
  }
  return result;
}
