export const INSTRUCTOR_REVIEW_CATEGORIES = [
  {
    key: "CURRICULUM_STRENGTH",
    label: "GOAL 1 — Curriculum & Class Delivery",
    description:
      "Strength of the proposed curriculum and the applicant's ability to deliver engaging, well-structured classes.",
  },
  {
    key: "RELATIONSHIP_BUILDING",
    label: "GOAL 2 — Student & Family Relationships",
    description:
      "Applicant's ability to build trusting, supportive relationships with students and their families.",
  },
  {
    key: "ORGANIZATION_AND_COMMITMENT",
    label: "GOAL 3 — Organization, Commitment & Reliability",
    description:
      "Applicant is organized, follows through, and can be counted on to honor their commitments.",
  },
  {
    key: "COMMUNITY_FIT",
    label: "GOAL 4 — YPP Community Involvement",
    description:
      "Applicant shows signs of connecting to, contributing to, and strengthening the YPP community.",
  },
  {
    key: "LONG_TERM_POTENTIAL",
    label: "GOAL 5 — Long-Term Growth & Increased Involvement",
    description:
      "Applicant has the potential to grow over time and take on increased involvement and leadership within YPP.",
  },
] as const;

export type InstructorReviewCategoryValue =
  (typeof INSTRUCTOR_REVIEW_CATEGORIES)[number]["key"];

export const INSTRUCTOR_INITIAL_REVIEW_SIGNALS = [
  {
    key: "CURRICULUM_STRENGTH",
    label: "GOAL 1 — Curriculum & Class Delivery",
    description:
      "Strength of the proposed curriculum and the applicant's ability to deliver engaging, well-structured classes.",
  },
  {
    key: "RELATIONSHIP_BUILDING",
    label: "GOAL 2 — Student & Family Relationships",
    description:
      "Applicant's ability to build trusting, supportive relationships with students and their families.",
  },
  {
    key: "ORGANIZATION_AND_COMMITMENT",
    label: "GOAL 3 — Organization, Commitment & Reliability",
    description:
      "Applicant is organized, follows through, and can be counted on to honor their commitments.",
  },
  {
    key: "COMMUNITY_FIT",
    label: "GOAL 4 — YPP Community Involvement",
    description:
      "Applicant shows signs of connecting to, contributing to, and strengthening the YPP community.",
  },
  {
    key: "LONG_TERM_POTENTIAL",
    label: "GOAL 5 — Long-Term Growth & Increased Involvement",
    description:
      "Applicant has the potential to grow over time and take on increased involvement and leadership within YPP.",
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
