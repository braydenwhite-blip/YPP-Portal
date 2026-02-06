import { getServerSession } from "next-auth";
import AppShell from "@/components/app-shell";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  // Get user's highest award tier for navigation
  let awardTier: string | undefined;
  if (session?.user?.id) {
    const userWithAwards = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { awards: { select: { type: true } } }
    });
    awardTier = getHighestAwardTier(userWithAwards?.awards ?? []);
  }

  return (
    <AppShell userName={session?.user?.name} roles={roles} primaryRole={primaryRole} awardTier={awardTier}>
      {children}
    </AppShell>
  );
}
