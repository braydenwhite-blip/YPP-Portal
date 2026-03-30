import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getChapterByPublicSlug, getChapterCalendarEntries } from "@/lib/chapter-calendar";

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

async function getSessionViewer() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: { select: { role: true } } },
  });

  if (!user) return null;

  const roles = new Set(user.roles.map((role) => role.role));
  return {
    user,
    isAdmin: roles.has("ADMIN"),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapterId = searchParams.get("chapterId");
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");
  const publicOnly = searchParams.get("public") === "1";
  const start = searchParams.get("start") ? new Date(searchParams.get("start") as string) : new Date();
  const end = searchParams.get("end") ? new Date(searchParams.get("end") as string) : addDays(start, 120);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const chapter =
    chapterId
      ? await prisma.chapter.findUnique({ where: { id: chapterId } })
      : slug
        ? await getChapterByPublicSlug(slug)
        : null;

  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }

  if (publicOnly) {
    const entries = await getChapterCalendarEntries({
      chapterId: chapter.id,
      start,
      end,
      includeInternal: false,
      subscribedChapterIds: [],
    });
    return NextResponse.json(entries);
  }

  if (token) {
    const subscription = await prisma.chapterCalendarSubscription.findFirst({
      where: {
        feedToken: token,
        chapterId: chapter.id,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Invalid feed token" }, { status: 401 });
    }

    const entries = await getChapterCalendarEntries({
      chapterId: chapter.id,
      start,
      end,
      includeInternal: true,
      userId: subscription.userId,
      subscribedChapterIds: [chapter.id],
    });
    return NextResponse.json(entries);
  }

  const viewer = await getSessionViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!viewer.isAdmin && viewer.user.chapterId !== chapter.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subscription = await prisma.chapterCalendarSubscription.findUnique({
    where: {
      chapterId_userId: {
        chapterId: chapter.id,
        userId: viewer.user.id,
      },
    },
  });

  const entries = await getChapterCalendarEntries({
    chapterId: chapter.id,
    start,
    end,
    includeInternal: true,
    userId: viewer.user.id,
    subscribedChapterIds: subscription ? [chapter.id] : [],
  });

  return NextResponse.json(entries);
}
