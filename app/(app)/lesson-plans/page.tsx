import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LessonPlanBuilder from "./lesson-plan-builder";

export default async function LessonPlansPage({
  searchParams,
}: {
  searchParams?: Promise<{ templateId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  const isInstructor =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_LEAD");

  if (!isInstructor) {
    redirect("/");
  }

  const selectedTemplateId = ((await searchParams)?.templateId ?? "").trim();

  const [plans, courses, templates] = await Promise.all([
    prisma.lessonPlan.findMany({
      where: roles.includes("ADMIN")
        ? {}
        : { authorId: session!.user.id },
      include: {
        activities: { orderBy: { sortOrder: "asc" } },
        author: { select: { name: true } },
        classTemplate: { select: { title: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.course.findMany({
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.classTemplate.findMany({
      where: roles.includes("ADMIN")
        ? {}
        : {
            OR: [{ createdById: session!.user.id }, { isPublished: true }],
          },
      select: {
        id: true,
        title: true,
        interestArea: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const serializedPlans = plans.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    courseId: p.courseId,
    classTemplateId: p.classTemplateId,
    classTemplateTitle: p.classTemplate?.title ?? null,
    totalMinutes: p.totalMinutes,
    authorName: p.author.name,
    isTemplate: p.isTemplate,
    updatedAt: p.updatedAt.toISOString(),
    activities: p.activities.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      type: a.type,
      durationMin: a.durationMin,
      sortOrder: a.sortOrder,
      resources: a.resources,
      notes: a.notes,
      })),
  }));

  const serializedTemplates = templates.map((template) => ({
    id: template.id,
    title: template.title,
    interestArea: template.interestArea,
    createdByName: template.createdBy.name,
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Lesson Plan Builder</h1>
          <p className="page-subtitle">
            Build structured class sessions with timed activity blocks
          </p>
        </div>
      </div>

      <LessonPlanBuilder
        plans={serializedPlans}
        courses={courses}
        templates={serializedTemplates}
        initialTemplateId={selectedTemplateId}
      />
    </div>
  );
}
