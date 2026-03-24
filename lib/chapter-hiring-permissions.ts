import { PositionType } from "@prisma/client";
import { getEnabledFeatureKeysForUser } from "@/lib/feature-gates";
import { prisma } from "@/lib/prisma";

export type HiringActor = {
  id: string;
  chapterId: string | null;
  roles: string[];
  featureKeys: Set<string>;
};

export async function getHiringActor(userId: string): Promise<HiringActor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      chapterId: true,
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const roles = user.roles.map((role) => role.role);
  const featureKeys = new Set(
    await getEnabledFeatureKeysForUser({
      userId: user.id,
      chapterId: user.chapterId,
      roles,
      primaryRole: null,
    })
  );

  return {
    id: user.id,
    chapterId: user.chapterId,
    roles,
    featureKeys,
  };
}

export function isAdmin(actor: HiringActor): boolean {
  return actor.roles.includes("ADMIN");
}

export function isChapterLead(actor: HiringActor): boolean {
  return actor.roles.includes("CHAPTER_PRESIDENT");
}

export function isDesignatedInterviewer(actor: HiringActor): boolean {
  return actor.featureKeys.has("INTERVIEWER");
}

export function assertAdminOrChapterLead(actor: HiringActor) {
  if (!isAdmin(actor) && !isChapterLead(actor)) {
    throw new Error("Unauthorized - Admin or Chapter President access required");
  }
}

export function assertCanManagePosition(actor: HiringActor, chapterId: string | null) {
  if (isAdmin(actor)) {
    return;
  }

  if (!isChapterLead(actor)) {
    throw new Error("Unauthorized");
  }

  if (!actor.chapterId) {
    throw new Error("Chapter President account is missing chapter assignment.");
  }

  if (!chapterId || chapterId !== actor.chapterId) {
    throw new Error("Chapter Presidents can only manage hiring for their own chapter.");
  }
}

export function canChapterLeadDecidePositionType(type: PositionType): boolean {
  return ["INSTRUCTOR", "MENTOR", "STAFF", "CHAPTER_PRESIDENT"].includes(type);
}

export function assertCanManageHiringInterviews(actor: HiringActor, chapterId: string | null) {
  if (isAdmin(actor)) {
    return;
  }

  if (!actor.chapterId || !chapterId || actor.chapterId !== chapterId) {
    throw new Error("Interview access is limited to your own chapter.");
  }

  if (isChapterLead(actor) || isDesignatedInterviewer(actor)) {
    return;
  }

  throw new Error("Unauthorized");
}

export function assertCanMakeChapterDecision(
  actor: HiringActor,
  type: PositionType,
  chapterId: string | null
) {
  if (isAdmin(actor)) {
    return;
  }

  if (!actor.chapterId || !chapterId || actor.chapterId !== chapterId) {
    throw new Error("Chapter reviewers can only decide hiring outcomes in their own chapter.");
  }

  if (!isChapterLead(actor) && !isDesignatedInterviewer(actor)) {
    throw new Error("Unauthorized");
  }

  if (!canChapterLeadDecidePositionType(type)) {
    throw new Error("This reviewer cannot decide this position type.");
  }
}
