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
  const audience = formData.get("audience") as string;
  const title = formData.get("title") as string;
  const message = formData.get("message") as string;

  // Get target users based on audience
  const where = audience === "ALL" ? {} : { primaryRole: audience as any };
  
  const users = await prisma.user.findMany({
    where,
    select: { id: true }
  });

  // Create notifications for all users
  await prisma.notification.createMany({
    data: users.map(user => ({
      userId: user.id,
      title,
      message,
      type: "ANNOUNCEMENT"
    }))
  });

  redirect("/admin/emergency-broadcast?sent=" + users.length);
}
