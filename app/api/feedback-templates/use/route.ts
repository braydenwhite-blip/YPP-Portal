import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const templateId = formData.get("templateId") as string;

  // Increment usage count
  const template = await prisma.feedbackTemplate.update({
    where: { id: templateId },
    data: { usageCount: { increment: 1 } }
  });

  // Return the template content to copy to clipboard
  return NextResponse.json({ content: template.content });
}
