import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const chapters = await prisma.chapter.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  return NextResponse.json(chapters);
}
