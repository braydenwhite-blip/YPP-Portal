import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deliverBulkNotifications } from "@/lib/notification-delivery";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const formData = await request.formData();
  const hoursBefore = Number(String(formData.get("hoursBefore") || "24"));
  const now = new Date();
  const upperBound = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      isCancelled: false,
      startDate: {
        gte: now,
        lte: upperBound,
      },
    },
    include: {
      chapter: { select: { name: true } },
      rsvps: {
        where: { status: "GOING" },
        select: { userId: true },
      },
    },
    take: 50,
  });

  const notifications = events.flatMap((event) =>
    event.rsvps.map((rsvp) => ({
      userId: rsvp.userId,
      type: "EVENT_REMINDER" as const,
      title: `${event.title} is coming up`,
      body: `${event.title}${event.chapter?.name ? ` for ${event.chapter.name}` : ""} starts at ${event.startDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}.`,
      link: `/my-chapter/calendar?eventId=${event.id}`,
    }))
  );

  await deliverBulkNotifications(notifications);

  return NextResponse.redirect(new URL("/admin/reminders", request.url));
}
