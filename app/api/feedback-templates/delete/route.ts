import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";

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
  if (!templateId) {
    return NextResponse.json({ error: "Missing template id" }, { status: 400 });
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

  await prisma.feedbackTemplate.delete({ where: { id: templateId } });

  return NextResponse.json({ success: true });
}
