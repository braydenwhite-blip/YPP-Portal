import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const canClone = roles.includes("INSTRUCTOR") || roles.includes("ADMIN") || roles.includes("CHAPTER_LEAD");
  if (!canClone) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const templateId = String(formData.get("templateId") || "").trim();
  if (!templateId) {
    redirect("/instructor/lesson-plans/templates?cloned=0&error=Missing%20template%20id");
  }

  const template = await prisma.lessonPlan.findUnique({
    where: { id: templateId },
    include: {
      activities: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!template || !template.isTemplate) {
    redirect("/instructor/lesson-plans/templates?cloned=0&error=Template%20not%20found");
  }

  await prisma.lessonPlan.create({
    data: {
      title: `${template.title} (Copy)`,
      description: template.description,
      courseId: template.courseId,
      classTemplateId: template.classTemplateId,
      totalMinutes: template.totalMinutes,
      authorId: session.user.id,
      isTemplate: false,
      activities: {
        create: template.activities.map((activity) => ({
          title: activity.title,
          description: activity.description,
          type: activity.type,
          durationMin: activity.durationMin,
          sortOrder: activity.sortOrder,
          resources: activity.resources,
          notes: activity.notes,
        })),
      },
    },
  });

  redirect("/lesson-plans?cloned=1");
}
