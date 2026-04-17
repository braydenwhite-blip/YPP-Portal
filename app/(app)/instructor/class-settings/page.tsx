import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ClassSettingsClient } from "./client";
import {
  getClassTemplateCapabilities,
  getClassTemplateSelect,
} from "@/lib/class-template-compat";
import { getInstructorReadiness } from "@/lib/instructor-readiness";

export default async function InstructorClassSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; offering?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR") && !roles.includes("CHAPTER_PRESIDENT")) {
    redirect("/");
  }

  const params = await searchParams;
  const capabilities = await getClassTemplateCapabilities();
  const instructorProfile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      chapterId: true,
    },
  });
  const chapterWhere = roles.includes("ADMIN")
    ? undefined
    : instructorProfile?.chapterId
      ? { id: instructorProfile.chapterId }
      : { id: "__no_chapter__" };

  // Get templates for offering creation
  const [templates, chapters, readiness, pathwayOptions] = await Promise.all([
    prisma.classTemplate.findMany({
      where: {
        OR: [
          { createdById: session.user.id },
          { isPublished: true },
        ],
      },
      select: getClassTemplateSelect({
        includeLearnerFit: capabilities.hasLearnerFitFields,
        includeWorkflow: capabilities.hasReviewWorkflow,
      }),
      orderBy: { title: "asc" },
    }),
    prisma.chapter.findMany({
      where: chapterWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    getInstructorReadiness(session.user.id),
    prisma.pathway.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        interestArea: true,
        steps: {
          where: { classTemplateId: { not: null } },
          select: {
            id: true,
            stepOrder: true,
            classTemplateId: true,
            classTemplate: {
              select: {
                title: true,
              },
            },
            title: true,
          },
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // If editing an offering, load it
  let offering = null;
  if (params.offering) {
    const accessCheck = await prisma.classOffering.findUnique({
      where: { id: params.offering },
      select: {
        id: true,
        instructorId: true,
      },
    });
    if (!accessCheck) {
      redirect("/instructor/class-settings");
    }
    if (accessCheck.instructorId !== session.user.id && !roles.includes("ADMIN")) {
      redirect("/");
    }

    offering = await prisma.classOffering.findUnique({
      where: { id: params.offering },
      include: {
        template: {
          select: getClassTemplateSelect({
            includeLearnerFit: capabilities.hasLearnerFitFields,
            includeWorkflow: capabilities.hasReviewWorkflow,
          }),
        },
        approval: true,
        pathwayStep: {
          select: {
            id: true,
            pathwayId: true,
          },
        },
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
          learnerFitLabel: t.learnerFitLabel,
          learnerFitDescription: t.learnerFitDescription,
          durationWeeks: t.durationWeeks,
          sessionsPerWeek: t.sessionsPerWeek,
          maxStudents: t.maxStudents,
          deliveryModes: t.deliveryModes,
        }))}
        chapters={chapters}
        selectedTemplateId={selectedTemplate?.id || null}
        readiness={readiness}
        pathwayOptions={pathwayOptions.map((pathway) => ({
          id: pathway.id,
          name: pathway.name,
          interestArea: pathway.interestArea,
          steps: pathway.steps.map((step) => ({
            id: step.id,
            stepOrder: step.stepOrder,
            classTemplateId: step.classTemplateId || "",
            title: step.classTemplate?.title ?? step.title ?? `Step ${step.stepOrder}`,
          })),
        }))}
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
          introVideoTitle: offering.introVideoTitle || "",
          introVideoDescription: offering.introVideoDescription || "",
          introVideoProvider: offering.introVideoProvider || "YOUTUBE",
          introVideoUrl: offering.introVideoUrl || "",
          introVideoThumbnail: offering.introVideoThumbnail || "",
          capacity: offering.capacity,
          send24HrReminder: offering.send24HrReminder,
          send1HrReminder: offering.send1HrReminder,
          status: offering.status,
          chapterId: offering.chapterId || "",
          pathwayId: offering.pathwayStep?.pathwayId || "",
          pathwayStepId: offering.pathwayStepId || "",
          semester: offering.semester || "",
          enrolledCount: offering.enrollments.filter((e) => e.status === "ENROLLED").length,
          approvalStatus: offering.approval?.status || "NOT_REQUESTED",
          approvalRequestNotes: offering.approval?.requestNotes || "",
          approvalReviewNotes: offering.approval?.reviewNotes || "",
          grandfatheredTrainingExemption: offering.grandfatheredTrainingExemption,
        } : null}
      />
    </div>
  );
}
