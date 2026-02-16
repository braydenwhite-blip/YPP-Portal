import { PositionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HiringActor = {
  id: string;
  chapterId: string | null;
  roles: string[];
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

  return {
    id: user.id,
    chapterId: user.chapterId,
    roles: user.roles.map((role) => role.role),
  };
}

export function isAdmin(actor: HiringActor): boolean {
  return actor.roles.includes("ADMIN");
}

export function isChapterLead(actor: HiringActor): boolean {
  return actor.roles.includes("CHAPTER_LEAD");
}

export function assertAdminOrChapterLead(actor: HiringActor) {
  if (!isAdmin(actor) && !isChapterLead(actor)) {
    throw new Error("Unauthorized - Admin or Chapter Lead access required");
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
    throw new Error("Chapter Lead account is missing chapter assignment.");
  }

  if (!chapterId || chapterId !== actor.chapterId) {
    throw new Error("Chapter Leads can only manage hiring for their own chapter.");
  }
}

export function canChapterLeadDecidePositionType(type: PositionType): boolean {
  return ["INSTRUCTOR", "MENTOR", "STAFF", "CHAPTER_PRESIDENT"].includes(type);
}

export function assertCanMakeChapterDecision(
  actor: HiringActor,
  type: PositionType,
  chapterId: string | null
) {
  if (isAdmin(actor)) {
    return;
  }

  if (!isChapterLead(actor)) {
    throw new Error("Unauthorized");
  }

  if (!actor.chapterId || !chapterId || actor.chapterId !== chapterId) {
    throw new Error("Chapter Leads can only decide hiring outcomes in their own chapter.");
  }

  if (!canChapterLeadDecidePositionType(type)) {
    throw new Error("Chapter Leads cannot decide this position type.");
  }
}
