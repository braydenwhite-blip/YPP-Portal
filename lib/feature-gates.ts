"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeRoleSet, requireAnyRole } from "@/lib/authorization";

export const FEATURE_KEYS = [
  "ACTIVITY_HUB",
  "CHALLENGES",
  "INCUBATOR",
  "PASSION_WORLD",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureUserContext = {
  userId?: string;
  chapterId?: string | null;
  roles?: string[];
  primaryRole?: string | null;
};

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

export async function isFeatureEnabledForUser(
  featureKey: string,
  userContext: FeatureUserContext
): Promise<boolean> {
  if (!isKnownFeatureKey(featureKey)) {
    return true;
  }

  const now = new Date();

  try {
    const context = await resolveUserContext(userContext);
    const commonWhere = activeWindowWhere(now);

    if (context.userId) {
      const userRule = await prisma.featureGateRule.findFirst({
        where: {
          ...commonWhere,
          featureKey,
          scope: "USER",
          userId: context.userId,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });

      if (userRule) return userRule.enabled;
    }

    if (context.chapterId) {
      const chapterRule = await prisma.featureGateRule.findFirst({
        where: {
          ...commonWhere,
          featureKey,
          scope: "CHAPTER",
          chapterId: context.chapterId,
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });

      if (chapterRule) return chapterRule.enabled;
    }

    const roles = Array.from(context.roleSet);
    if (roles.length > 0) {
      const roleRule = await prisma.featureGateRule.findFirst({
        where: {
          ...commonWhere,
          featureKey,
          scope: "ROLE",
          role: { in: roles as any },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });

      if (roleRule) return roleRule.enabled;
    }

    const globalRule = await prisma.featureGateRule.findFirst({
      where: {
        ...commonWhere,
        featureKey,
        scope: "GLOBAL",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (globalRule) return globalRule.enabled;

    return true;
  } catch (error) {
    if (isMissingFeatureGateTableError(error)) {
      return true;
    }
    throw error;
  }
}

function revalidateFeatureGateSurfaces() {
  revalidatePath("/activities");
  revalidatePath("/challenges");
  revalidatePath("/incubator");
  revalidatePath("/world");
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
