import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  getQaInstructorOnboardingEmail,
  isQaInstructorOnboardingEnabled,
} from "@/lib/qa-instructor-onboarding";

const QA_PREFIX = "qa-instructor-onboarding";
const QA_INSTRUCTOR_ID = `${QA_PREFIX}-user`;
const QA_STUDENT_IDS = [`${QA_PREFIX}-student-1`, `${QA_PREFIX}-student-2`];
const QA_TEMPLATE_ID = `${QA_PREFIX}-template`;
const QA_OFFERING_ID = `${QA_PREFIX}-offering`;
const QA_DRAFT_OFFERING_ID = `${QA_PREFIX}-draft-offering`;
const QA_COURSE_ID = `${QA_PREFIX}-course`;
const QA_LESSON_PLAN_ID = `${QA_PREFIX}-lesson-plan`;
const QA_CURRICULUM_DRAFT_ID = `${QA_PREFIX}-curriculum-draft`;
const QA_ASSIGNMENT_ID = `${QA_PREFIX}-assignment`;
const QA_DEPARTMENT_ID = `${QA_PREFIX}-department`;
const QA_ACTION_ITEM_ID = `${QA_PREFIX}-action-profile`;

type FixtureOptions = {
  prismaClient?: typeof defaultPrisma;
  passwordHash?: string;
  verifiedAt?: Date;
};

type FixtureSummary = {
  instructorEmail: string;
  instructorId: string;
  resetAt: Date;
  trainingModuleCount: number;
  upcomingSessionCount: number;
  activeOfferingCount: number;
};

type QaFixtureDb = typeof defaultPrisma;

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function atHour(base: Date, hour: number, minute = 0): Date {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

async function ensureQaInstructor(
  db: QaFixtureDb,
  passwordHash?: string,
  verifiedAt = new Date()
) {
  const email = getQaInstructorOnboardingEmail();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!existing && !passwordHash) {
    throw new Error(
      "QA instructor account is missing. Run db:seed with SEED_PASSWORD and ENABLE_QA_INSTRUCTOR_ONBOARDING=true first."
    );
  }

  const effectivePasswordHash = passwordHash ?? existing?.passwordHash;

  return db.user.upsert({
    where: { email },
    create: {
      id: QA_INSTRUCTOR_ID,
      name: "QA New Instructor",
      email,
      phone: "(555)-010-2602",
      passwordHash: effectivePasswordHash!,
      emailVerified: verifiedAt,
      primaryRole: "INSTRUCTOR",
      roles: { create: [{ role: "INSTRUCTOR" }] },
    },
    update: {
      name: "QA New Instructor",
      phone: "(555)-010-2602",
      ...(passwordHash ? { passwordHash, emailVerified: verifiedAt } : {}),
      primaryRole: "INSTRUCTOR",
      archivedAt: null,
      roles: {
        deleteMany: {},
        create: [{ role: "INSTRUCTOR" }],
      },
    },
    select: { id: true, email: true },
  });
}

async function ensureDemoStudent(
  db: QaFixtureDb,
  index: number,
  passwordHash?: string,
  verifiedAt = new Date()
) {
  const email = `qa.instructor.onboarding.student${index + 1}@example.test`;
  return db.user.upsert({
    where: { email },
    create: {
      id: QA_STUDENT_IDS[index],
      name: index === 0 ? "Maya Chen" : "Leo Rivera",
      email,
      passwordHash: passwordHash ?? "QA_DEMO_STUDENT_NOT_LOGINABLE",
      emailVerified: verifiedAt,
      primaryRole: "STUDENT",
      roles: { create: [{ role: "STUDENT" }] },
    },
    update: {
      name: index === 0 ? "Maya Chen" : "Leo Rivera",
      archivedAt: null,
      roles: {
        deleteMany: {},
        create: [{ role: "STUDENT" }],
      },
    },
    select: { id: true },
  });
}

async function ensureTrainingModules(db: QaFixtureDb) {
  const existingRequired = await db.trainingModule.findMany({
    where: { required: true, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
    take: 5,
  });

  if (existingRequired.length > 0) {
    return existingRequired.map((module) => module.id);
  }

  const fallbackModules = [
    {
      contentKey: `${QA_PREFIX}/foundations`,
      title: "QA Foundations: YPP Teaching Basics",
      description: "Fallback QA module for first-time instructor onboarding tests.",
      sortOrder: 9001,
    },
    {
      contentKey: `${QA_PREFIX}/session-readiness`,
      title: "QA Foundations: Running Your First Session",
      description: "Fallback QA module for preparing a first class session.",
      sortOrder: 9002,
    },
  ];

  const moduleIds: string[] = [];
  for (const moduleSeed of fallbackModules) {
    const module = await db.trainingModule.upsert({
      where: { contentKey: moduleSeed.contentKey },
      create: {
        ...moduleSeed,
        type: "WORKSHOP",
        required: true,
        materialUrl: "https://example.com/ypp-qa-training",
        materialNotes: "QA fallback content. Replace with real training imports when available.",
        videoUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
        videoProvider: "YOUTUBE",
        videoDuration: 180,
        estimatedMinutes: 10,
      },
      update: {
        title: moduleSeed.title,
        description: moduleSeed.description,
        archivedAt: null,
        required: true,
        videoUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
        videoProvider: "YOUTUBE",
        videoDuration: 180,
        estimatedMinutes: 10,
      },
      select: { id: true },
    });
    moduleIds.push(module.id);
  }

  return moduleIds;
}

async function clearQaProgress(db: QaFixtureDb, instructorId: string) {
  await db.videoProgress.deleteMany({ where: { userId: instructorId } });
  await db.trainingQuizAttempt.deleteMany({ where: { userId: instructorId } });
  await db.trainingCheckpointCompletion.deleteMany({ where: { userId: instructorId } });
  await db.trainingEvidenceSubmission.deleteMany({ where: { userId: instructorId } });
  await db.interactiveBeatAttempt.deleteMany({ where: { userId: instructorId } });
  await db.interactiveJourneyCompletion.deleteMany({ where: { userId: instructorId } });
  await db.notification.deleteMany({ where: { userId: instructorId } });
  await db.userProfile.deleteMany({ where: { userId: instructorId } });
}

export async function resetQaInstructorOnboardingFixture(
  options: FixtureOptions = {}
): Promise<FixtureSummary> {
  if (!isQaInstructorOnboardingEnabled()) {
    throw new Error("QA instructor onboarding is disabled for this environment.");
  }

  const now = new Date();
  const verifiedAt = options.verifiedAt ?? now;
  const db = options.prismaClient ?? defaultPrisma;
  const instructor = await ensureQaInstructor(db, options.passwordHash, verifiedAt);
  const students = await Promise.all([
    ensureDemoStudent(db, 0, options.passwordHash, verifiedAt),
    ensureDemoStudent(db, 1, options.passwordHash, verifiedAt),
  ]);

  await clearQaProgress(db, instructor.id);

  await db.onboardingProgress.upsert({
    where: { userId: instructor.id },
    create: {
      userId: instructor.id,
      currentStep: 0,
      profileCompleted: false,
      completedAt: null,
    },
    update: {
      currentStep: 0,
      profileCompleted: false,
      completedAt: null,
    },
  });

  await db.instructorProfile.upsert({
    where: { userId: instructor.id },
    create: {
      userId: instructor.id,
      lifecycleStage: "ONBOARDING",
      weeklyHoursAvail: 3,
      maxConcurrent: 1,
      readinessScore: 35,
      reliabilityScore: null,
      lastActiveAt: null,
    },
    update: {
      lifecycleStage: "ONBOARDING",
      stageEnteredAt: now,
      weeklyHoursAvail: 3,
      maxConcurrent: 1,
      readinessScore: 35,
      reliabilityScore: null,
      lastActiveAt: null,
      isOnHold: false,
    },
  });

  const moduleIds = await ensureTrainingModules(db);
  for (const moduleId of moduleIds) {
    await db.trainingAssignment.upsert({
      where: { userId_moduleId: { userId: instructor.id, moduleId } },
      create: { userId: instructor.id, moduleId, status: "NOT_STARTED" },
      update: { status: "NOT_STARTED", completedAt: null },
    });
  }

  await db.instructorInterviewGate.upsert({
    where: { instructorId: instructor.id },
    create: {
      instructorId: instructor.id,
      status: "REQUIRED",
      outcome: null,
      scheduledAt: null,
      completedAt: null,
      reviewNotes: "QA reset: first-time instructor still needs readiness interview.",
    },
    update: {
      status: "REQUIRED",
      outcome: null,
      scheduledAt: null,
      completedAt: null,
      reviewedById: null,
      reviewedAt: null,
      reviewNotes: "QA reset: first-time instructor still needs readiness interview.",
    },
  });

  await db.course.upsert({
    where: { id: QA_COURSE_ID },
    create: {
      id: QA_COURSE_ID,
      title: "QA Creative Coding Foundations",
      description: "A resettable demo course assigned to the QA new instructor account.",
      format: "LEVELED",
      level: "LEVEL_101",
      interestArea: "Creative Coding",
      isVirtual: true,
      maxEnrollment: 12,
      leadInstructorId: instructor.id,
    },
    update: {
      leadInstructorId: instructor.id,
      title: "QA Creative Coding Foundations",
      description: "A resettable demo course assigned to the QA new instructor account.",
      isVirtual: true,
    },
  });

  const template = await db.classTemplate.upsert({
    where: { id: QA_TEMPLATE_ID },
    create: {
      id: QA_TEMPLATE_ID,
      title: "Creative Coding Foundations",
      description:
        "Students learn creative coding through small visual projects and reflection.",
      interestArea: "Creative Coding",
      difficultyLevel: "LEVEL_101",
      prerequisites: [],
      weeklyTopics: [
        { week: 1, topic: "Shapes, color, and creative constraints" },
        { week: 2, topic: "Animation loops and interaction" },
      ],
      learningOutcomes: [
        "Explain how simple code choices affect a visual project.",
        "Build and share a tiny interactive sketch.",
      ],
      estimatedHours: 6,
      durationWeeks: 4,
      sessionsPerWeek: 1,
      minStudents: 2,
      maxStudents: 12,
      idealSize: 8,
      deliveryModes: ["VIRTUAL"],
      targetAgeGroup: "11-14",
      classDurationMin: 60,
      submissionStatus: "APPROVED",
      isPublished: true,
      createdById: instructor.id,
    },
    update: {
      title: "Creative Coding Foundations",
      description:
        "Students learn creative coding through small visual projects and reflection.",
      submissionStatus: "APPROVED",
      isPublished: true,
      createdById: instructor.id,
    },
  });

  const offering = await db.classOffering.upsert({
    where: { id: QA_OFFERING_ID },
    create: {
      id: QA_OFFERING_ID,
      templateId: template.id,
      instructorId: instructor.id,
      title: "Creative Coding Foundations - QA Cohort",
      startDate: addDays(now, 2),
      endDate: addDays(now, 30),
      meetingDays: ["Tuesday"],
      meetingTime: "16:00-17:00",
      deliveryMode: "VIRTUAL",
      zoomLink: "https://meet.google.com/ypp-qa-demo",
      capacity: 12,
      status: "PUBLISHED",
      semester: "QA Reset Cohort",
      grandfatheredTrainingExemption: true,
    },
    update: {
      instructorId: instructor.id,
      startDate: addDays(now, 2),
      endDate: addDays(now, 30),
      meetingDays: ["Tuesday"],
      meetingTime: "16:00-17:00",
      deliveryMode: "VIRTUAL",
      zoomLink: "https://meet.google.com/ypp-qa-demo",
      status: "PUBLISHED",
      grandfatheredTrainingExemption: true,
    },
  });

  await db.classOffering.upsert({
    where: { id: QA_DRAFT_OFFERING_ID },
    create: {
      id: QA_DRAFT_OFFERING_ID,
      templateId: template.id,
      instructorId: instructor.id,
      title: "Creative Coding Foundations - Draft Extension",
      startDate: addDays(now, 21),
      endDate: addDays(now, 49),
      meetingDays: ["Thursday"],
      meetingTime: "17:00-18:00",
      deliveryMode: "VIRTUAL",
      capacity: 10,
      status: "DRAFT",
      semester: "QA Reset Cohort",
      grandfatheredTrainingExemption: true,
    },
    update: {
      instructorId: instructor.id,
      startDate: addDays(now, 21),
      endDate: addDays(now, 49),
      status: "DRAFT",
      grandfatheredTrainingExemption: true,
    },
  });

  await db.classOfferingApproval.upsert({
    where: { offeringId: offering.id },
    create: {
      offeringId: offering.id,
      status: "APPROVED",
      requestedById: instructor.id,
      requestNotes: "QA seeded offering approval.",
      requestedAt: now,
      reviewedAt: now,
      reviewNotes: "Approved for QA onboarding fixture.",
    },
    update: {
      status: "APPROVED",
      requestedById: instructor.id,
      requestNotes: "QA seeded offering approval.",
      requestedAt: now,
      reviewedAt: now,
      reviewNotes: "Approved for QA onboarding fixture.",
    },
  });

  const sessionSeeds = [
    { number: 1, offset: -3, topic: "Warm-up: Make Code Visible" },
    { number: 2, offset: 2, topic: "Color Systems and Creative Constraints" },
    { number: 3, offset: 6, topic: "Loops, Motion, and Student Choice" },
  ];

  for (const seed of sessionSeeds) {
    await db.classSession.upsert({
      where: {
        offeringId_sessionNumber: {
          offeringId: offering.id,
          sessionNumber: seed.number,
        },
      },
      create: {
        offeringId: offering.id,
        sessionNumber: seed.number,
        date: atHour(addDays(now, seed.offset), 16),
        startTime: "16:00",
        endTime: "17:00",
        topic: seed.topic,
        description: "QA fixture session for first-time instructor testing.",
        learningOutcomes: ["Students can name the session goal and next step."],
        milestone: seed.number === 1 ? "First class kickoff" : "Project progress",
      },
      update: {
        date: atHour(addDays(now, seed.offset), 16),
        startTime: "16:00",
        endTime: "17:00",
        topic: seed.topic,
        description: "QA fixture session for first-time instructor testing.",
        learningOutcomes: ["Students can name the session goal and next step."],
        isCancelled: false,
        cancelReason: null,
      },
    });
  }

  for (const student of students) {
    await db.classEnrollment.upsert({
      where: {
        studentId_offeringId: {
          studentId: student.id,
          offeringId: offering.id,
        },
      },
      create: {
        studentId: student.id,
        offeringId: offering.id,
        status: "ENROLLED",
      },
      update: {
        status: "ENROLLED",
        droppedAt: null,
        completedAt: null,
        sessionsAttended: 0,
      },
    });
  }

  try {
    const assignment = await db.classAssignment.upsert({
      where: { id: QA_ASSIGNMENT_ID },
      create: {
        id: QA_ASSIGNMENT_ID,
        offeringId: offering.id,
        createdById: instructor.id,
        title: "Mini Project: Animate a Favorite Shape",
        description:
          "Students submit a tiny sketch and explain one creative choice they made.",
        type: "PROJECT",
        suggestedDueDate: addDays(now, 1),
        instructions:
          "Share your sketch link and one sentence about your design choice.",
        referenceLinks: ["https://example.com/ypp-creative-coding-reference"],
        exampleWorkUrls: [],
        encouragementNote: "Keep it small, playful, and easy to explain.",
        isPublished: true,
      },
      update: {
        offeringId: offering.id,
        createdById: instructor.id,
        suggestedDueDate: addDays(now, 1),
        isPublished: true,
      },
    });

    await db.classAssignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: students[0].id,
        },
      },
      create: {
        assignmentId: assignment.id,
        studentId: students[0].id,
        workUrl: "https://example.com/student-demo-sketch",
        workText:
          "I used warm colors because they made the animation feel energetic.",
        submittedAt: addDays(now, -1),
        status: "SUBMITTED",
      },
      update: {
        workUrl: "https://example.com/student-demo-sketch",
        workText:
          "I used warm colors because they made the animation feel energetic.",
        submittedAt: addDays(now, -1),
        status: "SUBMITTED",
        instructorFeedback: null,
        celebratoryNote: null,
        suggestionsForNext: null,
        feedbackGivenAt: null,
      },
    });
  } catch (error) {
    console.warn(
      "[qa-instructor-onboarding] Skipped class assignment fixture because the local database is missing assignment schema support.",
      error
    );
  }

  await db.lessonPlan.upsert({
    where: { id: QA_LESSON_PLAN_ID },
    create: {
      id: QA_LESSON_PLAN_ID,
      title: "QA First Session Plan",
      description: "Draft plan used by the resettable QA instructor fixture.",
      classTemplateId: template.id,
      totalMinutes: 60,
      authorId: instructor.id,
    },
    update: {
      title: "QA First Session Plan",
      classTemplateId: template.id,
      totalMinutes: 60,
      authorId: instructor.id,
      updatedAt: now,
    },
  });

  await db.curriculumDraft.upsert({
    where: { id: QA_CURRICULUM_DRAFT_ID },
    create: {
      id: QA_CURRICULUM_DRAFT_ID,
      authorId: instructor.id,
      title: "Creative Coding QA Draft",
      description: "A partially started curriculum draft so the dashboard is not empty.",
      interestArea: "Creative Coding",
      outcomes: ["Students create a small visual project."],
      status: "IN_PROGRESS",
    },
    update: {
      title: "Creative Coding QA Draft",
      description: "A partially started curriculum draft so the dashboard is not empty.",
      interestArea: "Creative Coding",
      outcomes: ["Students create a small visual project."],
      status: "IN_PROGRESS",
      completedAt: null,
      submittedAt: null,
      approvedAt: null,
      updatedAt: now,
    },
  });

  await db.regularInstructorAssignment.upsert({
    where: {
      offeringId_instructorId_role: {
        offeringId: offering.id,
        instructorId: instructor.id,
        role: "LEAD",
      },
    },
    create: {
      offeringId: offering.id,
      instructorId: instructor.id,
      role: "LEAD",
      status: "FULLY_CONFIRMED",
      classTemplateId: template.id,
      offeredAt: now,
      instructorConfirmedAt: now,
      chapterConfirmedAt: now,
      instructorNote:
        "QA fixture: this is the assigned course a new instructor should see after login.",
      createdById: instructor.id,
      updatedById: instructor.id,
    },
    update: {
      status: "FULLY_CONFIRMED",
      classTemplateId: template.id,
      offeredAt: now,
      instructorConfirmedAt: now,
      chapterConfirmedAt: now,
      instructorNote:
        "QA fixture: this is the assigned course a new instructor should see after login.",
      updatedById: instructor.id,
    },
  });

  const department = await db.department.upsert({
    where: { id: QA_DEPARTMENT_ID },
    create: {
      id: QA_DEPARTMENT_ID,
      name: "QA Instructor Onboarding",
      slug: "qa-instructor-onboarding",
      description: "Resettable QA fixture data for first-time instructor testing.",
    },
    update: {
      name: "QA Instructor Onboarding",
      slug: "qa-instructor-onboarding",
      archivedAt: null,
    },
  });

  await db.actionItem.upsert({
    where: { id: QA_ACTION_ITEM_ID },
    create: {
      id: QA_ACTION_ITEM_ID,
      title: "Complete your instructor profile",
      description:
        "Fill out your bio, subject areas, and portfolio link before the first session.",
      goalCategory: "Onboarding",
      departmentId: department.id,
      status: "IN_PROGRESS",
      deadlineStart: addDays(now, 3),
      visibility: "ALL_LEADERSHIP",
      leadId: instructor.id,
      createdById: instructor.id,
      assignments: {
        create: [{ userId: instructor.id, role: "LEAD" }],
      },
    },
    update: {
      title: "Complete your instructor profile",
      description:
        "Fill out your bio, subject areas, and portfolio link before the first session.",
      goalCategory: "Onboarding",
      departmentId: department.id,
      status: "IN_PROGRESS",
      deadlineStart: addDays(now, 3),
      visibility: "ALL_LEADERSHIP",
      leadId: instructor.id,
      createdById: instructor.id,
      assignments: {
        deleteMany: {},
        create: [{ userId: instructor.id, role: "LEAD" }],
      },
      resolvedAt: null,
    },
  });

  return {
    instructorEmail: instructor.email,
    instructorId: instructor.id,
    resetAt: now,
    trainingModuleCount: moduleIds.length,
    upcomingSessionCount: sessionSeeds.filter((seed) => seed.offset >= 0).length,
    activeOfferingCount: 1,
  };
}
