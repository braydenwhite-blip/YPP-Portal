import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  buildChapterCalendarIcs,
  getChapterByPublicSlug,
  getChapterCalendarEntries,
  slugifyChapterName,
} from "@/lib/chapter-calendar";
import { normalizeRoleList } from "@/lib/authorization";

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapterId = searchParams.get("chapterId");
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");
  const publicOnly = searchParams.get("public") === "1";

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
      start: new Date(),
      end: addDays(new Date(), 180),
      includeInternal: false,
      subscribedChapterIds: [],
    });

    return new NextResponse(buildChapterCalendarIcs(entries, `${chapter.name} Public Calendar`), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slugifyChapterName(chapter.name)}-public.ics"`,
      },
    });
  }

  let userId: string | null = null;

  if (token) {
    const subscription = await prisma.chapterCalendarSubscription.findFirst({
      where: {
        chapterId: chapter.id,
        feedToken: token,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Invalid feed token" }, { status: 401 });
    }

    userId = subscription.userId;
  } else {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const viewer = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { roles: { select: { role: true } } },
    });

    if (!viewer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const viewerRoles = normalizeRoleList(viewer.roles, viewer.primaryRole);
    const isAdmin = viewerRoles.includes("ADMIN");
    if (!isAdmin && viewer.chapterId !== chapter.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    userId = viewer.id;
  }

  const entries = await getChapterCalendarEntries({
    chapterId: chapter.id,
    start: new Date(),
    end: addDays(new Date(), 180),
    includeInternal: true,
    userId,
    subscribedChapterIds: [chapter.id],
  });

  return new NextResponse(buildChapterCalendarIcs(entries, `${chapter.name} Chapter Calendar`), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugifyChapterName(chapter.name)}-chapter.ics"`,
    },
  });
}
