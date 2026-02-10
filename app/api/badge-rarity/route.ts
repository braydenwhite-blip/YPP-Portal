import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cron job to recalculate badge rarity tiers
// POST /api/badge-rarity (protected by CRON_SECRET)
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const totalStudents = await prisma.user.count({
      where: { primaryRole: "STUDENT" },
    });

    if (totalStudents === 0) {
      return NextResponse.json({ message: "No students found" });
    }

    const badges = await prisma.badge.findMany({
      where: { isActive: true },
      include: { _count: { select: { studentBadges: true } } },
    });

    let updated = 0;

    for (const badge of badges) {
      const awarded = badge._count.studentBadges;
      const pct = (awarded / totalStudents) * 100;

      // Determine rarity tier based on percentage of students who have it
      let tier: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
      if (pct > 50) tier = "COMMON";
      else if (pct > 25) tier = "UNCOMMON";
      else if (pct > 10) tier = "RARE";
      else if (pct > 3) tier = "EPIC";
      else if (pct > 0.5) tier = "LEGENDARY";
      else tier = "MYTHIC";

      await prisma.badgeRarity.upsert({
        where: { badgeId: badge.id },
        create: {
          badgeId: badge.id,
          badgeName: badge.name,
          totalAwarded: awarded,
          totalStudents,
          rarityPercentage: pct,
          rarityTier: tier,
        },
        update: {
          badgeName: badge.name,
          totalAwarded: awarded,
          totalStudents,
          rarityPercentage: pct,
          rarityTier: tier,
        },
      });

      updated++;
    }

    return NextResponse.json({
      message: `Updated rarity for ${updated} badges`,
      totalStudents,
    });
  } catch (error: any) {
    console.error("Badge rarity update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "badge-rarity" });
}
