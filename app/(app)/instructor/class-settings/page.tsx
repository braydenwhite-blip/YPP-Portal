import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ClassSettingsClient } from "./client";

export default async function InstructorClassSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; offering?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR") && !roles.includes("CHAPTER_LEAD")) {
    redirect("/");
  }

  const params = await searchParams;

  // Get templates for offering creation
  const templates = await prisma.classTemplate.findMany({
    where: {
      OR: [
        { createdById: session.user.id },
        { isPublished: true },
      ],
    },
    orderBy: { title: "asc" },
  });

  // Get chapters for location
  const chapters = await prisma.chapter.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true },
  });

  // If editing an offering, load it
  let offering = null;
  if (params.offering) {
    offering = await prisma.classOffering.findUnique({
      where: { id: params.offering },
      include: {
        template: true,
        sessions: { orderBy: { sessionNumber: "asc" } },
        enrollments: {
          include: { student: { select: { id: true, name: true, email: true } } },
          orderBy: { enrolledAt: "asc" },
        },
      },
    });
  }

  // Pre-select template if provided
  const selectedTemplate = params.template
    ? templates.find((t) => t.id === params.template)
    : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/instructor/curriculum-builder" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Back to Curriculum Builder
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {offering ? `Manage: ${offering.title}` : "Create Class Offering"}
          </h1>
        </div>
      </div>

      <ClassSettingsClient
        templates={templates.map((t) => ({
          id: t.id,
          title: t.title,
          interestArea: t.interestArea,
          difficultyLevel: t.difficultyLevel,
          durationWeeks: t.durationWeeks,
          sessionsPerWeek: t.sessionsPerWeek,
          maxStudents: t.maxStudents,
          deliveryModes: t.deliveryModes,
        }))}
        chapters={chapters}
        selectedTemplateId={selectedTemplate?.id || null}
        offering={offering ? {
          id: offering.id,
          templateId: offering.templateId,
          title: offering.title,
          startDate: offering.startDate.toISOString().split("T")[0],
          endDate: offering.endDate.toISOString().split("T")[0],
          meetingDays: offering.meetingDays,
          meetingTime: offering.meetingTime,
          deliveryMode: offering.deliveryMode,
          locationName: offering.locationName || "",
          locationAddress: offering.locationAddress || "",
          zoomLink: offering.zoomLink || "",
          capacity: offering.capacity,
          send24HrReminder: offering.send24HrReminder,
          send1HrReminder: offering.send1HrReminder,
          status: offering.status,
          chapterId: offering.chapterId || "",
          semester: offering.semester || "",
          enrolledCount: offering.enrollments.filter((e) => e.status === "ENROLLED").length,
        } : null}
      />
    </div>
  );
}
