import { prisma } from "@/lib/prisma";

/**
 * Returns true if a session's roles entitle the user to see the Chair Queue
 * badge. Mirrors `canSeeChairQueue` from chapter-hiring-permissions but without
 * the full HiringActor lookup — safe to call from the shell layout.
 */
export function shouldSeeChairQueueBadge(roles: readonly string[]): boolean {
  return roles.includes("ADMIN") || roles.includes("HIRING_CHAIR");
}

/**
 * Cheap server-side count of instructor applications currently awaiting a
 * chair decision. Used by the shell layout to populate `badges.chairQueueCount`
 * for ADMIN and HIRING_CHAIR users. Falls back to 0 when the table is missing
 * (P2021) so a missing migration never crashes the app shell.
 */
export async function getChairQueueBadgeCount(roles: readonly string[]): Promise<number> {
  if (!shouldSeeChairQueueBadge(roles)) return 0;
  try {
    return await prisma.instructorApplication.count({
      where: { status: "CHAIR_REVIEW" },
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2021" || code === "P2022") return 0;
    console.error("[chair-queue-badge] count failed", error);
    return 0;
  }
}
