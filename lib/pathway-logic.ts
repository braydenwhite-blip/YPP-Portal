export type PathwayCourseLike = {
  id?: string;
  title: string;
  format?: string;
  level?: string | null;
};

export type PathwayStepLike = {
  id?: string;
  stepOrder: number;
  title?: string | null;
  courseId: string | null;
  course?: PathwayCourseLike | null;
  prerequisites?: PathwayStepLike[];
};

export function getCourseBackedPathwaySteps<T extends PathwayStepLike>(steps: T[]) {
  return [...steps]
    .filter((step): step is T & { courseId: string } => Boolean(step.courseId))
    .sort((left, right) => left.stepOrder - right.stepOrder);
}

export function getPathwayStepTitle(step: PathwayStepLike) {
  return step.course?.title ?? step.title ?? `Step ${step.stepOrder}`;
}

export function getRequiredCourseStepsFor<T extends PathwayStepLike>(step: T, allSteps: T[]) {
  if ("prerequisites" in step && step.prerequisites != null) {
    return [...step.prerequisites]
      .filter(
        (candidate): candidate is PathwayStepLike & { courseId: string } =>
          Boolean(candidate.courseId)
      )
      .sort((left, right) => left.stepOrder - right.stepOrder);
  }

  const previousCourseStep = getCourseBackedPathwaySteps(allSteps)
    .filter((candidate) => candidate.stepOrder < step.stepOrder)
    .at(-1);

  return previousCourseStep ? [previousCourseStep] : [];
}

export function arePathwayStepRequirementsMet<T extends PathwayStepLike>(
  step: T,
  allSteps: T[],
  completedCourseIds: Set<string>
) {
  if (!step.courseId) {
    return true;
  }

  return getRequiredCourseStepsFor(step, allSteps).every((requiredStep) =>
    completedCourseIds.has(requiredStep.courseId)
  );
}

export function getCourseBackedPathwayStepsThroughOrder<T extends PathwayStepLike>(
  steps: T[],
  requiredStepOrder: number
) {
  return getCourseBackedPathwaySteps(steps).filter(
    (step) => step.stepOrder <= requiredStepOrder
  );
}

export function getHighestCompletedPathwayStepOrder<T extends PathwayStepLike>(
  steps: T[],
  completedCourseIds: Set<string>
) {
  return steps.reduce((highestStepOrder, step) => {
    if (!step.courseId || !completedCourseIds.has(step.courseId)) {
      return highestStepOrder;
    }

    return Math.max(highestStepOrder, step.stepOrder);
  }, 0);
}

export function getFirstJoinablePathwayCourseStep<T extends PathwayStepLike>(
  steps: T[],
  completedCourseIds = new Set<string>()
) {
  const courseSteps = getCourseBackedPathwaySteps(steps);

  return (
    courseSteps.find(
      (step) =>
        getRequiredCourseStepsFor(step, steps).length === 0 &&
        arePathwayStepRequirementsMet(step, steps, completedCourseIds)
    ) ??
    courseSteps.find((step) =>
      arePathwayStepRequirementsMet(step, steps, completedCourseIds)
    ) ??
    courseSteps[0] ??
    null
  );
}

export function getPathwayProgressSummary<T extends PathwayStepLike>(
  steps: T[],
  enrollmentStatusByCourseId: Map<string, string>
) {
  const courseSteps = getCourseBackedPathwaySteps(steps);
  const completedCourseIds = new Set(
    courseSteps
      .filter(
        (step) => enrollmentStatusByCourseId.get(step.courseId) === "COMPLETED"
      )
      .map((step) => step.courseId)
  );
  const completedCount = courseSteps.filter((step) =>
    completedCourseIds.has(step.courseId)
  ).length;
  const enrolledCount = courseSteps.filter((step) =>
    enrollmentStatusByCourseId.has(step.courseId)
  ).length;
  const totalCount = courseSteps.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentStep =
    courseSteps.find((step) => {
      const status = enrollmentStatusByCourseId.get(step.courseId);
      return status != null && status !== "COMPLETED";
    }) ?? null;
  const nextJoinableStep =
    courseSteps.find(
      (step) =>
        !enrollmentStatusByCourseId.has(step.courseId) &&
        arePathwayStepRequirementsMet(step, steps, completedCourseIds)
    ) ?? null;
  const nextActionStep = currentStep ?? nextJoinableStep;

  return {
    courseSteps,
    completedCourseIds,
    completedCount,
    enrolledCount,
    totalCount,
    progressPercent,
    isEnrolled: enrolledCount > 0,
    isComplete: totalCount > 0 && completedCount === totalCount,
    currentStep,
    nextJoinableStep,
    nextActionStep,
  };
}
