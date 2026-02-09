import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string | null;
  const location = formData.get("location") as string | null;
  const chapterId = formData.get("chapterId") as string | null;
  const capacity = formData.get("capacity") as string | null;
  const isPublic = formData.get("isPublic") === "true";

  await prisma.event.create({
    data: {
      title,
      description: description || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      location: location || null,
      chapterId: chapterId || null,
      capacity: capacity ? parseInt(capacity) : null,
      isPublic
    }
  });

  redirect("/admin/events");
}
