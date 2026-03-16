import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

// ============================================
// TYPES
// ============================================

export type CrossLinkItem = {
  label: string;
  description: string;
  href: string;
  icon: string;
  section: string;
};

export type CrossLinkData = {
  related: CrossLinkItem[];
  connections: string[]; // Explanatory text: "Completing this pathway earns the Explorer badge"
};

export type ProgressSummaryItem = {
  label: string;
  value: string | number;
  href?: string;
  icon?: string;
};

export type ProgressSummaryData = {
  items: ProgressSummaryItem[];
  headline?: string;
};

export type SmartSuggestion = {
  title: string;
  description: string;
  href: string;
  icon: string;
  reason: string;
  priority: number;
};

// ============================================
// SHARED HELPERS (used across route handlers)
// ============================================

async function getUserPassionIds(userId: string): Promise<string[]> {
  const quizResults = await prisma.passionQuizResult.findMany({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { topPassionIds: true },
  });
  return quizResults[0]?.topPassionIds ?? [];
}

async function getUserPassionNames(userId: string): Promise<string[]> {
  const ids = await getUserPassionIds(userId);
  if (ids.length === 0) return [];
  const areas = await prisma.passionArea.findMany({
    where: { id: { in: ids } },
    select: { name: true },
  });
  return areas.map((a: { name: string }) => a.name);
}

async function getCoreStats(userId: string) {
  const [pathwaySteps, badges, goals, challenges, enrollments, xpProfile] =
    await Promise.all([
      prisma.pathwayStepUnlock.count({ where: { userId } }),
      prisma.studentBadge.count({ where: { studentId: userId } }),
      prisma.goal.count({ where: { userId } }),
      prisma.challengeCompletion.count({ where: { studentId: userId } }),
      prisma.enrollment.count({ where: { userId, status: "ENROLLED" } }),
      prisma.studentXP
        .findUnique({
          where: { studentId: userId },
          select: { totalXP: true, currentLevel: true },
        })
        .catch(() => null),
    ]);
  return {
    pathwaySteps,
    badges,
    goals,
    challenges,
    enrollments,
    totalXP: xpProfile?.totalXP ?? 0,
    level: xpProfile?.currentLevel ?? 1,
  };
}

// ============================================
// ROUTE-SPECIFIC CROSS-LINK BUILDERS
// ============================================

async function crossLinksForPathways(
  userId: string
): Promise<CrossLinkData> {
  const related: CrossLinkItem[] = [];
  const connections: string[] = [];

  const [earnableBadges, goalCount, challengeCount, passionNames] =
    await Promise.all([
      prisma.badge.findMany({
        where: {
          isActive: true,
          students: { none: { studentId: userId } },
          criteria: { path: ["type"], equals: "pathway_steps_count" },
        },
        select: { name: true, icon: true, criteria: true },
        take: 3,
      }),
      prisma.goal.count({ where: { userId } }),
      prisma.talentChallenge.count({ where: { isActive: true } }),
      getUserPassionNames(userId),
    ]);

  for (const badge of earnableBadges) {
    const criteria = badge.criteria as Record<string, unknown> | null;
    const needed = (criteria?.count as number) ?? 1;
    related.push({
      label: badge.name,
      description: `Earn by completing ${needed} pathway steps`,
      href: "/badges",
      icon: badge.icon || "🏅",
      section: "badges",
    });
    connections.push(
      `Complete ${needed} pathway steps to earn the "${badge.name}" badge`
    );
  }

  if (goalCount > 0) {
    related.push({
      label: `${goalCount} active goal${goalCount === 1 ? "" : "s"}`,
      description: "Your goals connect to pathway progress",
      href: "/goals",
      icon: "🎯",
      section: "goals",
    });
    connections.push("Your pathway progress feeds directly into your goals");
  }

  if (challengeCount > 0) {
    related.push({
      label: "Active Challenges",
      description: `${challengeCount} challenges available to boost your progress`,
      href: "/challenges",
      icon: "⚡",
      section: "challenges",
    });
  }

  if (passionNames.length > 0) {
    related.push({
      label: "Passion World",
      description: `Explore pathways related to ${passionNames[0]}`,
      href: "/world",
      icon: "🌍",
      section: "world",
    });
  }

  return { related, connections };
}

async function crossLinksForBadges(
  userId: string
): Promise<CrossLinkData> {
  const related: CrossLinkItem[] = [];
  const connections: string[] = [];

  const [stepsCompleted, unearnedBadges, challengesDone] = await Promise.all([
    prisma.pathwayStepUnlock.count({ where: { userId } }),
    prisma.badge.findMany({
      where: {
        isActive: true,
        students: { none: { studentId: userId } },
      },
      select: { name: true, icon: true, criteria: true },
      take: 4,
    }),
    prisma.challengeCompletion.count({ where: { studentId: userId } }),
  ]);

  // Show closest-to-earning badges with what's needed
  for (const badge of unearnedBadges) {
    const criteria = badge.criteria as Record<string, unknown> | null;
    const type = criteria?.type as string;
    const needed = (criteria?.count as number) ?? 1;

    let desc = "";
    let link = "/pathways";
    if (type === "pathway_steps_count") {
      const remaining = Math.max(0, needed - stepsCompleted);
      desc =
        remaining > 0
          ? `Complete ${remaining} more pathway step${remaining === 1 ? "" : "s"}`
          : "You've met the requirement!";
      link = "/pathways";
    } else if (type === "challenges_count") {
      const remaining = Math.max(0, needed - challengesDone);
      desc =
        remaining > 0
          ? `Complete ${remaining} more challenge${remaining === 1 ? "" : "s"}`
          : "You've met the requirement!";
      link = "/challenges";
    } else {
      desc = `Requires ${needed} ${type?.replace(/_/g, " ") ?? "achievements"}`;
    }

    related.push({
      label: badge.name,
      description: desc,
      href: link,
      icon: badge.icon || "🏅",
      section: "badges",
    });
    connections.push(`"${badge.name}": ${desc}`);
  }

  related.push({
    label: "Leaderboards",
    description: "See how your badges compare with others",
    href: "/leaderboards",
    icon: "📊",
    section: "leaderboards",
  });

  return { related, connections };
}

async function crossLinksForChallenges(
  userId: string
): Promise<CrossLinkData> {
  const related: CrossLinkItem[] = [];
  const connections: string[] = [];

  const [stepsCompleted, badgeCount, passionNames] = await Promise.all([
    prisma.pathwayStepUnlock.count({ where: { userId } }),
    prisma.studentBadge.count({ where: { studentId: userId } }),
    getUserPassionNames(userId),
  ]);

  related.push({
    label: `${stepsCompleted} pathway steps`,
    description: "Pathway progress helps unlock harder challenges",
    href: "/pathways",
    icon: "📚",
    section: "pathways",
  });

  related.push({
    label: `${badgeCount} badge${badgeCount === 1 ? "" : "s"} earned`,
    description: "Challenges contribute toward badge criteria",
    href: "/badges",
    icon: "🏅",
    section: "badges",
  });

  connections.push("Completing challenges earns XP and counts toward badge criteria");
  connections.push("Challenge streaks boost your leaderboard ranking");

  related.push({
    label: "Leaderboards",
    description: "Your challenge wins appear on the leaderboard",
    href: "/leaderboards",
    icon: "📊",
    section: "leaderboards",
  });

  if (passionNames.length > 0) {
    related.push({
      label: `${passionNames[0]} challenges`,
      description: "Find challenges matching your interests",
      href: "/world",
      icon: "🌍",
      section: "world",
    });
  }

  return { related, connections };
}

async function crossLinksForGoals(
  userId: string
): Promise<CrossLinkData> {
  const related: CrossLinkItem[] = [];
  const connections: string[] = [];

  const [stepsCompleted, badgeCount, mentorship] = await Promise.all([
    prisma.pathwayStepUnlock.count({ where: { userId } }),
    prisma.studentBadge.count({ where: { studentId: userId } }),
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: { mentor: { select: { name: true } } },
    }),
  ]);

  related.push({
    label: `${stepsCompleted} pathway steps done`,
    description: "Pathway progress directly advances your goals",
    href: "/pathways",
    icon: "📚",
    section: "pathways",
  });

  related.push({
    label: "Reflections",
    description: "Reflect on your goal progress and growth",
    href: "/reflection",
    icon: "📝",
    section: "reflection",
  });

  if (mentorship) {
    related.push({
      label: `Mentor: ${mentorship.mentor.name}`,
      description: "Your mentor reviews your goal progress",
      href: "/mentorship",
      icon: "🤝",
      section: "mentorship",
    });
    connections.push(
      `Your mentor ${mentorship.mentor.name} gets notified when you update goals`
    );
  }

  if (badgeCount > 0) {
    related.push({
      label: `${badgeCount} badges earned`,
      description: "Badges reflect your achievement toward goals",
      href: "/badges",
      icon: "🏅",
      section: "badges",
    });
  }

  connections.push("Goal progress feeds into your pathway journey and badge criteria");

  return { related, connections };
}

async function crossLinksForMentorship(
  userId: string
): Promise<CrossLinkData> {
  const related: CrossLinkItem[] = [];
  const connections: string[] = [];

  // Check if user is a mentor
  const mentees = await prisma.mentorship.findMany({
    where: { mentorId: userId, status: "ACTIVE" },
    select: {
      mentee: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 3,
  });

  if (mentees.length > 0) {
    for (const m of mentees) {
      const [goalCount, stepCount] = await Promise.all([
        prisma.goal.count({ where: { userId: m.mentee.id } }),
        prisma.pathwayStepUnlock.count({ where: { userId: m.mentee.id } }),
      ]);
      related.push({
        label: m.mentee.name,
        description: `${goalCount} goals, ${stepCount} pathway steps`,
        href: "/mentorship/mentees",
        icon: "👤",
        section: "mentorship",
      });
    }
    connections.push("You'll get notifications when mentees hit milestones");
  }

  // Check if user is a mentee
  const myMentor = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    select: { mentor: { select: { name: true } } },
  });

  if (myMentor) {
    related.push({
      label: "My Goals",
      description: `${myMentor.mentor.name} reviews your goal progress`,
      href: "/goals",
      icon: "🎯",
      section: "goals",
    });
    related.push({
      label: "My Pathways",
      description: "Pathway progress is shared with your mentor",
      href: "/pathways",
      icon: "📚",
      section: "pathways",
    });
    connections.push(
      `${myMentor.mentor.name} is notified when you complete pathway steps and challenges`
    );
  }

  return { related, connections };
}

async function crossLinksGeneric(
  userId: string,
  route: string
): Promise<CrossLinkData> {
  const related: CrossLinkItem[] = [];
  const connections: string[] = [];
  const stats = await getCoreStats(userId);

  // Map routes to sensible related sections
  const routeRelations: Record<
    string,
    { items: CrossLinkItem[]; conns: string[] }
  > = {
    "/my-courses": {
      items: [
        {
          label: "Pathways",
          description: "Courses feed into your pathway progress",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
        {
          label: `${stats.badges} badges`,
          description: "Course completion helps earn badges",
          href: "/badges",
          icon: "🏅",
          section: "badges",
        },
        {
          label: "Certificates",
          description: "Earn certificates by completing course sequences",
          href: "/certificates",
          icon: "📜",
          section: "certificates",
        },
      ],
      conns: [
        "Completing courses advances your pathway and earns XP",
      ],
    },
    "/profile": {
      items: [
        {
          label: `${stats.badges} badges`,
          description: "Showcase your earned badges",
          href: "/badges",
          icon: "🏅",
          section: "badges",
        },
        {
          label: "Portfolio",
          description: "Build your portfolio from achievements",
          href: "/portfolio",
          icon: "📁",
          section: "portfolio",
        },
        {
          label: `Level ${stats.level}`,
          description: `${stats.totalXP} XP earned across all activities`,
          href: "/leaderboards",
          icon: "✨",
          section: "leaderboards",
        },
        {
          label: "Timeline",
          description: "See your full journey over time",
          href: "/profile/timeline",
          icon: "📅",
          section: "profile",
        },
      ],
      conns: [
        "Your profile reflects achievements from pathways, badges, and challenges",
      ],
    },
    "/reflection": {
      items: [
        {
          label: `${stats.goals} active goals`,
          description: "Reflect on your progress toward goals",
          href: "/goals",
          icon: "🎯",
          section: "goals",
        },
        {
          label: "Pathways",
          description: "Your reflections tie to pathway growth",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
        {
          label: "Mentorship",
          description: "Share reflections with your mentor",
          href: "/mentorship",
          icon: "🤝",
          section: "mentorship",
        },
      ],
      conns: ["Reflections help your mentor understand your growth journey"],
    },
    "/activities": {
      items: [
        {
          label: "Challenges",
          description: "Activities connect to active challenges",
          href: "/challenges",
          icon: "⚡",
          section: "challenges",
        },
        {
          label: "Passion World",
          description: "Explore activities by passion area",
          href: "/world",
          icon: "🌍",
          section: "world",
        },
        {
          label: "Pathways",
          description: "Activities count toward pathway steps",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
      ],
      conns: ["Activity completion feeds into your challenges and pathway progress"],
    },
    "/leaderboards": {
      items: [
        {
          label: "Challenges",
          description: "Win challenges to climb the rankings",
          href: "/challenges",
          icon: "⚡",
          section: "challenges",
        },
        {
          label: `${stats.totalXP} XP`,
          description: "Earn XP from pathways, badges, and challenges",
          href: "/profile/xp",
          icon: "✨",
          section: "profile",
        },
        {
          label: `${stats.badges} badges`,
          description: "Badges contribute to your overall score",
          href: "/badges",
          icon: "🏅",
          section: "badges",
        },
      ],
      conns: [
        "XP from pathways, badges, and challenges all feed into your ranking",
      ],
    },
    "/portfolio": {
      items: [
        {
          label: "Showcase",
          description: "Submit your best work to the community showcase",
          href: "/showcase",
          icon: "🎨",
          section: "showcase",
        },
        {
          label: "Certificates",
          description: "Add certificates to your portfolio",
          href: "/certificates",
          icon: "📜",
          section: "certificates",
        },
        {
          label: `${stats.badges} badges`,
          description: "Display your earned badges",
          href: "/badges",
          icon: "🏅",
          section: "badges",
        },
      ],
      conns: [
        "Your portfolio draws from badges, certificates, and showcase entries",
      ],
    },
    "/showcase": {
      items: [
        {
          label: "Portfolio",
          description: "Showcase entries appear in your portfolio",
          href: "/portfolio",
          icon: "📁",
          section: "portfolio",
        },
        {
          label: "Wall of Fame",
          description: "Top showcases get featured on the Wall of Fame",
          href: "/wall-of-fame",
          icon: "⭐",
          section: "wall-of-fame",
        },
        {
          label: "Community",
          description: "Get recognition from the community",
          href: "/community/recognize",
          icon: "👏",
          section: "community",
        },
      ],
      conns: ["Great showcase work earns badges and may appear on the Wall of Fame"],
    },
    "/certificates": {
      items: [
        {
          label: "Pathways",
          description: "Complete pathways to earn certificates",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
        {
          label: "Portfolio",
          description: "Add certificates to your portfolio",
          href: "/portfolio",
          icon: "📁",
          section: "portfolio",
        },
        {
          label: "My Courses",
          description: "Course sequences lead to certificates",
          href: "/my-courses",
          icon: "📖",
          section: "courses",
        },
      ],
      conns: ["Certificates are earned by completing full pathways or course sequences"],
    },
    "/awards": {
      items: [
        {
          label: "Pathways",
          description: "Pathway mastery contributes to award eligibility",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
        {
          label: "Challenges",
          description: "Challenge wins boost your award candidacy",
          href: "/challenges",
          icon: "⚡",
          section: "challenges",
        },
        {
          label: "Wall of Fame",
          description: "Award winners are featured on the Wall of Fame",
          href: "/wall-of-fame",
          icon: "⭐",
          section: "wall-of-fame",
        },
      ],
      conns: ["Awards reflect sustained excellence across pathways, challenges, and community"],
    },
    "/wall-of-fame": {
      items: [
        {
          label: "Awards",
          description: "Award winners are featured here",
          href: "/awards",
          icon: "🏆",
          section: "awards",
        },
        {
          label: "Leaderboards",
          description: "Top performers on the leaderboard get recognized",
          href: "/leaderboards",
          icon: "📊",
          section: "leaderboards",
        },
        {
          label: "Showcase",
          description: "Best showcases are featured on the Wall of Fame",
          href: "/showcase",
          icon: "🎨",
          section: "showcase",
        },
      ],
      conns: ["The Wall of Fame celebrates top achievements across the portal"],
    },
    "/world": {
      items: [
        {
          label: "Discover Quiz",
          description: "Find your passion through the discovery quiz",
          href: "/discover/quiz",
          icon: "🔍",
          section: "discover",
        },
        {
          label: "Pathways",
          description: "Follow pathways in your passion areas",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
        {
          label: "Challenges",
          description: "Try challenges in different passion areas",
          href: "/challenges",
          icon: "⚡",
          section: "challenges",
        },
      ],
      conns: ["The Passion World connects your interests to pathways, courses, and challenges"],
    },
    "/discover/quiz": {
      items: [
        {
          label: "Passion World",
          description: "Explore the islands for your top passions",
          href: "/world",
          icon: "🌍",
          section: "world",
        },
        {
          label: "Pathways",
          description: "Start a pathway in your discovered passion",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
      ],
      conns: ["Your quiz results personalize pathway and challenge recommendations across the portal"],
    },
    "/learn": {
      items: [
        {
          label: "Pathways",
          description: "Learning modules connect to pathway steps",
          href: "/pathways",
          icon: "📚",
          section: "pathways",
        },
        {
          label: "Challenges",
          description: "Practice what you learn through challenges",
          href: "/challenges",
          icon: "⚡",
          section: "challenges",
        },
        {
          label: `${stats.badges} badges`,
          description: "Learning progress helps earn badges",
          href: "/badges",
          icon: "🏅",
          section: "badges",
        },
      ],
      conns: ["Learning progress counts toward pathway steps and badge criteria"],
    },
    "/projects/tracker": {
      items: [
        {
          label: "Showcase",
          description: "Submit finished projects to the showcase",
          href: "/showcase",
          icon: "🎨",
          section: "showcase",
        },
        {
          label: "Portfolio",
          description: "Add projects to your portfolio",
          href: "/portfolio",
          icon: "📁",
          section: "portfolio",
        },
        {
          label: "Incubator",
          description: "Take projects further in the incubator",
          href: "/incubator",
          icon: "🚀",
          section: "incubator",
        },
      ],
      conns: ["Completed projects can be showcased and added to your portfolio"],
    },
    "/incubator": {
      items: [
        {
          label: "Projects",
          description: "Your project tracker feeds into the incubator",
          href: "/projects/tracker",
          icon: "📋",
          section: "projects",
        },
        {
          label: "Mentorship",
          description: "Get mentor guidance on incubator projects",
          href: "/mentorship",
          icon: "🤝",
          section: "mentorship",
        },
        {
          label: "Showcase",
          description: "Present incubator projects at showcases",
          href: "/showcase",
          icon: "🎨",
          section: "showcase",
        },
      ],
      conns: ["Incubator projects connect to mentorship guidance and community showcases"],
    },
    "/community/feed": {
      items: [
        {
          label: "Recognize",
          description: "Give shout-outs to peers",
          href: "/community/recognize",
          icon: "👏",
          section: "community",
        },
        {
          label: "Showcase",
          description: "See what peers are building",
          href: "/showcase",
          icon: "🎨",
          section: "showcase",
        },
        {
          label: "Challenges",
          description: "Join challenges with the community",
          href: "/challenges",
          icon: "⚡",
          section: "challenges",
        },
      ],
      conns: ["Community activity connects to recognition, showcases, and shared challenges"],
    },
  };

  const match = routeRelations[route];
  if (match) {
    return { related: match.items, connections: match.conns };
  }

  // Fallback: show core sections
  related.push(
    {
      label: "Pathways",
      description: `${stats.pathwaySteps} steps completed`,
      href: "/pathways",
      icon: "📚",
      section: "pathways",
    },
    {
      label: "Badges",
      description: `${stats.badges} earned`,
      href: "/badges",
      icon: "🏅",
      section: "badges",
    },
    {
      label: "Challenges",
      description: `${stats.challenges} completed`,
      href: "/challenges",
      icon: "⚡",
      section: "challenges",
    }
  );

  return { related, connections };
}

// ============================================
// PROGRESS SUMMARY PER PAGE
// ============================================

async function progressSummaryForRoute(
  userId: string,
  route: string
): Promise<ProgressSummaryData> {
  const stats = await getCoreStats(userId);

  const summaries: Record<string, () => Promise<ProgressSummaryData>> = {
    "/pathways": async () => {
      const pathways = await prisma.pathwayStepUnlock.findMany({
        where: { userId },
        select: { step: { select: { pathway: { select: { id: true } } } } },
      });
      const uniquePathways = new Set(pathways.map((p: { step: { pathway: { id: string } | null } }) => p.step.pathway?.id).filter(Boolean));
      return {
        headline: `You're progressing through ${uniquePathways.size} pathway${uniquePathways.size === 1 ? "" : "s"}`,
        items: [
          { label: "Steps Done", value: stats.pathwaySteps, icon: "📚", href: "/pathways/progress" },
          { label: "Badges Earned", value: stats.badges, icon: "🏅", href: "/badges" },
          { label: "Goals Set", value: stats.goals, icon: "🎯", href: "/goals" },
          { label: "Total XP", value: stats.totalXP, icon: "✨", href: "/profile/xp" },
        ],
      };
    },
    "/badges": async () => {
      const totalBadges = await prisma.badge.count({ where: { isActive: true } });
      return {
        headline: `${stats.badges} of ${totalBadges} badges earned`,
        items: [
          { label: "Badges", value: `${stats.badges}/${totalBadges}`, icon: "🏅" },
          { label: "Pathway Steps", value: stats.pathwaySteps, icon: "📚", href: "/pathways" },
          { label: "Challenges Done", value: stats.challenges, icon: "⚡", href: "/challenges" },
          { label: "Level", value: stats.level, icon: "✨", href: "/profile/xp" },
        ],
      };
    },
    "/challenges": async () => {
      const activeParticipation = await prisma.challengeParticipant
        .count({ where: { studentId: userId, status: "ACTIVE" } })
        .catch(() => 0);
      return {
        headline:
          activeParticipation > 0
            ? `${activeParticipation} active challenge${activeParticipation === 1 ? "" : "s"} in progress`
            : "Start a challenge to build momentum",
        items: [
          { label: "Active", value: activeParticipation, icon: "⚡" },
          { label: "Completed", value: stats.challenges, icon: "🏆" },
          { label: "Badges", value: stats.badges, icon: "🏅", href: "/badges" },
          { label: "Total XP", value: stats.totalXP, icon: "✨" },
        ],
      };
    },
    "/goals": async () => ({
      headline:
        stats.goals > 0
          ? `Tracking ${stats.goals} goal${stats.goals === 1 ? "" : "s"}`
          : "Set your first goal to start tracking",
      items: [
        { label: "Goals", value: stats.goals, icon: "🎯" },
        { label: "Pathway Steps", value: stats.pathwaySteps, icon: "📚", href: "/pathways" },
        { label: "Badges", value: stats.badges, icon: "🏅", href: "/badges" },
        { label: "Reflections", value: "View", icon: "📝", href: "/reflection" },
      ],
    }),
    "/mentorship": async () => {
      const menteeCount = await prisma.mentorship.count({
        where: { mentorId: userId, status: "ACTIVE" },
      });
      const hasMentor = await prisma.mentorship.count({
        where: { menteeId: userId, status: "ACTIVE" },
      });
      return {
        headline: menteeCount > 0
          ? `Mentoring ${menteeCount} student${menteeCount === 1 ? "" : "s"}`
          : hasMentor > 0
            ? "Connected with your mentor"
            : "Explore mentorship connections",
        items: [
          { label: "Goals", value: stats.goals, icon: "🎯", href: "/goals" },
          { label: "Pathway Steps", value: stats.pathwaySteps, icon: "📚", href: "/pathways" },
          { label: "Badges", value: stats.badges, icon: "🏅", href: "/badges" },
          { label: "Level", value: stats.level, icon: "✨" },
        ],
      };
    },
  };

  const builder = summaries[route];
  if (builder) return builder();

  // Default summary for any page
  return {
    headline: `Level ${stats.level} — ${stats.totalXP} XP earned`,
    items: [
      { label: "Pathway Steps", value: stats.pathwaySteps, icon: "📚", href: "/pathways" },
      { label: "Badges", value: stats.badges, icon: "🏅", href: "/badges" },
      { label: "Challenges", value: stats.challenges, icon: "⚡", href: "/challenges" },
      { label: "Goals", value: stats.goals, icon: "🎯", href: "/goals" },
    ],
  };
}

// ============================================
// SMART SUGGESTIONS
// ============================================

async function buildSmartSuggestions(
  userId: string,
  route: string
): Promise<SmartSuggestion[]> {
  const suggestions: SmartSuggestion[] = [];
  const [stats, passionNames, passionIds] = await Promise.all([
    getCoreStats(userId),
    getUserPassionNames(userId),
    getUserPassionIds(userId),
  ]);

  const passionLabel = passionNames[0] ?? "your interests";

  // Always-relevant suggestions based on gaps
  if (stats.pathwaySteps === 0 && route !== "/pathways") {
    suggestions.push({
      title: "Start your first pathway",
      description: passionNames.length > 0
        ? `Explore pathways related to ${passionLabel}`
        : "Choose a pathway to begin your journey",
      href: "/pathways",
      icon: "📚",
      reason: "Starting a pathway unlocks badges and new portal sections",
      priority: 100,
    });
  }

  if (stats.goals === 0 && route !== "/goals") {
    suggestions.push({
      title: "Set a goal",
      description: "Define what you want to achieve this term",
      href: "/goals",
      icon: "🎯",
      reason: "Goals connect your pathway progress to personal growth",
      priority: 90,
    });
  }

  if (stats.badges === 0 && stats.pathwaySteps > 0 && route !== "/badges") {
    suggestions.push({
      title: "Check your badge progress",
      description: "You might be close to earning your first badge",
      href: "/badges",
      icon: "🏅",
      reason: `You have ${stats.pathwaySteps} pathway step${stats.pathwaySteps === 1 ? "" : "s"} completed`,
      priority: 85,
    });
  }

  // Route-specific suggestions
  if (route === "/pathways" && stats.challenges === 0) {
    suggestions.push({
      title: "Try a challenge",
      description: "Challenges build skills that help with pathways",
      href: "/challenges",
      icon: "⚡",
      reason: "Challenges earn XP and count toward badges",
      priority: 80,
    });
  }

  if (route === "/badges" && stats.pathwaySteps > 0) {
    const nextBadge = await prisma.badge.findFirst({
      where: {
        isActive: true,
        students: { none: { studentId: userId } },
        criteria: { path: ["type"], equals: "pathway_steps_count" },
      },
      select: { name: true, criteria: true },
    });
    if (nextBadge) {
      const needed = ((nextBadge.criteria as Record<string, unknown>)?.count as number) ?? 1;
      const remaining = Math.max(0, needed - stats.pathwaySteps);
      if (remaining > 0 && remaining <= 3) {
        suggestions.push({
          title: `Almost there: "${nextBadge.name}"`,
          description: `Complete ${remaining} more pathway step${remaining === 1 ? "" : "s"} to earn it`,
          href: "/pathways",
          icon: "🏅",
          reason: "You're close to earning this badge",
          priority: 95,
        });
      }
    }
  }

  if (route === "/challenges") {
    if (passionIds.length > 0) {
      const passionChallenge = await prisma.talentChallenge.findFirst({
        where: {
          isActive: true,
          passionIds: { hasSome: passionIds },
        },
        select: { id: true, title: true },
      });
      if (passionChallenge) {
        suggestions.push({
          title: passionChallenge.title,
          description: `A challenge matching your interest in ${passionLabel}`,
          href: `/challenges/${passionChallenge.id}`,
          icon: "⚡",
          reason: `Based on your interest in ${passionLabel}`,
          priority: 85,
        });
      }
    }
  }

  if (route === "/goals" || route === "/reflection") {
    const hasMentor = await prisma.mentorship.count({
      where: { menteeId: userId, status: "ACTIVE" },
    });
    if (hasMentor === 0) {
      suggestions.push({
        title: "Connect with a mentor",
        description: "A mentor can help guide your goal progress",
        href: "/mentorship",
        icon: "🤝",
        reason: "Mentorship accelerates growth",
        priority: 75,
      });
    }
  }

  if ((route === "/profile" || route === "/portfolio") && stats.badges >= 3) {
    suggestions.push({
      title: "Submit to Showcase",
      description: "Share your best work with the community",
      href: "/showcase/submit",
      icon: "🎨",
      reason: `You have ${stats.badges} badges — great portfolio material`,
      priority: 70,
    });
  }

  if (route === "/leaderboards" && stats.challenges < 3) {
    suggestions.push({
      title: "Boost your ranking",
      description: "Complete more challenges to climb the leaderboard",
      href: "/challenges",
      icon: "⚡",
      reason: "Challenges are the fastest way to earn XP",
      priority: 80,
    });
  }

  if (route === "/world" && passionNames.length === 0) {
    suggestions.push({
      title: "Take the Passion Quiz",
      description: "Discover which passion areas match your interests",
      href: "/discover/quiz",
      icon: "🔍",
      reason: "Your quiz results personalize recommendations across the portal",
      priority: 95,
    });
  }

  // Sort by priority descending, return top 2
  return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 2);
}

// ============================================
// PUBLIC API
// ============================================

export async function getCrossLinks(
  userId: string,
  route: string
): Promise<CrossLinkData> {
  return withPrismaFallback(
    "getCrossLinks",
    async () => {
      const normalizedRoute = normalizeRoute(route);
      switch (normalizedRoute) {
        case "/pathways":
          return crossLinksForPathways(userId);
        case "/badges":
          return crossLinksForBadges(userId);
        case "/challenges":
          return crossLinksForChallenges(userId);
        case "/goals":
          return crossLinksForGoals(userId);
        case "/mentorship":
          return crossLinksForMentorship(userId);
        default:
          return crossLinksGeneric(userId, normalizedRoute);
      }
    },
    () => ({ related: [], connections: [] })
  );
}

export async function getPageProgressSummary(
  userId: string,
  route: string
): Promise<ProgressSummaryData> {
  return withPrismaFallback(
    "getPageProgressSummary",
    async () => progressSummaryForRoute(userId, normalizeRoute(route)),
    () => ({ items: [] })
  );
}

export async function getSmartSuggestions(
  userId: string,
  route: string
): Promise<SmartSuggestion[]> {
  return withPrismaFallback(
    "getSmartSuggestions",
    async () => buildSmartSuggestions(userId, normalizeRoute(route)),
    () => []
  );
}

// Strip trailing slashes and dynamic segments for matching
function normalizeRoute(route: string): string {
  // Remove trailing slash
  let normalized = route.replace(/\/$/, "") || "/";
  // Collapse /[id] segments to just the parent route
  normalized = normalized.replace(/\/[a-z0-9]{20,}$/i, "");
  return normalized;
}
