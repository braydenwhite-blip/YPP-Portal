import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
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

  // Check onboarding status and set cookie for middleware
  if (session?.user?.id) {
    let onboardingCompleted = true;

    try {
      const onboarding = await prisma.onboardingProgress.findUnique({
        where: { userId: session.user.id },
        select: { completedAt: true },
      });
      onboardingCompleted = Boolean(onboarding?.completedAt);
    } catch (error) {
      // Temporary fallback for deployments where the onboarding migration
      // has not yet been applied in production.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        onboardingCompleted = true;
      } else {
        throw error;
      }
    }

    const cookieStore = cookies();
    if (!onboardingCompleted) {
      cookieStore.set("onboarding_completed", "false", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60, // 1 hour - re-checked on next layout render
      });
      redirect("/onboarding");
    } else {
      cookieStore.set("onboarding_completed", "true", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }
  }

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
