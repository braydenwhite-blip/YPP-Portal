export const INSTRUCTOR_REVIEW_CATEGORIES = [
  {
    key: "CURRICULUM_STRENGTH",
    label: "Teaching/Instruction",
    description:
      "Course idea shows promise and applicant shows promise to teach it.",
  },
  {
    key: "RELATIONSHIP_BUILDING",
    label: "Relationships/Personability",
    description:
      "Applicant shows promise to build strong relationships with parents and students.",
  },
  {
    key: "ORGANIZATION_AND_COMMITMENT",
    label: "Organization/Commitment",
    description:
      "Application shows applicant is organized and will make necessary commitment.",
  },
  {
    key: "COMMUNITY_FIT",
    label: "Connection to YPP Community",
    description:
      "Applicant shows signs of connecting to and strengthening the YPP community.",
  },
  {
    key: "LONG_TERM_POTENTIAL",
    label: "Long-Term Potential",
    description:
      "Application suggests applicant has long-term leadership potential within YPP.",
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
    label: "Teaching/Instruction",
    description:
      "Course idea shows promise and applicant shows promise to teach it.",
  },
  {
    key: "RELATIONSHIP_BUILDING",
    label: "Relationships/Personability",
    description:
      "Applicant shows promise to build strong relationships with parents and students.",
  },
  {
    key: "ORGANIZATION_AND_COMMITMENT",
    label: "Organization/Commitment",
    description:
      "Application shows applicant is organized and will make necessary commitment.",
  },
  {
    key: "LONG_TERM_POTENTIAL",
    label: "Long-Term Potential",
    description:
      "Application suggests applicant has long-term leadership potential within YPP.",
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
    helperLabel: "No",
    description: "Not ready / clear no.",
    color: "#dc2626",
    bg: "#fef2f2",
  },
  {
    value: "GETTING_STARTED",
    label: "Yellow",
    shortLabel: "Yellow",
    helperLabel: "Maybe / with coaching",
    description: "Maybe — with appropriate coaching.",
    color: "#d97706",
    bg: "#fffbeb",
  },
  {
    value: "ON_TRACK",
    label: "Green",
    shortLabel: "Green",
    helperLabel: "Yes",
    description: "Ready / clear yes.",
    color: "#16a34a",
    bg: "#f0fdf4",
  },
  {
    value: "ABOVE_AND_BEYOND",
    label: "Purple",
    shortLabel: "Purple",
    helperLabel: "Exceptional",
    description: "Exceptionally strong in ways the rest of YPP should learn from.",
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
