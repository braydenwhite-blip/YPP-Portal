import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCurriculumLessonBlueprint } from "@/lib/instructor-builder-blueprints";
import { StudioClient } from "./studio-client";
import "./studio.css";

export default async function LessonDesignStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ templateId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const hasAccess =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("APPLICANT");

  if (!hasAccess) redirect("/");

  const params = await searchParams;
  const templateId = params?.templateId?.trim() || null;

  // Load curriculum (ClassTemplate) if a templateId was provided
  let curriculum: {
    id: string;
    title: string;
    interestArea: string;
    lessons: Array<{
      index: number;
      topic: string;
      lessonGoal: string;
      warmUpHook: string;
      miniLesson: string;
      guidedPractice: string;
      independentBuild: string;
      exitTicket: string;
      materialsTools: string;
    }>;
  } | null = null;

  if (templateId) {
    const raw = await prisma.classTemplate.findFirst({
      where: roles.includes("ADMIN")
        ? { id: templateId }
        : { id: templateId, OR: [{ createdById: session.user.id }, { isPublished: true }] },
      select: {
        id: true,
        title: true,
        interestArea: true,
        weeklyTopics: true,
      },
    });

    if (raw) {
      const topics = Array.isArray(raw.weeklyTopics) ? raw.weeklyTopics : [];
      curriculum = {
        id: raw.id,
        title: raw.title,
        interestArea: raw.interestArea,
        lessons: topics.map((t, i) => {
          const b = normalizeCurriculumLessonBlueprint(t);
          return {
            index: i,
            topic: b.topic || `Lesson ${i + 1}`,
            lessonGoal: b.lessonGoal,
            warmUpHook: b.warmUpHook,
            miniLesson: b.miniLesson,
            guidedPractice: b.guidedPractice,
            independentBuild: b.independentBuild,
            exitTicket: b.exitTicket,
            materialsTools: b.materialsTools,
          };
        }),
      };
    }
  }

  // Load existing lesson plans the user has already built for this curriculum
  const existingPlans = await prisma.lessonPlan.findMany({
    where: {
      authorId: session.user.id,
      ...(curriculum ? { classTemplateId: curriculum.id } : { classTemplateId: null }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      totalMinutes: true,
      classTemplateId: true,
      isTemplate: true,
      updatedAt: true,
      activities: {
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          durationMin: true,
          sortOrder: true,
          resources: true,
          notes: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  const serializedPlans = existingPlans.map((p) => ({
    ...p,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <StudioClient
      userId={session.user.id}
      userName={session.user.name ?? "Instructor"}
      curriculum={curriculum}
      existingPlans={serializedPlans}
    />
  );
}
