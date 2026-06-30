/**
 * Chapter-aware partner permissions (Partner Automation, Phase 1).
 *
 * Fixes the core gap: partner mutations were ADMIN-only, so Chapter Presidents
 * couldn't run their own partner pipeline. These guards let:
 *   - national leadership (ADMIN / STAFF / Leadership / SUPER_ADMIN) operate
 *     every partner, and
 *   - a Chapter President operate only partners attached to the chapter they
 *     lead.
 * Built on the existing chapter-access conventions (`getChapterViewerContext` /
 * `requireChapterManager`) so it stays consistent with the rest of the portal.
 */

import { prisma } from "@/lib/prisma";
import {
  getChapterViewerContext,
  isChapterLeadership,
  type ChapterViewerContext,
} from "@/lib/chapters/access";
import { hasRole, type SessionUser } from "@/lib/authorization-roles";
import type { Prisma } from "@prisma/client";

export type PartnerScope = {
  user: SessionUser;
  isLeadership: boolean;
  /** The chapter a CP leads (null for leadership-only viewers). */
  ledChapterId: string | null;
};

/** Resolve the current viewer's partner scope (one chapter for a CP, all for leadership). */
export async function getPartnerScope(): Promise<PartnerScope> {
  const ctx: ChapterViewerContext = await getChapterViewerContext();
  return { user: ctx.user, isLeadership: ctx.isLeadership, ledChapterId: ctx.ledChapterId };
}

/**
 * Pure predicate: may this user manage partners for `chapterId`? Leadership can
 * manage any chapter (including unassigned / global). A CP can manage only the
 * chapter they lead. Safe to use in derived UI state.
 */
export function canManagePartnerForChapter(
  user: SessionUser,
  chapterId: string | null,
  ledChapterId: string | null
): boolean {
  if (isChapterLeadership(user)) return true;
  if (!chapterId || ledChapterId !== chapterId) return false;
  // Defense in depth: only a Chapter President may manage via the led-chapter path.
  return hasRole(user.roles, "CHAPTER_PRESIDENT", user.primaryRole);
}

/**
 * Guard a partner mutation scoped to a chapter (create, import). Pass for
 * leadership, or for the CP of exactly `chapterId`. Throws otherwise.
 */
export async function requireChapterPartnerAccess(
  chapterId: string | null
): Promise<PartnerScope> {
  const scope = await getPartnerScope();
  if (scope.isLeadership) return scope;
  if (chapterId && scope.ledChapterId === chapterId) return scope;
  throw new Error("Unauthorized");
}

export type PartnerAccess = PartnerScope & {
  partner: { id: string; chapterId: string | null };
};

/**
 * Guard a mutation on an existing partner. Loads the partner's chapter and
 * enforces the same rule. Throws "Partner not found" / "Unauthorized".
 */
export async function requirePartnerAccess(partnerId: string): Promise<PartnerAccess> {
  const scope = await getPartnerScope();
  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, archivedAt: null },
    select: { id: true, chapterId: true },
  });
  if (!partner) throw new Error("Partner not found");
  if (scope.isLeadership) return { ...scope, partner };
  if (partner.chapterId && scope.ledChapterId === partner.chapterId) {
    return { ...scope, partner };
  }
  throw new Error("Unauthorized");
}

/**
 * The `where` clause that scopes a partner list to what the viewer may see:
 * everything (active) for leadership, the led chapter only for a CP. A CP with
 * no chapter sees nothing.
 */
export function partnerScopeWhere(scope: PartnerScope): Prisma.PartnerWhereInput {
  if (scope.isLeadership) return { archivedAt: null };
  return { archivedAt: null, chapterId: scope.ledChapterId ?? "__none__" };
}
