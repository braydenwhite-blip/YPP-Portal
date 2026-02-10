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

  const formData = await request.formData();
  const category = formData.get("category") as string;
  const type = formData.get("type") as string;
  const content = formData.get("content") as string;

  // Store as user feedback (session is required for this endpoint).
  await prisma.userFeedback.create({
    data: {
      userId: session.user.id,
      category: category as any,
      message: content,
      page: type || null
    }
  });

  redirect("/feedback/anonymous?submitted=true");
}
