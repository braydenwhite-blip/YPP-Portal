import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Allowlist of chapters open for applicant-facing signup right now. For the
// Summer 2026 launch this is Scarsdale only. Other chapters can continue to
// exist in the database for historical or internal purposes without
// appearing in the applicant signup dropdown.
const APPLICANT_VISIBLE_CHAPTERS = [
  { name: "Scarsdale", city: "Scarsdale", region: "Northeast" },
] as const;
const APPLICANT_VISIBLE_CHAPTER_NAMES = APPLICANT_VISIBLE_CHAPTERS.map((c) => c.name);

export async function GET() {
  // Self-heal the allowlist: in environments where the seed script never ran
  // (or where the row exists but is flagged isPublic=false), the dropdown
  // would otherwise be empty and applicants couldn't pick a chapter. Make
  // sure every allowlisted chapter exists and is public before we query.
  for (const chapter of APPLICANT_VISIBLE_CHAPTERS) {
    const existing = await prisma.chapter.findFirst({
      where: { name: chapter.name },
      select: { id: true, isPublic: true },
    });
    if (!existing) {
      await prisma.chapter.create({
        data: { name: chapter.name, city: chapter.city, region: chapter.region, isPublic: true },
      });
    } else if (!existing.isPublic) {
      await prisma.chapter.update({ where: { id: existing.id }, data: { isPublic: true } });
    }
  }

  const chapters = await prisma.chapter.findMany({
    where: {
      isPublic: true,
      archivedAt: null,
      name: { in: APPLICANT_VISIBLE_CHAPTER_NAMES },
    },
    select: { id: true, name: true, city: true, region: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(chapters);
}
