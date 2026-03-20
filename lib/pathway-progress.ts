export type PathwayStepLike = {
  id: string;
  stepOrder: number;
  courseId: string | null;
  title?: string | null;
  course?: { title?: string | null } | null;
};

export function getCourseBackedPathwaySteps<T extends PathwayStepLike>(
  steps: readonly T[]
): Array<T & { courseId: string }> {
  return steps.filter((step): step is T & { courseId: string } => Boolean(step.courseId));
}

export function getPathwayStepDisplayTitle(step: PathwayStepLike) {
  return step.course?.title?.trim() || step.title?.trim() || `Step ${step.stepOrder}`;
}

export function buildPathwayProgress<T extends PathwayStepLike>(
  steps: readonly T[],
  enrollmentMap: Map<string, string>
) {
  const courseSteps = getCourseBackedPathwaySteps(steps);
  const informationalSteps = steps.filter((step) => !step.courseId);
  const completedCount = courseSteps.filter(
    (step) => enrollmentMap.get(step.courseId) === "COMPLETED"
  ).length;
  const enrolledCount = courseSteps.filter((step) => enrollmentMap.has(step.courseId)).length;
  const totalCourseSteps = courseSteps.length;
  const progressPercent =
    totalCourseSteps > 0 ? Math.round((completedCount / totalCourseSteps) * 100) : 0;
  const nextCourseStep =
    courseSteps.find((step) => enrollmentMap.get(step.courseId) !== "COMPLETED") ?? null;
  const highestCompletedCourseStepOrder = courseSteps.reduce((highest, step) => {
    if (enrollmentMap.get(step.courseId) === "COMPLETED") {
      return Math.max(highest, step.stepOrder);
    }

    return highest;
  }, 0);

  return {
    courseSteps,
    informationalSteps,
    completedCount,
    enrolledCount,
    totalCourseSteps,
    progressPercent,
    nextCourseStep,
    highestCompletedCourseStepOrder,
    isEnrolled: enrolledCount > 0,
    isComplete: totalCourseSteps > 0 && completedCount === totalCourseSteps,
  };
}

export function getPreviousCourseBackedStep<T extends PathwayStepLike>(
  steps: readonly T[],
  stepOrder: number
) {
  const courseSteps = getCourseBackedPathwaySteps(steps);
  const currentIndex = courseSteps.findIndex((step) => step.stepOrder === stepOrder);
  return currentIndex > 0 ? courseSteps[currentIndex - 1] : null;
}
