import { prisma } from "@/lib/prisma";
import type {
  ActivityFeedFilters,
  ActivityFeedResult,
  ActivityItem,
  ActivitySourceType,
} from "./types";

const SOURCE_TYPES: ActivitySourceType[] = [
  "PORTAL_CHALLENGE",
  "TALENT_CHALLENGE",
  "TRY_IT_SESSION",
  "INCUBATOR_PROJECT",
  "PROJECT_TRACKER",
];

const INCUBATOR_PHASE_XP: Record<string, number> = {
  IDEATION: 25,
  PLANNING: 30,
  BUILDING: 50,
  FEEDBACK: 20,
  POLISHING: 30,
  SHOWCASE: 75,
};

type PassionLookupMaps = {
  idByToken: Map<string, string>;
  nameById: Map<string, string>;
};

function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return 200;
  return Math.max(1, Math.min(limit, 500));
}

function normalizeDifficulty(value: string | null | undefined): ActivityItem["difficulty"] {
  const normalized = (value || "").toUpperCase();
  if (normalized === "EASY") return "EASY";
  if (normalized === "HARD") return "HARD";
  if (normalized === "ADVANCED" || normalized === "EXPERT") return "ADVANCED";
  return "MEDIUM";
}

function canSeeDraftContent(roleSet: Set<string>): boolean {
  return (
    roleSet.has("ADMIN") ||
    roleSet.has("INSTRUCTOR") ||
    roleSet.has("CHAPTER_LEAD")
  );
}

function hasSource(
  selected: ActivitySourceType[] | undefined,
  source: ActivitySourceType
): boolean {
  if (!selected || selected.length === 0) return true;
  return selected.includes(source);
}

function normalizeToken(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeRawPassionValue(value: string | null | undefined): string | null {
  const trimmed = (value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value || "").trim())
        .filter((value) => value.length > 0)
    )
  );
}

function buildPassionLookupMaps(
  passions: Array<{ id: string; name: string }>
): PassionLookupMaps {
  const idByToken = new Map<string, string>();
  const nameById = new Map<string, string>();

  for (const passion of passions) {
    nameById.set(passion.id, passion.name);
    idByToken.set(normalizeToken(passion.id), passion.id);
    idByToken.set(normalizeToken(passion.name), passion.id);
  }

  return { idByToken, nameById };
}

function resolvePassionId(
  value: string | null | undefined,
  maps: PassionLookupMaps
): string | null {
  const token = normalizeToken(value);
  if (!token) return null;
  return maps.idByToken.get(token) ?? null;
}

function resolvePassionName(
  value: string | null | undefined,
  maps: PassionLookupMaps
): string | null {
  const id = resolvePassionId(value, maps);
  if (!id) return null;
  return maps.nameById.get(id) ?? null;
}

function resolvePrimaryPassion(
  values: string[] | null | undefined,
  maps: PassionLookupMaps
): { passionId: string | null; passionName: string | null } {
  if (!values || values.length === 0) {
    return { passionId: null, passionName: null };
  }

  for (const value of values) {
    const canonicalId = resolvePassionId(value, maps);
    if (canonicalId) {
      return {
        passionId: canonicalId,
        passionName: maps.nameById.get(canonicalId) ?? normalizeRawPassionValue(value),
      };
    }
  }

  const fallback = normalizeRawPassionValue(values[0]);
  return { passionId: fallback, passionName: fallback };
}

export async function getActivityFeedForUser(
  userId: string,
  filters: ActivityFeedFilters = {}
): Promise<ActivityFeedResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      primaryRole: true,
      roles: { select: { role: true } },
    },
  });

  const passions = await prisma.passionArea
    .findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })
    .catch(() => []);
  const passionLookup = buildPassionLookupMaps(passions);

  if (!user) {
    return {
      items: [],
      countsBySource: {
        PORTAL_CHALLENGE: 0,
        TALENT_CHALLENGE: 0,
        TRY_IT_SESSION: 0,
        INCUBATOR_PROJECT: 0,
        PROJECT_TRACKER: 0,
      },
    };
  }

  const roleSet = new Set<string>([
    ...(user.primaryRole ? [user.primaryRole] : []),
    ...user.roles.map((entry) => entry.role),
  ]);
  const includeDraft = Boolean(filters.includeDraft && canSeeDraftContent(roleSet));
  const limit = clampLimit(filters.limit);
  const sourceTypes = filters.sourceTypes;
  const now = new Date();
  const canonicalPassionId =
    resolvePassionId(filters.passionId, passionLookup) ??
    normalizeRawPassionValue(filters.passionId);
  const canonicalPassionName = canonicalPassionId
    ? passionLookup.nameById.get(canonicalPassionId) ?? canonicalPassionId
    : null;
  const passionFilterValues = uniqueNonEmpty([
    canonicalPassionId,
    canonicalPassionName,
    filters.passionId,
  ]);

  const [
    portalChallenges,
    talentChallenges,
    tryItSessions,
    incubatorProjects,
    projectTrackers,
  ] = await Promise.all([
    hasSource(sourceTypes, "PORTAL_CHALLENGE")
      ? prisma.challenge
        .findMany({
          where: {
            ...(includeDraft
              ? {}
              : { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } }),
            ...(passionFilterValues.length > 0
              ? { passionArea: { in: passionFilterValues } }
              : {}),
          },
          orderBy: [{ status: "asc" }, { endDate: "asc" }],
          include: {
            participants: {
              where: { studentId: userId },
              take: 1,
              select: { status: true, daysCompleted: true, totalProgress: true },
            },
          },
          take: limit,
        })
        .catch(() => [])
      : Promise.resolve([]),
    hasSource(sourceTypes, "TALENT_CHALLENGE")
      ? prisma.talentChallenge
        .findMany({
          where: {
            ...(includeDraft ? {} : { isActive: true }),
            ...(passionFilterValues.length > 0
              ? { passionIds: { hasSome: passionFilterValues } }
              : {}),
          },
          orderBy: [{ order: "asc" }, { id: "desc" }],
          take: limit,
        })
        .catch(() => [])
      : Promise.resolve([]),
    hasSource(sourceTypes, "TRY_IT_SESSION")
      ? prisma.tryItSession
        .findMany({
          where: {
            ...(includeDraft ? {} : { isActive: true }),
            ...(passionFilterValues.length > 0
              ? { passionId: { in: passionFilterValues } }
              : {}),
          },
          orderBy: [{ order: "asc" }, { createdAt: "desc" }],
          take: limit,
        })
        .catch(() => [])
      : Promise.resolve([]),
    hasSource(sourceTypes, "INCUBATOR_PROJECT")
      ? prisma.incubatorProject
        .findMany({
          where: roleSet.has("ADMIN") || roleSet.has("INSTRUCTOR") || roleSet.has("MENTOR")
            ? {
              ...(passionFilterValues.length > 0
                ? { passionArea: { in: passionFilterValues } }
                : {}),
            }
            : {
              studentId: userId,
              ...(passionFilterValues.length > 0
                ? { passionArea: { in: passionFilterValues } }
                : {}),
            },
          orderBy: { updatedAt: "desc" },
          take: limit,
        })
        .catch(() => [])
      : Promise.resolve([]),
    hasSource(sourceTypes, "PROJECT_TRACKER")
      ? prisma.projectTracker
        .findMany({
          where: {
            studentId: userId,
            ...(passionFilterValues.length > 0
              ? { passionId: { in: passionFilterValues } }
              : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: limit,
        })
        .catch(() => [])
      : Promise.resolve([]),
  ]);

  const items: ActivityItem[] = [];

  for (const challenge of portalChallenges) {
    const myParticipation = challenge.participants[0];
    const challengePassionId =
      resolvePassionId(challenge.passionArea, passionLookup) ??
      normalizeRawPassionValue(challenge.passionArea);
    const challengePassionName =
      resolvePassionName(challenge.passionArea, passionLookup) ??
      normalizeRawPassionValue(challenge.passionArea);
    const lifecycle: ActivityItem["status"] =
      challenge.status === "DRAFT"
        ? "DRAFT"
        : myParticipation?.status === "COMPLETED"
          ? "COMPLETED"
          : myParticipation?.status === "ACTIVE"
            ? "IN_PROGRESS"
            : "ACTIVE";

    items.push({
      id: challenge.id,
      sourceType: "PORTAL_CHALLENGE",
      passionId: challengePassionId,
      passionName: challengePassionName,
      title: challenge.title,
      description: challenge.description,
      difficulty: normalizeDifficulty(
        challenge.type === "DAILY" ? "EASY" : challenge.type === "THIRTY_DAY" ? "HARD" : "MEDIUM"
      ),
      status: lifecycle,
      xp: challenge.xpReward,
      durationMinutes: challenge.type === "DAILY" ? 20 : null,
      links: {
        primary: `/challenges/${challenge.id}`,
        secondary: "/challenges",
      },
      audience: ["STUDENT", "INSTRUCTOR", "ADMIN"],
      tags: [challenge.type, challengePassionName || "GENERAL"],
      updatedAt: challenge.updatedAt,
      metadata: {
        challengeType: challenge.type,
        submissionRequired: challenge.submissionRequired,
        showLeaderboard: challenge.showLeaderboard,
      },
    });
  }

  for (const talent of talentChallenges) {
    const primaryPassion = resolvePrimaryPassion(talent.passionIds, passionLookup);
    const passionTags = uniqueNonEmpty(
      talent.passionIds.map(
        (passion) =>
          resolvePassionName(passion, passionLookup) ?? normalizeRawPassionValue(passion)
      )
    );

    items.push({
      id: talent.id,
      sourceType: "TALENT_CHALLENGE",
      passionId: primaryPassion.passionId,
      passionName: primaryPassion.passionName,
      title: talent.title,
      description: talent.description,
      difficulty: normalizeDifficulty(talent.difficulty),
      status: talent.isActive ? "ACTIVE" : "ARCHIVED",
      xp: talent.difficulty === "HARD" ? 40 : talent.difficulty === "MEDIUM" ? 25 : 15,
      durationMinutes: talent.estimatedMinutes ?? null,
      links: {
        primary: "/challenges",
        secondary: "/activities",
      },
      audience: ["STUDENT", "INSTRUCTOR", "ADMIN"],
      tags: ["DISCOVERY", ...(passionTags.length > 0 ? passionTags : ["GENERAL"])],
      updatedAt: now,
      metadata: {
        materialsNeeded: talent.materialsNeeded,
        videoUrl: talent.videoUrl,
      },
    });
  }

  for (const session of tryItSessions) {
    const sessionPassionId =
      resolvePassionId(session.passionId, passionLookup) ??
      normalizeRawPassionValue(session.passionId);
    const sessionPassionName =
      resolvePassionName(session.passionId, passionLookup) ??
      normalizeRawPassionValue(session.passionId);
    items.push({
      id: session.id,
      sourceType: "TRY_IT_SESSION",
      passionId: sessionPassionId,
      passionName: sessionPassionName,
      title: session.title,
      description: session.description,
      difficulty: "EASY",
      status: session.isActive ? "ACTIVE" : "ARCHIVED",
      xp: 10,
      durationMinutes: session.duration ?? null,
      links: {
        primary: `/discover/try-it/${session.id}`,
        secondary: "/discover/try-it",
      },
      audience: ["STUDENT", "PARENT", "INSTRUCTOR", "ADMIN"],
      tags: ["DISCOVERY", sessionPassionName || "GENERAL"],
      updatedAt: session.createdAt,
      metadata: {
        presenter: session.presenter,
        materialsNeeded: session.materialsNeeded,
      },
    });
  }

  for (const project of incubatorProjects) {
    const isComplete = project.currentPhase === "SHOWCASE" && project.showcaseComplete;
    const incubatorPassionId =
      resolvePassionId(project.passionArea, passionLookup) ??
      normalizeRawPassionValue(project.passionArea);
    const incubatorPassionName =
      resolvePassionName(project.passionArea, passionLookup) ??
      normalizeRawPassionValue(project.passionArea);
    items.push({
      id: project.id,
      sourceType: "INCUBATOR_PROJECT",
      passionId: incubatorPassionId,
      passionName: incubatorPassionName,
      title: project.title,
      description: project.description,
      difficulty: project.currentPhase === "BUILDING" ? "HARD" : "ADVANCED",
      status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      xp: INCUBATOR_PHASE_XP[project.currentPhase] ?? 25,
      durationMinutes: null,
      links: {
        primary: `/incubator/project/${project.id}`,
        secondary: "/incubator",
      },
      audience: ["STUDENT", "MENTOR", "INSTRUCTOR", "ADMIN"],
      tags: ["INCUBATOR", project.currentPhase, incubatorPassionName || "GENERAL"],
      updatedAt: project.updatedAt,
      metadata: {
        phase: project.currentPhase,
        cohortId: project.cohortId,
        studentId: project.studentId,
      },
    });
  }

  for (const project of projectTrackers) {
    const projectPassionId =
      resolvePassionId(project.passionId, passionLookup) ??
      normalizeRawPassionValue(project.passionId);
    const projectPassionName =
      resolvePassionName(project.passionId, passionLookup) ??
      normalizeRawPassionValue(project.passionId);
    items.push({
      id: project.id,
      sourceType: "PROJECT_TRACKER",
      passionId: projectPassionId,
      passionName: projectPassionName,
      title: project.title,
      description: project.description || "Track your passion project progress.",
      difficulty: project.status === "PLANNING" ? "MEDIUM" : "HARD",
      status:
        project.status === "COMPLETED"
          ? "COMPLETED"
          : project.status === "CANCELLED"
            ? "ARCHIVED"
            : "IN_PROGRESS",
      xp: 25,
      durationMinutes: null,
      links: {
        primary: "/projects/tracker",
        secondary: "/incubator",
      },
      audience: ["STUDENT", "MENTOR", "INSTRUCTOR", "ADMIN"],
      tags: ["PROJECT", project.status, projectPassionName || "GENERAL"],
      updatedAt: project.updatedAt,
      metadata: {
        visibility: project.visibility,
        status: project.status,
      },
    });
  }

  const filtered = canonicalPassionId
    ? items.filter(
      (item) =>
        item.passionId === canonicalPassionId ||
        normalizeToken(item.passionName) === normalizeToken(canonicalPassionName)
    )
    : items;

  filtered.sort((a, b) => {
    const statusPriority: Record<ActivityItem["status"], number> = {
      IN_PROGRESS: 0,
      ACTIVE: 1,
      DRAFT: 2,
      COMPLETED: 3,
      ARCHIVED: 4,
    };
    const statusDiff = statusPriority[a.status] - statusPriority[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const sliced = filtered.slice(0, limit);
  const countsBySource = SOURCE_TYPES.reduce((acc, source) => {
    acc[source] = sliced.filter((item) => item.sourceType === source).length;
    return acc;
  }, {} as Record<ActivitySourceType, number>);

  return {
    items: sliced,
    countsBySource,
  };
}

export async function getRecommendedActivitiesForUser(
  userId: string,
  limit = 4
): Promise<ActivityItem[]> {
  const result = await getActivityFeedForUser(userId, { limit: Math.max(limit * 5, 20) });
  return result.items
    .filter((item) => item.status === "IN_PROGRESS" || item.status === "ACTIVE")
    .slice(0, limit);
}
