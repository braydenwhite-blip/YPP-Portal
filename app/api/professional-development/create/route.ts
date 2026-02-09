import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";
  if (!isInstructor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const type = formData.get("type") as string;
  const provider = formData.get("provider") as string | null;
  const date = formData.get("date") as string;
  const hours = formData.get("hours") as string | null;

  await prisma.professionalDevelopment.create({
    data: {
      instructorId: session.user.id,
      title,
      type: type as any,
      provider: provider || null,
      date: new Date(date),
      hours: hours ? parseFloat(hours) : null
    }
  });

  redirect("/instructor/professional-development");
}
