import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { EventType } from "@prisma/client";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = formData.get("title");
  const description = formData.get("description");
  const eventTypeRaw = formData.get("eventType");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const location = formData.get("location");
  const chapterId = formData.get("chapterId");
  const isAlumniOnly = formData.get("isAlumniOnly") === "true" || formData.get("isAlumniOnly") === "on";

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }
  if (typeof startDate !== "string" || !startDate) {
    return NextResponse.json({ error: "Missing startDate" }, { status: 400 });
  }
  if (typeof endDate !== "string" || !endDate) {
    return NextResponse.json({ error: "Missing endDate" }, { status: 400 });
  }
  if (typeof eventTypeRaw !== "string" || !Object.values(EventType).includes(eventTypeRaw as EventType)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }
  const eventType = eventTypeRaw as EventType;

  await prisma.event.create({
    data: {
      title,
      description: typeof description === "string" ? description : "",
      eventType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location: typeof location === "string" && location ? location : null,
      chapterId: typeof chapterId === "string" && chapterId ? chapterId : null,
      isAlumniOnly
    }
  });

  redirect("/admin/events");
}
