import {
  ChapterAddClassButton,
  ChapterInstructorsClassroom,
  type ChapterInstructorRow,
} from "@/components/chapter/chapter-instructors-classroom";
import { getChapterInstructors } from "@/lib/chapter-actions";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { prisma } from "@/lib/prisma";
import { requirePageRoles } from "@/lib/page-guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Classes — Chapter — Pathways Portal",
};

export default async function ChapterInstructorsPage() {
  await requirePageRoles(["CHAPTER_PRESIDENT", "ADMIN"]);

  const [instructors, chapterContext, templates] = await Promise.all([
    getChapterInstructors(),
    getChapterViewerContext(),
    prisma.classTemplate.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        deliveryModes: true,
        durationWeeks: true,
        maxStudents: true,
      },
      orderBy: { title: "asc" },
      take: 100,
    }),
  ]);

  // Prefer the CP's led chapter; fall back to any instructor's chapter membership.
  const chapterId =
    chapterContext.ledChapterId ??
    instructors.find((i) => Boolean(i.chapterId))?.chapterId ??
    null;

  const locations = chapterId
    ? await prisma.partner.findMany({
        where: { chapterId, archivedAt: null },
        select: {
          id: true,
          name: true,
          location: true,
          partnerType: true,
        },
        orderBy: { name: "asc" },
      })
    : [];

  const rows: ChapterInstructorRow[] = instructors.map((instructor) => ({
    id: instructor.id,
    name: instructor.name,
    email: instructor.email,
    phone: instructor.phone ?? null,
    school: instructor.profile?.school ?? null,
    grade: instructor.profile?.grade ?? null,
    trainingComplete: instructor.trainings.filter((t) => t.status === "COMPLETE").length,
    trainingTotal: instructor.trainings.length,
    offerings: instructor.classOfferingsInstructed.map((offering) => ({
      id: offering.id,
      title: offering.title,
      status: offering.status,
      themeColor: offering.themeColor ?? null,
      deliveryMode: offering.deliveryMode ?? null,
      meetingDays: offering.meetingDays ?? [],
      meetingTime: offering.meetingTime ?? null,
      enrollmentCount: offering._count.enrollments,
    })),
  }));

  const templateOptions = templates.map((t) => ({
    id: t.id,
    title: t.title,
    deliveryModes: t.deliveryModes,
    durationWeeks: t.durationWeeks,
    maxStudents: t.maxStudents,
  }));

  const locationOptions = locations.map((l) => ({
    id: l.id,
    name: l.name,
    location: l.location,
    partnerType: l.partnerType,
  }));

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
              Classes
            </h1>
            <p className="m-0 mt-1 text-[14px] text-[#5f6368]">
              One row per instructor — open a class for the same classroom view they use.
            </p>
          </div>
          <ChapterAddClassButton
            instructors={rows}
            templates={templateOptions}
            locations={locationOptions}
            chapterId={chapterId}
          />
        </header>

        <ChapterInstructorsClassroom
          instructors={rows}
          templates={templateOptions}
          locations={locationOptions}
          chapterId={chapterId}
        />
      </div>
    </main>
  );
}
