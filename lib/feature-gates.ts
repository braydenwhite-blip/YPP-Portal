"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeRoleSet, requireAnyRole } from "@/lib/authorization";
import {
  FEATURE_KEYS,
  FEATURE_KEY_DEFAULTS,
  type FeatureKey,
  type FeatureUserContext,
} from "@/lib/feature-gate-constants";

type ApplicableFeatureScope = "USER" | "CHAPTER" | "ROLE" | "GLOBAL";
type FeatureRuleSnapshot = Map<FeatureKey, Partial<Record<ApplicableFeatureScope, boolean>>>;
type FeatureRuleForSnapshot = {
  featureKey: string;
  enabled: boolean;
  scope: string;
  userId?: string | null;
  chapterId?: string | null;
  role?: string | null;
};

const FEATURE_RULE_PRECEDENCE: ApplicableFeatureScope[] = [
  "USER",
  "CHAPTER",
  "ROLE",
  "GLOBAL",
];

function isKnownFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEYS.includes(value as FeatureKey);
}

function isMissingFeatureGateTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as { code?: string; meta?: { table?: string } };
  return (
    prismaError.code === "P2021" &&
    typeof prismaError.meta?.table === "string" &&
    (prismaError.meta.table === "FeatureGateRule" ||
      prismaError.meta.table === "public.FeatureGateRule")
  );
}

function rethrowFeatureGateSetupError(error: unknown): never {
  if (isMissingFeatureGateTableError(error)) {
    throw new Error(
      "Feature gates are not enabled in this database yet. Run `prisma migrate deploy` and try again."
    );
  }
  throw error;
}

function activeWindowWhere(now: Date): Prisma.FeatureGateRuleWhereInput {
  return {
    AND: [
      {
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      {
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    ],
  };
}

async function resolveUserContext(
  userContext: FeatureUserContext
): Promise<{ userId?: string; chapterId: string | null; roleSet: Set<string> }> {
  const hasContext = Boolean(
    userContext.chapterId !== undefined ||
      (userContext.roles && userContext.roles.length > 0) ||
      userContext.primaryRole
  );

  if (!userContext.userId || hasContext) {
    return {
      userId: userContext.userId,
      chapterId: userContext.chapterId ?? null,
      roleSet: normalizeRoleSet(userContext.roles ?? [], userContext.primaryRole ?? null),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userContext.userId },
    select: {
      chapterId: true,
      primaryRole: true,
      roles: { select: { role: true } },
    },
  });

  return {
    userId: userContext.userId,
    chapterId: user?.chapterId ?? null,
    roleSet: normalizeRoleSet(user?.roles ?? [], user?.primaryRole ?? null),
  };
}

function defaultFeatureEnabled(featureKey: FeatureKey): boolean {
  return FEATURE_KEY_DEFAULTS[featureKey];
}

async function resolveFeatureRuleValue(
  featureKey: FeatureKey,
  userContext: FeatureUserContext
): Promise<boolean> {
  const snapshot = await resolveFeatureRuleSnapshot(userContext);
  return resolveFeatureEnabledFromSnapshot(featureKey, snapshot);
}

async function resolveFeatureRuleSnapshot(
  userContext: FeatureUserContext
): Promise<FeatureRuleSnapshot> {
  const now = new Date();
  const context = await resolveUserContext(userContext);
  const roles = Array.from(context.roleSet);
  const scopeFilters: Prisma.FeatureGateRuleWhereInput[] = [{ scope: "GLOBAL" }];

  if (context.userId) {
    scopeFilters.push({
      scope: "USER",
      userId: context.userId,
    });
  }

  if (context.chapterId) {
    scopeFilters.push({
      scope: "CHAPTER",
      chapterId: context.chapterId,
    });
  }

  if (roles.length > 0) {
    scopeFilters.push({
      scope: "ROLE",
      role: { in: roles as any },
    });
  }

  const rules = await prisma.featureGateRule.findMany({
    where: {
      ...activeWindowWhere(now),
      featureKey: { in: [...FEATURE_KEYS] },
      OR: scopeFilters,
    },
    select: {
      featureKey: true,
      enabled: true,
      scope: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return buildFeatureRuleSnapshot(rules);
}

function buildFeatureRuleSnapshot(rules: FeatureRuleForSnapshot[]): FeatureRuleSnapshot {
  const snapshot: FeatureRuleSnapshot = new Map();

  for (const rule of rules) {
    if (!isKnownFeatureKey(rule.featureKey)) {
      continue;
    }

    const bucket = snapshot.get(rule.featureKey) ?? {};
    const scope = rule.scope as ApplicableFeatureScope;

    if (bucket[scope] !== undefined) {
      continue;
    }

    bucket[scope] = rule.enabled;
    snapshot.set(rule.featureKey, bucket);
  }

  return snapshot;
}

function ruleAppliesToContext(
  rule: FeatureRuleForSnapshot,
  context: { userId?: string; chapterId: string | null; roleSet: Set<string> }
): boolean {
  switch (rule.scope) {
    case "GLOBAL":
      return true;
    case "USER":
      return Boolean(context.userId && rule.userId === context.userId);
    case "CHAPTER":
      return Boolean(context.chapterId && rule.chapterId === context.chapterId);
    case "ROLE":
      return Boolean(rule.role && context.roleSet.has(rule.role));
    default:
      return false;
  }
}

function resolveFeatureEnabledFromSnapshot(
  featureKey: FeatureKey,
  snapshot: FeatureRuleSnapshot
): boolean {
  const bucket = snapshot.get(featureKey);
  if (!bucket) {
    return defaultFeatureEnabled(featureKey);
  }

  for (const scope of FEATURE_RULE_PRECEDENCE) {
    const enabled = bucket[scope];
    if (enabled !== undefined) {
      return enabled;
    }
  }

  return defaultFeatureEnabled(featureKey);
}

export async function isFeatureEnabledForUser(
  featureKey: string,
  userContext: FeatureUserContext
): Promise<boolean> {
  if (!isKnownFeatureKey(featureKey)) {
    return true;
  }

  try {
    return await resolveFeatureRuleValue(featureKey, userContext);
  } catch (error) {
    if (isMissingFeatureGateTableError(error)) {
      return defaultFeatureEnabled(featureKey);
    }
    throw error;
  }
}

export async function getEnabledFeatureKeysForUser(
  userContext: FeatureUserContext
): Promise<FeatureKey[]> {
  try {
    const snapshot = await resolveFeatureRuleSnapshot(userContext);

    return FEATURE_KEYS.filter((featureKey) =>
      resolveFeatureEnabledFromSnapshot(featureKey, snapshot)
    );
  } catch (error) {
    if (isMissingFeatureGateTableError(error)) {
      return FEATURE_KEYS.filter((featureKey) => defaultFeatureEnabled(featureKey));
    }
    throw error;
  }
}

export async function getEnabledFeatureKeysForUsers(
  userContexts: FeatureUserContext[]
): Promise<Map<string, FeatureKey[]>> {
  const result = new Map<string, FeatureKey[]>();
  if (userContexts.length === 0) {
    return result;
  }

  const contexts = await Promise.all(userContexts.map(resolveUserContext));
  const contextsByUserId = contexts.filter(
    (context): context is { userId: string; chapterId: string | null; roleSet: Set<string> } =>
      Boolean(context.userId)
  );

  if (contextsByUserId.length === 0) {
    return result;
  }

  const userIds = Array.from(new Set(contextsByUserId.map((context) => context.userId)));
  const chapterIds = Array.from(
    new Set(
      contextsByUserId
        .map((context) => context.chapterId)
        .filter((chapterId): chapterId is string => Boolean(chapterId))
    )
  );
  const roles = Array.from(
    new Set(contextsByUserId.flatMap((context) => Array.from(context.roleSet)))
  );

  const scopeFilters: Prisma.FeatureGateRuleWhereInput[] = [{ scope: "GLOBAL" }];
  if (userIds.length > 0) {
    scopeFilters.push({ scope: "USER", userId: { in: userIds } });
  }
  if (chapterIds.length > 0) {
    scopeFilters.push({ scope: "CHAPTER", chapterId: { in: chapterIds } });
  }
  if (roles.length > 0) {
    scopeFilters.push({ scope: "ROLE", role: { in: roles as any } });
  }

  try {
    const rules = await prisma.featureGateRule.findMany({
      where: {
        ...activeWindowWhere(new Date()),
        featureKey: { in: [...FEATURE_KEYS] },
        OR: scopeFilters,
      },
      select: {
        featureKey: true,
        enabled: true,
        scope: true,
        userId: true,
        chapterId: true,
        role: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    for (const context of contextsByUserId) {
      const snapshot = buildFeatureRuleSnapshot(
        rules.filter((rule) => ruleAppliesToContext(rule, context))
      );
      result.set(
        context.userId,
        FEATURE_KEYS.filter((featureKey) =>
          resolveFeatureEnabledFromSnapshot(featureKey, snapshot)
        )
      );
    }
  } catch (error) {
    if (!isMissingFeatureGateTableError(error)) {
      throw error;
    }

    const defaults = FEATURE_KEYS.filter((featureKey) => defaultFeatureEnabled(featureKey));
    for (const context of contextsByUserId) {
      result.set(context.userId, defaults);
    }
  }

  return result;
}

function revalidateFeatureGateSurfaces() {
  revalidatePath("/activities");
  revalidatePath("/challenges");
  revalidatePath("/incubator");
  revalidatePath("/world");
  revalidatePath("/lesson-plans");
  revalidatePath("/instructor/workspace");
  revalidatePath("/instructor/class-settings");
  revalidatePath("/instructor/parent-feedback");
  revalidatePath("/interviews");
  revalidatePath("/admin/feature-gates");
  revalidatePath("/admin/rollout-comms");
}

export async function listFeatureGateRules(featureKey?: string) {
  await requireAnyRole(["ADMIN"]);

  try {
    return await prisma.featureGateRule.findMany({
      where: featureKey && isKnownFeatureKey(featureKey) ? { featureKey } : {},
      include: {
        chapter: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ featureKey: "asc" }, { scope: "asc" }, { updatedAt: "desc" }],
      take: 300,
    });
  } catch (error) {
    if (isMissingFeatureGateTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function setChapterFeatureGateRule(formData: FormData) {
  const sessionUser = await requireAnyRole(["ADMIN"]);

  const featureKey = String(formData.get("featureKey") || "").trim();
  const chapterId = String(formData.get("chapterId") || "").trim();
  const enabled = String(formData.get("enabled") || "true") === "true";
  const note = String(formData.get("note") || "").trim() || null;

  if (!isKnownFeatureKey(featureKey)) {
    throw new Error("Invalid feature key.");
  }
  if (!chapterId) {
    throw new Error("Chapter is required.");
  }

  try {
    const existing = await prisma.featureGateRule.findFirst({
      where: {
        featureKey,
        scope: "CHAPTER",
        chapterId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (existing) {
      await prisma.featureGateRule.update({
        where: { id: existing.id },
        data: {
          enabled,
          note,
          updatedById: sessionUser.id,
        },
      });
    } else {
      await prisma.featureGateRule.create({
        data: {
          featureKey,
          scope: "CHAPTER",
          chapterId,
          enabled,
          note,
          createdById: sessionUser.id,
          updatedById: sessionUser.id,
        },
      });
    }
  } catch (error) {
    rethrowFeatureGateSetupError(error);
  }

  revalidateFeatureGateSurfaces();
}

export async function setGlobalFeatureGateRule(formData: FormData) {
  const sessionUser = await requireAnyRole(["ADMIN"]);

  const featureKey = String(formData.get("featureKey") || "").trim();
  const enabled = String(formData.get("enabled") || "true") === "true";
  const note = String(formData.get("note") || "").trim() || null;

  if (!isKnownFeatureKey(featureKey)) {
    throw new Error("Invalid feature key.");
  }

  try {
    const existing = await prisma.featureGateRule.findFirst({
      where: {
        featureKey,
        scope: "GLOBAL",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (existing) {
      await prisma.featureGateRule.update({
        where: { id: existing.id },
        data: {
          enabled,
          note,
          updatedById: sessionUser.id,
        },
      });
    } else {
      await prisma.featureGateRule.create({
        data: {
          featureKey,
          scope: "GLOBAL",
          enabled,
          note,
          createdById: sessionUser.id,
          updatedById: sessionUser.id,
        },
      });
    }
  } catch (error) {
    rethrowFeatureGateSetupError(error);
  }

  revalidateFeatureGateSurfaces();
}

export async function setUserFeatureGateRule(formData: FormData) {
  const sessionUser = await requireAnyRole(["ADMIN"]);

  const featureKey = String(formData.get("featureKey") || "").trim();
  const userId = String(formData.get("userId") || "").trim();
  const enabled = String(formData.get("enabled") || "true") === "true";
  const note = String(formData.get("note") || "").trim() || null;

  if (!isKnownFeatureKey(featureKey)) {
    throw new Error("Invalid feature key.");
  }
  if (!userId) {
    throw new Error("User is required.");
  }

  try {
    const existing = await prisma.featureGateRule.findFirst({
      where: {
        featureKey,
        scope: "USER",
        userId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (existing) {
      await prisma.featureGateRule.update({
        where: { id: existing.id },
        data: {
          enabled,
          note,
          updatedById: sessionUser.id,
        },
      });
    } else {
      await prisma.featureGateRule.create({
        data: {
          featureKey,
          scope: "USER",
          userId,
          enabled,
          note,
          createdById: sessionUser.id,
          updatedById: sessionUser.id,
        },
      });
    }
  } catch (error) {
    rethrowFeatureGateSetupError(error);
  }

  revalidateFeatureGateSurfaces();
}

export async function deleteFeatureGateRule(formData: FormData) {
  await requireAnyRole(["ADMIN"]);
  const ruleId = String(formData.get("ruleId") || "").trim();
  if (!ruleId) {
    throw new Error("Missing rule id.");
  }

  try {
    await prisma.featureGateRule.delete({
      where: { id: ruleId },
    });
  } catch (error) {
    rethrowFeatureGateSetupError(error);
  }

  revalidateFeatureGateSurfaces();
}
