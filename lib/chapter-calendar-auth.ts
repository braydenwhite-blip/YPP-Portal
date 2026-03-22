import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getChapterCalendarActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      chapter: true,
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const roles = new Set(user.roles.map((role) => role.role));
  const isAdmin = roles.has("ADMIN");
  const isChapterLead = roles.has("CHAPTER_LEAD");

  return {
    session,
    user,
    roles,
    isAdmin,
    isChapterLead,
  };
}

export async function requireChapterCalendarManager(requestedChapterId?: string | null) {
  const actor = await getChapterCalendarActor();
  if (!actor.isAdmin && !actor.isChapterLead) {
    throw new Error("Only Chapter Presidents and admins can manage chapter calendars.");
  }

  const chapterId = requestedChapterId?.trim() || actor.user.chapterId;
  if (!chapterId) {
    throw new Error("No chapter is assigned to this account.");
  }

  if (!actor.isAdmin && chapterId !== actor.user.chapterId) {
    throw new Error("You can only manage your own chapter calendar.");
  }

  return {
    ...actor,
    chapterId,
  };
}

export async function requireChapterCalendarViewer() {
  const actor = await getChapterCalendarActor();
  if (!actor.user.chapterId) {
    throw new Error("No chapter is assigned to this account.");
  }

  return {
    ...actor,
    chapterId: actor.user.chapterId,
  };
}
