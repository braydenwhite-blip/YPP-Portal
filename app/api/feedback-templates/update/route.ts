import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const isInstructor = roles.includes("INSTRUCTOR") || roles.includes("ADMIN");
  if (!isInstructor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const templateId = formData.get("templateId") as string;
  const title = ((formData.get("title") as string) ?? "").trim();
  const content = ((formData.get("content") as string) ?? "").trim();
  const category = formData.get("category") as string | null;
  const isPublic = formData.get("isPublic") === "true";

  if (!templateId || !title || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.feedbackTemplate.findUnique({
    where: { id: templateId },
    select: { instructorId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (existing.instructorId !== session.user.id && !roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.feedbackTemplate.update({
    where: { id: templateId },
    data: { title, content, category: category || null, isPublic },
  });

  redirect("/instructor/feedback-templates");
}
