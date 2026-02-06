import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const where: Record<string, unknown> = {};

  if (start && end) {
    where.startDate = { gte: new Date(start) };
    where.endDate = { lte: new Date(end) };
    // Also include events that span across the range
    where.OR = [
      { startDate: { gte: new Date(start), lte: new Date(end) } },
      { endDate: { gte: new Date(start), lte: new Date(end) } },
      { AND: [{ startDate: { lte: new Date(start) } }, { endDate: { gte: new Date(end) } }] },
    ];
    delete where.startDate;
    delete where.endDate;
  }

  try {
    const events = await prisma.event.findMany({
      where,
      include: { chapter: { select: { name: true } } },
      orderBy: { startDate: "asc" },
      take: 100,
    });

    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
