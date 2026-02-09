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

  // Create anonymous feedback (no userId stored for anonymity)
  await prisma.anonymousFeedback.create({
    data: {
      category,
      type,
      content,
      submittedAt: new Date()
    }
  });

  redirect("/feedback/anonymous?submitted=true");
}
