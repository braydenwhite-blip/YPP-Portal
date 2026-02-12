import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Force runtime rendering so `next build` doesn't try to prerender pages that
// require auth/database access (which can fail in build environments).
export const dynamic = "force-dynamic";

// Helper to determine highest award tier from awards
function getHighestAwardTier(awards: { type: string | null }[]): string | undefined {
  const tiers = awards.map(a => a.type).filter(Boolean);
  if (tiers.some(t => t?.includes("GOLD"))) return "GOLD";
  if (tiers.some(t => t?.includes("SILVER"))) return "SILVER";
  if (tiers.some(t => t?.includes("BRONZE"))) return "BRONZE";
  return undefined;
}

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  const primaryRole = session?.user?.primaryRole ?? null;

  // Redirect to onboarding if not completed yet
  if (session?.user?.id) {
    try {
      const onboarding = await prisma.onboardingProgress.findUnique({
        where: { userId: session.user.id },
        select: { completedAt: true },
      });

      if (!onboarding?.completedAt) {
        redirect("/onboarding");
      }
    } catch (e: unknown) {
      // If the OnboardingProgress table doesn't exist yet (P2021),
      // redirect to onboarding so users still see it.
      const isPrismaError = e !== null && typeof e === "object" && "code" in e;
      if (isPrismaError && (e as { code: string }).code === "P2021") {
        redirect("/onboarding");
      }
      throw e;
    }
  }

  // Get user's highest award tier + badge counts for navigation
  let awardTier: string | undefined;
  let badges: { notifications?: number; messages?: number; approvals?: number } = {};
  if (session?.user?.id) {
    const userId = session.user.id;
    const [userWithAwards, unreadNotifications, unreadMessages, pendingApprovals] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { awards: { select: { type: true } } },
        }),
        // Unread notification count
        prisma.notification.count({
          where: { userId, isRead: false },
        }).catch(() => 0),
        // Unread messages: conversations where latest message is after user's lastReadAt
        prisma.conversationParticipant
          .findMany({
            where: { userId },
            include: {
              conversation: {
                include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
              },
            },
          })
          .then((parts: Array<{ lastReadAt: Date; conversation: { messages: Array<{ createdAt: Date; senderId: string }> } }>) =>
            parts.filter(
              (p) =>
                p.conversation.messages.length > 0 &&
                p.conversation.messages[0].createdAt > p.lastReadAt &&
                p.conversation.messages[0].senderId !== userId,
            ).length,
          )
          .catch(() => 0),
        // Pending approvals placeholder (future: parent approvals, instructor readiness, etc.)
        Promise.resolve(0),
      ]);

    awardTier = getHighestAwardTier(userWithAwards?.awards ?? []);
    badges = {
      notifications: unreadNotifications || undefined,
      messages: unreadMessages || undefined,
      approvals: pendingApprovals || undefined,
    };
  }

  return (
    <AppShell userName={session?.user?.name} roles={roles} primaryRole={primaryRole} awardTier={awardTier} badges={badges}>
      {children}
    </AppShell>
  );
}
