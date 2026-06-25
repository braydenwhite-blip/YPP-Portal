// Authorization for the chapter operating system. Two tiers:
//  - "Chapter leadership" (national): ADMIN / STAFF / Leadership subtype — manage
//    every chapter.
//  - "Chapter manager" (local): the Chapter President of a specific chapter —
//    manage only their own chapter.

import { requireSessionUser } from "@/lib/authorization";
import { hasAnyRole, hasAnyAdminSubtype, type SessionUser } from "@/lib/authorization-roles";
import { prisma } from "@/lib/prisma";

export type ChapterViewerContext = {
  user: SessionUser;
  isLeadership: boolean;
  // The chapter this viewer leads as Chapter President, if any.
  ledChapterId: string | null;
};

/** National leadership who can manage every chapter (not a single-chapter CP). */
export function isChapterLeadership(user: SessionUser): boolean {
  return (
    hasAnyRole(user.roles, ["ADMIN", "STAFF"]) ||
    hasAnyAdminSubtype(user.adminSubtypes, ["LEADERSHIP", "SUPER_ADMIN"])
  );
}

/** Resolve what the current viewer is allowed to do with chapters. */
export async function getChapterViewerContext(): Promise<ChapterViewerContext> {
  const user = await requireSessionUser();
  const isLeadership = isChapterLeadership(user);

  let ledChapterId: string | null = null;
  if (!isLeadership && hasAnyRole(user.roles, ["CHAPTER_PRESIDENT"])) {
    // Prefer an explicit president link; fall back to the user's chapter
    // membership for chapters provisioned before presidentId was set.
    const led = await prisma.chapter.findFirst({
      where: { presidentId: user.id, archivedAt: null },
      select: { id: true },
    });
    if (led) {
      ledChapterId = led.id;
    } else {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { chapterId: true },
      });
      ledChapterId = dbUser?.chapterId ?? null;
    }
  }

  return { user, isLeadership, ledChapterId };
}

/**
 * Guard a chapter mutation: pass for national leadership, or for the Chapter
 * President of exactly this chapter. Throws "Unauthorized" otherwise.
 */
export async function requireChapterManager(
  chapterId: string
): Promise<{ user: SessionUser; isLeadership: boolean }> {
  const ctx = await getChapterViewerContext();
  if (ctx.isLeadership) return { user: ctx.user, isLeadership: true };
  if (ctx.ledChapterId && ctx.ledChapterId === chapterId) {
    return { user: ctx.user, isLeadership: false };
  }
  throw new Error("Unauthorized");
}

/** Guard a national leadership-only chapter surface (command center, analytics). */
export async function requireChapterLeadership(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!isChapterLeadership(user)) throw new Error("Unauthorized");
  return user;
}
