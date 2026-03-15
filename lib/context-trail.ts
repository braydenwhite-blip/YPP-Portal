"use server";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

// ============================================
// TYPES
// ============================================

export type ContextTrailItem = {
  label: string;
  href: string;
  icon: string;
  type: "pathway" | "goal" | "badge" | "course" | "milestone" | "mentorship";
  detail?: string; // e.g. "65%" or "2 of 5 steps"
};

export type ContextTrailInput = {
  route: string;
  userId: string;
  courseId?: string;
  pathwayId?: string;
  goalId?: string;
};

// ============================================
// ROUTE CONFIG
// ============================================

type RouteConfig = {
  fetchPathway?: boolean;
  fetchCourse?: boolean;
  parentPathway?: boolean;
  relatedGoals?: boolean;
  relatedBadges?: boolean;
  badgeProgress?: boolean;
  fetchMentorship?: boolean;
  menteeGoals?: boolean;
  fetchChallenges?: boolean;
  relatedPathways?: boolean;
};

const ROUTE_CONTEXT_MAP: Record<string, RouteConfig> = {
  "/pathways": { fetchPathway: true, relatedGoals: true, relatedBadges: true },
  "/courses": { fetchCourse: true, parentPathway: true, relatedGoals: true },
  "/goals": { relatedPathways: true, badgeProgress: true },
  "/badges": { relatedPathways: true },
  "/challenges": { relatedBadges: true, fetchChallenges: true },
  "/mentorship": { fetchMentorship: true, menteeGoals: true },
  "/projects": { relatedPathways: true, relatedBadges: true },
  "/instructor-training": { relatedBadges: true },
};

// ============================================
// CORE BUILDER
// ============================================

export async function buildContextTrail(
  input: ContextTrailInput
): Promise<ContextTrailItem[]> {
  return withPrismaFallback(
    "buildContextTrail",
    async () => {
      const items: ContextTrailItem[] = [];
      const config = resolveRouteConfig(input.route);
      if (!config) return items;

      // Fetch data in parallel based on config
      const promises: Promise<void>[] = [];

      if (config.fetchPathway || config.relatedPathways) {
        promises.push(addPathwayTrail(items, input));
      }

      if (config.fetchCourse || config.parentPathway) {
        promises.push(addCourseTrail(items, input));
      }

      if (config.relatedGoals) {
        promises.push(addGoalTrail(items, input));
      }

      if (config.relatedBadges || config.badgeProgress) {
        promises.push(addBadgeTrail(items, input));
      }

      if (config.fetchMentorship) {
        promises.push(addMentorshipTrail(items, input));
      }

      await Promise.all(promises);

      return items;
    },
    () => []
  );
}

function resolveRouteConfig(route: string): RouteConfig | null {
  // Try exact match first, then prefix match
  for (const [pattern, config] of Object.entries(ROUTE_CONTEXT_MAP)) {
    if (route === pattern || route.startsWith(pattern + "/")) {
      return config;
    }
  }
  return null;
}

// ============================================
// TRAIL BUILDERS
// ============================================

async function addPathwayTrail(
  items: ContextTrailItem[],
  input: ContextTrailInput
) {
  // Find user's active pathway enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: input.userId, status: "ENROLLED" },
    select: {
      course: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    take: 3,
  });

  // Also check pathway-specific progress
  const pathwaySteps = await prisma.pathwayStepUnlock.findMany({
    where: { userId: input.userId },
    select: {
      step: {
        select: {
          pathway: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Deduplicate pathways
  const pathwayMap = new Map<string, string>();
  for (const s of pathwaySteps) {
    if (s.step.pathway) {
      pathwayMap.set(s.step.pathway.id, s.step.pathway.name);
    }
  }

  for (const [id, name] of pathwayMap) {
    // Count progress
    const totalSteps = await prisma.pathwayStep.count({
      where: { pathwayId: id },
    });
    const completedSteps = await prisma.pathwayStepUnlock.count({
      where: {
        userId: input.userId,
        step: { pathwayId: id },
      },
    });

    const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    items.push({
      label: name,
      href: `/pathways/${id}`,
      icon: "📚",
      type: "pathway",
      detail: `${pct}% complete`,
    });
  }
}

async function addCourseTrail(
  items: ContextTrailItem[],
  input: ContextTrailInput
) {
  if (!input.courseId) return;

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      title: true,
    },
  });

  if (course) {
    items.push({
      label: course.title,
      href: `/courses/${course.id}`,
      icon: "📖",
      type: "course",
    });
  }

  // Find parent pathway for this course
  const pathwayStep = await prisma.pathwayStep.findFirst({
    where: { courseId: input.courseId },
    select: {
      stepOrder: true,
      pathway: { select: { id: true, name: true } },
    },
  });

  if (pathwayStep?.pathway) {
    items.push({
      label: pathwayStep.pathway.name,
      href: `/pathways/${pathwayStep.pathway.id}`,
      icon: "📚",
      type: "pathway",
      detail: `Step ${pathwayStep.stepOrder}`,
    });
  }
}

async function addGoalTrail(
  items: ContextTrailItem[],
  input: ContextTrailInput
) {
  const goals = await prisma.goal.findMany({
    where: { userId: input.userId },
    include: {
      template: { select: { title: true } },
    },
    take: 3,
  });

  for (const goal of goals) {
    items.push({
      label: goal.template.title,
      href: "/goals",
      icon: "🎯",
      type: "goal",
    });
  }
}

async function addBadgeTrail(
  items: ContextTrailItem[],
  input: ContextTrailInput
) {
  // Show earned badge count and closest-to-earning badge
  const earnedCount = await prisma.studentBadge.count({
    where: { studentId: input.userId },
  });

  if (earnedCount > 0) {
    items.push({
      label: `${earnedCount} badge${earnedCount === 1 ? "" : "s"} earned`,
      href: "/badges",
      icon: "🏅",
      type: "badge",
    });
  } else {
    items.push({
      label: "No badges yet",
      href: "/badges",
      icon: "🏅",
      type: "badge",
      detail: "Keep going!",
    });
  }
}

async function addMentorshipTrail(
  items: ContextTrailItem[],
  input: ContextTrailInput
) {
  // Check if user is a mentor with active mentees
  const mentorships = await prisma.mentorship.findMany({
    where: { mentorId: input.userId, status: "ACTIVE" },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 3,
  });

  for (const m of mentorships) {
    const goalCount = await prisma.goal.count({ where: { userId: m.mentee.id } });
    const stepCount = await prisma.pathwayStepUnlock.count({ where: { userId: m.mentee.id } });

    items.push({
      label: m.mentee.name,
      href: "/mentorship",
      icon: "👤",
      type: "mentorship",
      detail: `${goalCount} goals, ${stepCount} steps`,
    });
  }

  // Check if user is a mentee
  const menteeships = await prisma.mentorship.findMany({
    where: { menteeId: input.userId, status: "ACTIVE" },
    include: {
      mentor: {
        select: { name: true },
      },
    },
    take: 1,
  });

  if (menteeships.length > 0) {
    items.push({
      label: `Mentor: ${menteeships[0].mentor.name}`,
      href: "/mentorship",
      icon: "🤝",
      type: "mentorship",
    });
  }
}

