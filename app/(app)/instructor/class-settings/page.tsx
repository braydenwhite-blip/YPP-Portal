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
import { computePublishReadiness } from "@/lib/class-publish-readiness";
import { PublishReadinessChecklist } from "@/components/classes/publish-readiness-checklist";
import { isActionTrackerEnabled, isOperationsHubEnabled } from "@/lib/feature-flags";
import {
  getActionsForEntity,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import { canCreateAction } from "@/lib/people-strategy/action-permissions";
import { getMenteeSupport } from "@/lib/people-strategy/connections";
import { LinkedActionsPanel } from "@/components/people-strategy/linked-actions-panel";

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

  // People Strategy Operating System — class connections, shown only when
  // managing an existing offering. Double-flagged + additive: the linked-action
  // read is tracker-gated and visibility-filtered for this viewer, so an
  // instructor sees only actions they're part of and the "create" CTA appears
  // only for officer-tier roles (canCreateAction).
  const operationsEnabled = isOperationsHubEnabled() && isActionTrackerEnabled();
  const viewer = {
    id: session.user.id,
    roles: session.user.roles ?? [],
    primaryRole: session.user.primaryRole ?? null,
    adminSubtypes: session.user.adminSubtypes ?? [],
  };
  let classLinkedActions: ActionItemWithRelations[] = [];
  let myMentor: Awaited<ReturnType<typeof getMenteeSupport>> = null;
  if (operationsEnabled && offering) {
    [classLinkedActions, myMentor] = await Promise.all([
      getActionsForEntity("CLASS_OFFERING", offering.id, viewer),
      getMenteeSupport(session.user.id),
    ]);
  }
  const canCreateTrackerAction = canCreateAction(viewer);

  const offeringReadiness = offering
    ? computePublishReadiness({
        title: offering.title,
        description: offering.template?.description,
        instructorId: offering.instructorId,
        startDate: offering.startDate,
        endDate: offering.endDate,
        meetingDays: offering.meetingDays,
        meetingTime: offering.meetingTime,
        capacity: offering.capacity,
        deliveryMode: offering.deliveryMode,
        locationName: offering.locationName,
        locationAddress: offering.locationAddress,
        zoomLink: offering.zoomLink,
        sessionCount: offering.sessions.length,
        approvalStatus: offering.approval?.status ?? "NOT_REQUESTED",
        grandfatheredTrainingExemption: offering.grandfatheredTrainingExemption,
        editHref: `/instructor/class-settings?offering=${offering.id}`,
        reviewHref: `/instructor/class-settings?offering=${offering.id}`,
      })
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

      {operationsEnabled && offering && (
        <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
          <section className="card">
            <h2 className="section-title" style={{ margin: "0 0 10px" }}>
              Your mentor support
            </h2>
            {myMentor ? (
              <p style={{ margin: 0, fontSize: 13 }}>
                Your mentor is{" "}
                <strong>{myMentor.mentor.name ?? myMentor.mentor.email}</strong>. Reach
                out to them if you need help getting this class ready.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                You don&apos;t have an active mentor yet. Your chapter lead can connect
                you with one.
              </p>
            )}
          </section>

          <LinkedActionsPanel
            actions={classLinkedActions}
            heading="Actions for this class"
            createHref={`/actions/new?relatedType=CLASS_OFFERING&relatedId=${offering.id}`}
            createLabel="Create action for this class"
            canCreate={canCreateTrackerAction}
            emptyHint="No actions are linked to this class yet."
          />
        </div>
      )}

      {offeringReadiness && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: "0 0 4px" }}>
            Publish readiness
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)" }}>
            What this class still needs before it can go live for students.
          </p>
          <PublishReadinessChecklist readiness={offeringReadiness} />
        </section>
      )}

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
