import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public endpoint used by signup flows. Returns only chapters that have been
// explicitly published as public so internal/test/private chapters are not
// enumerable by unauthenticated clients.
export async function GET() {
  const chapters = await prisma.chapter.findMany({
    where: { isPublic: true },
    select: { id: true, name: true, city: true, region: true },
    orderBy: { name: "asc" }
  });
  return NextResponse.json(chapters);
}
