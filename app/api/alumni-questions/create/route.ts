import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user?.id || !session.user.roles.includes("STUDENT")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const subject = formData.get("subject") as string;
    const question = formData.get("question") as string;

    if (!subject || !question) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find an available advisor (simple round-robin for now)
    const advisor = await prisma.collegeAdvisor.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });

    const alumniQuestion = await prisma.alumniQuestion.create({
      data: {
        studentId: session.user.id,
        advisorId: advisor?.userId || null,
        subject: subject.trim(),
        question: question.trim(),
        status: advisor ? "ASSIGNED" : "PENDING"
      }
    });

    return NextResponse.redirect(new URL(`/ask-alum/${alumniQuestion.id}`, request.url));
  } catch (error) {
    console.error("Error creating alumni question:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}
