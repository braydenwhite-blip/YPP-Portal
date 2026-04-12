import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { normalizeRoleList } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: { select: { role: true } } },
  });
  const roles = user ? normalizeRoleList(user.roles, user.primaryRole) : [];
  const isAdmin = roles.includes("ADMIN");
  const chapterId = user?.chapterId ?? null;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const where: Record<string, unknown> = {
    isCancelled: false,
  };

  if (!isAdmin) {
    where.OR = [
      { visibility: "PUBLIC" },
      ...(chapterId ? [{ chapterId, visibility: "INTERNAL" }] : []),
    ];
  }

  if (start && end) {
    const existingOr = Array.isArray(where.OR) ? where.OR : [];
    where.AND = [
      {
        OR: [
          { startDate: { gte: new Date(start), lte: new Date(end) } },
          { endDate: { gte: new Date(start), lte: new Date(end) } },
          { AND: [{ startDate: { lte: new Date(start) } }, { endDate: { gte: new Date(end) } }] },
        ],
      },
    ];
    if (existingOr.length > 0) {
      where.OR = existingOr;
    }
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
