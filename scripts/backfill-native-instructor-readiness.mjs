#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function getFallbackReviewerId() {
  const admin = await prisma.user.findFirst({
    where: { roles: { some: { role: "ADMIN" } } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (admin) return admin.id;

  const chapterLead = await prisma.user.findFirst({
    where: { roles: { some: { role: "CHAPTER_LEAD" } } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (chapterLead) return chapterLead.id;

  const instructor = await prisma.user.findFirst({
    where: { roles: { some: { role: "INSTRUCTOR" } } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return instructor?.id ?? null;
}

async function main() {
  console.log("[backfill] Starting native instructor readiness backfill...");

  const [requiredModules, instructors, fallbackReviewerId] = await Promise.all([
    prisma.trainingModule.findMany({ where: { required: true }, select: { id: true } }),
    prisma.user.findMany({
      where: { roles: { some: { role: "INSTRUCTOR" } } },
      select: { id: true },
    }),
    getFallbackReviewerId(),
  ]);

  // 1) Seed missing required module assignments.
  const assignmentRows = instructors.flatMap((instructor) =>
    requiredModules.map((module) => ({
      userId: instructor.id,
      moduleId: module.id,
      status: "NOT_STARTED",
    }))
  );

  if (assignmentRows.length > 0) {
    const inserted = await prisma.trainingAssignment.createMany({
      data: assignmentRows,
      skipDuplicates: true,
    });
    console.log(`[backfill] Training assignments inserted: ${inserted.count}`);
  } else {
    console.log("[backfill] No required modules or instructors found for assignment seeding.");
  }

  // 2) Create missing interview gates for all instructors.
  let createdGateCount = 0;
  for (const instructor of instructors) {
    await prisma.instructorInterviewGate.upsert({
      where: { instructorId: instructor.id },
      create: {
        instructorId: instructor.id,
        status: "REQUIRED",
      },
      update: {},
    });
    createdGateCount += 1;
  }
  console.log(`[backfill] Ensured interview gate records for instructors: ${createdGateCount}`);

  // 3) Auto-pass gate when accepted instructor application already has interview evidence.
  const acceptedInstructorApps = await prisma.application.findMany({
    where: {
      status: "ACCEPTED",
      position: { type: "INSTRUCTOR" },
    },
    include: {
      interviewNotes: { select: { id: true } },
      interviewSlots: { select: { id: true, isConfirmed: true } },
    },
  });

  let autoPassedGates = 0;
  let requiredGates = 0;

  for (const app of acceptedInstructorApps) {
    const hasInterviewEvidence =
      app.interviewNotes.length > 0 || app.interviewSlots.some((slot) => slot.isConfirmed);

    await prisma.instructorInterviewGate.upsert({
      where: { instructorId: app.applicantId },
      create: {
        instructorId: app.applicantId,
        status: hasInterviewEvidence ? "PASSED" : "REQUIRED",
        outcome: hasInterviewEvidence ? "PASS" : null,
        completedAt: hasInterviewEvidence ? new Date() : null,
        reviewedById: hasInterviewEvidence && fallbackReviewerId ? fallbackReviewerId : null,
        reviewedAt: hasInterviewEvidence ? new Date() : null,
        reviewNotes: hasInterviewEvidence
          ? "Backfilled to PASSED from accepted application with interview evidence."
          : "Backfilled to REQUIRED from accepted application without interview evidence.",
      },
      update: {
        status: hasInterviewEvidence ? "PASSED" : "REQUIRED",
        outcome: hasInterviewEvidence ? "PASS" : null,
        completedAt: hasInterviewEvidence ? new Date() : null,
        reviewedById: hasInterviewEvidence && fallbackReviewerId ? fallbackReviewerId : null,
        reviewedAt: hasInterviewEvidence ? new Date() : null,
        reviewNotes: hasInterviewEvidence
          ? "Backfilled to PASSED from accepted application with interview evidence."
          : "Backfilled to REQUIRED from accepted application without interview evidence.",
      },
    });

    if (hasInterviewEvidence) {
      autoPassedGates += 1;
    } else {
      requiredGates += 1;
    }
  }

  console.log(`[backfill] Interview gates auto-passed from applications: ${autoPassedGates}`);
  console.log(`[backfill] Interview gates set to REQUIRED from applications: ${requiredGates}`);

  // 4) Create teaching permissions from legacy approval levels.
  const approvals = await prisma.instructorApproval.findMany({
    include: {
      levels: { select: { level: true } },
    },
  });

  let teachingPermissionCreated = 0;

  if (!fallbackReviewerId) {
    console.log(
      "[backfill] Skipped teaching permission backfill because no admin/chapter lead/instructor was found as grantor."
    );
  } else {
    for (const approval of approvals) {
      for (const level of approval.levels) {
        const existingPermission = await prisma.instructorTeachingPermission.findUnique({
          where: {
            instructorId_level: {
              instructorId: approval.instructorId,
              level: level.level,
            },
          },
          select: { id: true },
        });

        if (existingPermission) {
          continue;
        }

        await prisma.instructorTeachingPermission.create({
          data: {
            instructorId: approval.instructorId,
            level: level.level,
            grantedById: fallbackReviewerId,
            reason: "Backfilled from legacy instructor approval levels.",
          },
        });

        teachingPermissionCreated += 1;
      }
    }
  }

  console.log(`[backfill] Teaching permissions ensured from legacy approvals: ${teachingPermissionCreated}`);

  // 5) Grace-exempt offerings already published or in progress.
  const grandfathered = await prisma.classOffering.updateMany({
    where: {
      status: { in: ["PUBLISHED", "IN_PROGRESS"] },
      grandfatheredTrainingExemption: false,
    },
    data: {
      grandfatheredTrainingExemption: true,
    },
  });

  console.log(`[backfill] Offerings marked grandfathered: ${grandfathered.count}`);
  console.log("[backfill] Completed.");
}

main()
  .catch((error) => {
    console.error("[backfill] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
