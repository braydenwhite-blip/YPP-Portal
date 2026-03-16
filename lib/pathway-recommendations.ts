import type { Prisma } from "@prisma/client";

type PathwayWithSteps = Prisma.PathwayGetPayload<{
  include: {
    steps: { include: { course: true } };
    _count: { select: { certificates: true } };
  };
}>;

export interface RecommendedPathway {
  pathway: PathwayWithSteps;
  reason: string;
  score: number;
}

export function getRecommendedPathways(
  enrolledSummaries: Array<{ pathway: PathwayWithSteps; completedCount: number }>,
  availablePathways: PathwayWithSteps[],
  completedCourseIds: Set<string>
): RecommendedPathway[] {
  if (enrolledSummaries.length === 0) return [];

  const enrolledInterestAreas = new Set(enrolledSummaries.map((s) => s.pathway.interestArea));

  // Collect course levels the student has completed
  const completedLevels = new Set<string | null>();
  for (const summary of enrolledSummaries) {
    for (const step of summary.pathway.steps) {
      if (step.courseId && completedCourseIds.has(step.courseId) && step.course) {
        completedLevels.add(step.course.level);
      }
    }
  }

  const results: RecommendedPathway[] = [];

  for (const pathway of availablePathways) {
    let score = 0;
    let reason = "";

    // +2 for matching interest area
    if (enrolledInterestAreas.has(pathway.interestArea)) {
      score += 2;
      reason = `Matches your ${pathway.interestArea} interest`;
    }

    // +1 for matching course level pattern
    for (const step of pathway.steps) {
      if (step.course && completedLevels.has(step.course.level)) {
        score += 1;
        if (!reason) reason = `Matches courses you've done before`;
        break;
      }
    }

    // +1 if student already completed a course that's in this pathway
    for (const step of pathway.steps) {
      if (step.courseId && completedCourseIds.has(step.courseId)) {
        score += 1;
        if (!reason) reason = "You've already started some of these courses";
        break;
      }
    }

    if (score > 0) {
      results.push({ pathway, reason, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}
