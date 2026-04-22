export const INSTRUCTOR_REVIEW_CATEGORIES = [
  {
    key: "CURRICULUM_STRENGTH",
    label: "Curriculum & Class Strength",
    description:
      "Quality of the class idea, structure, clarity, feasibility, and ability to teach the content well.",
  },
  {
    key: "RELATIONSHIP_BUILDING",
    label: "Relationships With Parents & Students",
    description:
      "Personability, communication, maturity, warmth, and ability to build trust.",
  },
  {
    key: "ORGANIZATION_AND_COMMITMENT",
    label: "Organization & Commitment",
    description:
      "Reliability, responsiveness, time management, and seriousness of commitment.",
  },
  {
    key: "COMMUNITY_FIT",
    label: "YPP Community Fit",
    description:
      "Collaboration, chapter-mindedness, and willingness to contribute beyond teaching one class.",
  },
  {
    key: "LONG_TERM_POTENTIAL",
    label: "Long-Term Potential",
    description:
      "Growth potential, leadership upside, and willingness to deepen involvement over time.",
  },
  {
    key: "PROFESSIONALISM_AND_FOLLOW_THROUGH",
    label: "Interview Readiness & Professionalism",
    description:
      "Follow-through, preparation habits, and whether the candidate operates like someone others can count on.",
  },
  {
    key: "SUBJECT_MATTER_FIT",
    label: "Subject Matter Fit",
    description:
      "Depth and currency of knowledge in the subjects they plan to teach, and ability to make the content accessible.",
  },
] as const;

export type InstructorReviewCategoryValue =
  (typeof INSTRUCTOR_REVIEW_CATEGORIES)[number]["key"];

export const INSTRUCTOR_INITIAL_REVIEW_SIGNALS = [
  {
    key: "CURRICULUM_STRENGTH",
    label: "Rough Class Idea",
    description:
      "The class idea, rough outline, and first-session sketch are clear enough to discuss in an interview.",
  },
  {
    key: "RELATIONSHIP_BUILDING",
    label: "Teaching & Communication Promise",
    description:
      "The applicant shows enough teaching clarity, maturity, and communication promise for a live conversation.",
  },
  {
    key: "ORGANIZATION_AND_COMMITMENT",
    label: "Reliability & Fit",
    description:
      "The application suggests the applicant can follow through and fit the YPP instructor role.",
  },
] as const satisfies ReadonlyArray<{
  key: InstructorReviewCategoryValue;
  label: string;
  description: string;
}>;

export const PROGRESS_RATING_OPTIONS = [
  {
    value: "BEHIND_SCHEDULE",
    label: "Red",
    shortLabel: "Red",
    helperLabel: "Not ready",
    description: "Serious concern or clearly not ready for this expectation.",
    color: "#dc2626",
    bg: "#fef2f2",
  },
  {
    value: "GETTING_STARTED",
    label: "Yellow",
    shortLabel: "Yellow",
    helperLabel: "Borderline",
    description: "Some promise is there, but concerns or gaps still need work.",
    color: "#d97706",
    bg: "#fffbeb",
  },
  {
    value: "ON_TRACK",
    label: "Green",
    shortLabel: "Green",
    helperLabel: "Ready",
    description: "Solid, ready, and trustworthy for the expectation being reviewed.",
    color: "#16a34a",
    bg: "#f0fdf4",
  },
  {
    value: "ABOVE_AND_BEYOND",
    label: "Purple",
    shortLabel: "Purple",
    helperLabel: "Exceptional",
    description: "Exceptionally strong signal that stands out beyond the normal bar.",
    color: "#7c3aed",
    bg: "#faf5ff",
  },
] as const;

export type ProgressRatingValue = (typeof PROGRESS_RATING_OPTIONS)[number]["value"];

export const INITIAL_REVIEW_RATING_OPTIONS = PROGRESS_RATING_OPTIONS.filter(
  (option) => option.value !== "ABOVE_AND_BEYOND"
);

export const INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS = [
  {
    value: "MOVE_TO_INTERVIEW",
    label: "Move to Interview",
    description: "Advance the applicant into the interview workflow.",
  },
  {
    value: "REQUEST_INFO",
    label: "Request More Info",
    description: "Pause the review and ask the applicant for specific follow-up information.",
  },
  {
    value: "HOLD",
    label: "Hold",
    description: "Keep the application open but do not advance it yet.",
  },
  {
    value: "REJECT",
    label: "Reject",
    description: "Close the application as not moving forward.",
  },
] as const;

export type InstructorApplicationNextStepValue =
  (typeof INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS)[number]["value"];

export const INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS = [
  {
    value: "ACCEPT",
    label: "Accept",
    description: "Recommend approval now.",
  },
  {
    value: "ACCEPT_WITH_SUPPORT",
    label: "Accept with Support",
    description: "Recommend approval with structured support during onboarding.",
  },
  {
    value: "HOLD",
    label: "Hold",
    description: "Keep the candidate open for further discussion or follow-up.",
  },
  {
    value: "REJECT",
    label: "Reject",
    description: "Recommend closing the application.",
  },
] as const;

export type InstructorInterviewRecommendationValue =
  (typeof INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS)[number]["value"];
