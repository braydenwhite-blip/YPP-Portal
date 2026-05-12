import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Allowlist of chapter names that are open for applicant-facing signup right
// now. For the Summer 2026 launch this is Scarsdale only. Other chapters can
// continue to exist in the database for historical or internal purposes
// without appearing in the applicant signup dropdown.
const APPLICANT_VISIBLE_CHAPTER_NAMES = ["Scarsdale"];

export async function GET() {
  const chapters = await prisma.chapter.findMany({
    where: {
      isPublic: true,
      name: { in: APPLICANT_VISIBLE_CHAPTER_NAMES },
    },
    select: { id: true, name: true, city: true, region: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(chapters);
}
