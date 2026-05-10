/**
 * Pure function that decides the single "next step" to surface on the
 * instructor-as-mentee dashboard. Kept side-effect free so it can be unit
 * tested without rendering the React tree.
 */
export type NextActionInput = {
  hasMentor: boolean;
  cycleStage: string | null;
  kickoffCompletedAt: Date | null;
  hasGoals: boolean;
  hasReleasedReview: boolean;
};

export type NextAction = {
  label: string;
  detail: string;
  href: string | null;
};

export function nextActionForInstructorMentee(input: NextActionInput): NextAction {
  const { hasMentor, cycleStage, kickoffCompletedAt, hasGoals, hasReleasedReview } = input;

  if (!hasMentor) {
    return {
      label: "Wait for mentor assignment",
      detail: "Reach out to your chapter leadership if you expected one to be assigned.",
      href: null,
    };
  }
  if (!kickoffCompletedAt && cycleStage === "KICKOFF_PENDING") {
    return {
      label: "Schedule your kickoff with your mentor",
      detail: "The monthly review cycle starts after your kickoff is complete.",
      href: "/mentorship",
    };
  }
  if (cycleStage === "REFLECTION_DUE" || cycleStage === "KICKOFF_PENDING") {
    return {
      label: "Submit this month's reflection",
      detail: "Your mentor needs your reflection to write your monthly review.",
      href: "/my-program/reflect",
    };
  }
  if (cycleStage === "REFLECTION_SUBMITTED") {
    return {
      label: "Reflection submitted — your mentor is reviewing it",
      detail: "You'll see feedback below once they release the review.",
      href: null,
    };
  }
  if (cycleStage === "CHANGES_REQUESTED") {
    return {
      label: "Update your reflection — changes requested",
      detail: "Your mentor asked for revisions before they finalize this month's review.",
      href: "/my-program/reflect",
    };
  }
  if (cycleStage === "REVIEW_SUBMITTED") {
    return {
      label: "Review pending chair approval",
      detail: "Your mentor's review is with the chair for sign-off.",
      href: null,
    };
  }
  if (cycleStage === "APPROVED" && hasReleasedReview) {
    return {
      label: "Read your latest review",
      detail: "Your mentor's feedback for this month is below — use it to plan next month.",
      href: null,
    };
  }
  if (!hasGoals) {
    return {
      label: "Set this month's goals with your mentor",
      detail: "Once goals are in place, your reflection and review cycle will begin.",
      href: null,
    };
  }
  return {
    label: "Stay on track with your goals",
    detail: "Keep working through this month's goals so your next reflection has clear progress to share.",
    href: null,
  };
}
