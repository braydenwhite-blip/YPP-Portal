import bcrypt from "bcryptjs";
import {
  AdminSubtype,
  CourseFormat,
  GoalRatingColor,
  GoalReviewStatus,
  GRTemplateStatus,
  InterviewSlotStatus,
  MentorshipGovernanceMode,
  MentorshipProgramGroup,
  MentorshipRequestKind,
  MentorshipRequestStatus,
  MentorshipRequestVisibility,
  MentorshipSessionType,
  MentorshipStatus,
  MentorCommitteeLane,
  MentorCommitteeMemberRole,
  MenteeRoleType,
  PositionType,
  PrismaClient,
  RoleType,
  TrainingModuleType,
  VideoProvider,
} from "@prisma/client";

const prisma = new PrismaClient();

const E2E_PASSWORD =
  process.env.E2E_SEED_PASSWORD ??
  process.env.SEED_PASSWORD ??
  "CodexE2E!2026";

async function ensureChapter(input: {
  name: string;
  city: string;
  region: string;
}) {
  const existing = await prisma.chapter.findFirst({
    where: { name: input.name },
  });

  if (existing) {
    return prisma.chapter.update({
      where: { id: existing.id },
      data: {
        city: input.city,
        region: input.region,
      },
    });
  }

  return prisma.chapter.create({
    data: input,
  });
}

async function ensureUser(input: {
  email: string;
  name: string;
  primaryRole: RoleType;
  chapterId?: string | null;
  phone?: string | null;
  passwordHash: string;
  roles: RoleType[];
  adminSubtypes?: AdminSubtype[];
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      primaryRole: input.primaryRole,
      chapterId: input.chapterId ?? null,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      emailVerified: new Date(),
    },
    update: {
      name: input.name,
      primaryRole: input.primaryRole,
      chapterId: input.chapterId ?? null,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      emailVerified: new Date(),
    },
  });

  await prisma.userRole.deleteMany({
    where: { userId: user.id },
  });

  await prisma.userRole.createMany({
    data: input.roles.map((role) => ({
      userId: user.id,
      role,
    })),
    skipDuplicates: true,
  });

  if (input.adminSubtypes) {
    await prisma.userAdminSubtype.deleteMany({
      where: { userId: user.id },
    });

    await prisma.userAdminSubtype.createMany({
      data: input.adminSubtypes.map((subtype, index) => ({
        userId: user.id,
        subtype,
        isDefaultOwner: index === 0,
      })),
      skipDuplicates: true,
    });
  }

  return user;
}

async function ensurePosition(input: {
  title: string;
  type: PositionType;
  chapterId: string | null;
  openedById: string;
  hiringLeadId: string;
  description: string;
}) {
  const existing = await prisma.position.findFirst({
    where: {
      title: input.title,
      type: input.type,
      chapterId: input.chapterId,
    },
  });

  if (existing) {
    return prisma.position.update({
      where: { id: existing.id },
      data: {
        openedById: input.openedById,
        hiringLeadId: input.hiringLeadId,
        description: input.description,
        isOpen: true,
        interviewRequired: true,
        visibility: "NETWORK_WIDE",
      },
    });
  }

  return prisma.position.create({
    data: {
      title: input.title,
      type: input.type,
      chapterId: input.chapterId,
      openedById: input.openedById,
      hiringLeadId: input.hiringLeadId,
      description: input.description,
      visibility: "NETWORK_WIDE",
      interviewRequired: true,
      isOpen: true,
    },
  });
}

async function ensureTrainingModule(input: {
  contentKey: string;
  title: string;
  description: string;
  type: TrainingModuleType;
  sortOrder: number;
  requiresEvidence: boolean;
  requiresQuiz: boolean;
}) {
  return prisma.trainingModule.upsert({
    where: { contentKey: input.contentKey },
    create: {
      ...input,
      required: true,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      videoProvider: VideoProvider.YOUTUBE,
      videoDuration: 600,
      passScorePct: 80,
      estimatedMinutes: 20,
    },
    update: {
      title: input.title,
      description: input.description,
      type: input.type,
      sortOrder: input.sortOrder,
      required: true,
      requiresEvidence: input.requiresEvidence,
      requiresQuiz: input.requiresQuiz,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      videoProvider: VideoProvider.YOUTUBE,
      videoDuration: 600,
      passScorePct: 80,
      estimatedMinutes: 20,
    },
  });
}

async function ensureCompletedOnboarding(userId: string) {
  return prisma.onboardingProgress.upsert({
    where: { userId },
    create: {
      userId,
      currentStep: 4,
      profileCompleted: true,
      completedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    update: {
      currentStep: 4,
      profileCompleted: true,
      completedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  const alphaChapter = await ensureChapter({
    name: "YPP E2E Alpha",
    city: "New York",
    region: "Northeast",
  });
  const betaChapter = await ensureChapter({
    name: "YPP E2E Beta",
    city: "Boston",
    region: "Northeast",
  });

  const admin = await ensureUser({
    email: "e2e.admin@ypp.test",
    name: "E2E Admin",
    primaryRole: RoleType.ADMIN,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.ADMIN, RoleType.INSTRUCTOR],
    adminSubtypes: [AdminSubtype.SUPER_ADMIN, AdminSubtype.MENTORSHIP_ADMIN],
  });
  const chapterLead = await ensureUser({
    email: "e2e.chapter.lead.alpha@ypp.test",
    name: "E2E Chapter Lead Alpha",
    primaryRole: RoleType.CHAPTER_PRESIDENT,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.CHAPTER_PRESIDENT],
  });
  const applicant = await ensureUser({
    email: "e2e.applicant.alpha@ypp.test",
    name: "E2E Applicant Alpha",
    primaryRole: RoleType.APPLICANT,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.APPLICANT],
  });
  const acceptedApplicant = await ensureUser({
    email: "e2e.accepted.alpha@ypp.test",
    name: "E2E Accepted Applicant",
    primaryRole: RoleType.APPLICANT,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.APPLICANT],
  });
  const crossChapterApplicant = await ensureUser({
    email: "e2e.cross.chapter.beta@ypp.test",
    name: "E2E Cross Chapter Applicant",
    primaryRole: RoleType.APPLICANT,
    chapterId: betaChapter.id,
    passwordHash,
    roles: [RoleType.APPLICANT],
  });
  const cpApplicant = await ensureUser({
    email: "e2e.cp.applicant.alpha@ypp.test",
    name: "E2E CP Applicant Alpha",
    primaryRole: RoleType.APPLICANT,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.APPLICANT],
  });
  const blockedInstructor = await ensureUser({
    email: "e2e.instructor.blocked.alpha@ypp.test",
    name: "E2E Instructor Blocked",
    primaryRole: RoleType.INSTRUCTOR,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.INSTRUCTOR],
  });
  const readyInstructor = await ensureUser({
    email: "e2e.instructor.ready.alpha@ypp.test",
    name: "E2E Instructor Ready",
    primaryRole: RoleType.INSTRUCTOR,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.INSTRUCTOR],
  });
  const mentor = await ensureUser({
    email: "e2e.mentor.alpha@ypp.test",
    name: "E2E Mentor Alpha",
    primaryRole: RoleType.MENTOR,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.MENTOR, RoleType.STAFF],
  });
  const monthlyFlowMentee = await ensureUser({
    email: "e2e.mentee.monthly@ypp.test",
    name: "E2E Monthly Flow Mentee",
    primaryRole: RoleType.INSTRUCTOR,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.INSTRUCTOR],
  });
  const instructorChair = await ensureUser({
    email: "e2e.chair.instructor@ypp.test",
    name: "E2E Instructor Role Chair",
    primaryRole: RoleType.INSTRUCTOR,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.INSTRUCTOR],
  });
  const committeeMember = await ensureUser({
    email: "e2e.committee.instructor@ypp.test",
    name: "E2E Instructor Committee Member",
    primaryRole: RoleType.STAFF,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.STAFF],
  });
  const capacityInstructor = await ensureUser({
    email: "e2e.instructor.capacity.alpha@ypp.test",
    name: "E2E Instructor Capacity",
    primaryRole: RoleType.INSTRUCTOR,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.INSTRUCTOR],
  });
  const quarterlyMentee = await ensureUser({
    email: "e2e.mentee.quarterly@ypp.test",
    name: "E2E Quarterly Review Mentee",
    primaryRole: RoleType.INSTRUCTOR,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.INSTRUCTOR],
  });
  const student = await ensureUser({
    email: "e2e.student.alpha@ypp.test",
    name: "E2E Student Alpha",
    primaryRole: RoleType.STUDENT,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.STUDENT],
  });
  const legacyApplicant = await ensureUser({
    email: "e2e.legacy.applicant@ypp.test",
    name: "E2E Legacy Applicant",
    primaryRole: RoleType.APPLICANT,
    chapterId: alphaChapter.id,
    passwordHash,
    roles: [RoleType.APPLICANT],
  });

  await ensureCompletedOnboarding(admin.id);
  await ensureCompletedOnboarding(chapterLead.id);
  await ensureCompletedOnboarding(blockedInstructor.id);
  await ensureCompletedOnboarding(readyInstructor.id);
  await ensureCompletedOnboarding(mentor.id);
  await ensureCompletedOnboarding(monthlyFlowMentee.id);
  await ensureCompletedOnboarding(instructorChair.id);
  await ensureCompletedOnboarding(committeeMember.id);
  await ensureCompletedOnboarding(capacityInstructor.id);
  await ensureCompletedOnboarding(quarterlyMentee.id);
  await ensureCompletedOnboarding(student.id);

  const instructorPosition = await ensurePosition({
    title: "E2E Instructor Opening - Alpha",
    type: PositionType.INSTRUCTOR,
    chapterId: alphaChapter.id,
    openedById: admin.id,
    hiringLeadId: chapterLead.id,
    description: "Canonical recruiting flow test opening for instructor hiring.",
  });
  const chapterPresidentPosition = await ensurePosition({
    title: "E2E Chapter President Opening - Alpha",
    type: PositionType.CHAPTER_PRESIDENT,
    chapterId: alphaChapter.id,
    openedById: admin.id,
    hiringLeadId: chapterLead.id,
    description: "Canonical recruiting flow test opening for chapter president hiring.",
  });

  const activeInstructorApplication =
    (await prisma.application.findFirst({
      where: {
        applicantId: applicant.id,
        positionId: instructorPosition.id,
      },
    })) ??
    (await prisma.application.create({
      data: {
        applicantId: applicant.id,
        positionId: instructorPosition.id,
        status: "INTERVIEW_COMPLETED",
        coverLetter: "I want to teach robotics in a hands-on, student-centered way.",
        resumeUrl: "https://example.com/e2e-applicant-alpha-resume",
        submittedAt: new Date("2026-03-10T13:00:00.000Z"),
      },
    }));

  await prisma.application.update({
    where: { id: activeInstructorApplication.id },
    data: {
      status: "INTERVIEW_COMPLETED",
      coverLetter: "I want to teach robotics in a hands-on, student-centered way.",
      resumeUrl: "https://example.com/e2e-applicant-alpha-resume",
      submittedAt: new Date("2026-03-10T13:00:00.000Z"),
    },
  });

  const activeSlotTime = new Date("2026-03-12T16:00:00.000Z");
  const activeApplicationSlot =
    (await prisma.interviewSlot.findFirst({
      where: {
        applicationId: activeInstructorApplication.id,
        scheduledAt: activeSlotTime,
      },
    })) ??
    (await prisma.interviewSlot.create({
      data: {
        applicationId: activeInstructorApplication.id,
        scheduledAt: activeSlotTime,
        status: InterviewSlotStatus.COMPLETED,
        isConfirmed: true,
        duration: 30,
        interviewerId: chapterLead.id,
        confirmedAt: new Date("2026-03-11T16:00:00.000Z"),
        completedAt: new Date("2026-03-12T16:45:00.000Z"),
      },
    }));

  await prisma.interviewSlot.update({
    where: { id: activeApplicationSlot.id },
    data: {
      status: InterviewSlotStatus.COMPLETED,
      isConfirmed: true,
      interviewerId: chapterLead.id,
      confirmedAt: new Date("2026-03-11T16:00:00.000Z"),
      completedAt: new Date("2026-03-12T16:45:00.000Z"),
    },
  });

  const activeApplicationNote =
    (await prisma.interviewNote.findFirst({
      where: {
        applicationId: activeInstructorApplication.id,
        authorId: chapterLead.id,
      },
    })) ??
    (await prisma.interviewNote.create({
      data: {
        applicationId: activeInstructorApplication.id,
        authorId: chapterLead.id,
        content: "Strong robotics teaching example and clear classroom plan.",
        recommendation: "YES",
        strengths: "Clear pacing, strong student empathy, thoughtful project ideas.",
        concerns: "Needs more practice with transitions.",
        nextStepSuggestion: "Move to hiring chair review after final notes.",
      },
    }));

  await prisma.interviewNote.update({
    where: { id: activeApplicationNote.id },
    data: {
      content: "Strong robotics teaching example and clear classroom plan.",
      recommendation: "YES",
      strengths: "Clear pacing, strong student empathy, thoughtful project ideas.",
      concerns: "Needs more practice with transitions.",
      nextStepSuggestion: "Move to hiring chair review after final notes.",
    },
  });

  const acceptedApplication =
    (await prisma.application.findFirst({
      where: {
        applicantId: acceptedApplicant.id,
        positionId: instructorPosition.id,
      },
    })) ??
    (await prisma.application.create({
      data: {
        applicantId: acceptedApplicant.id,
        positionId: instructorPosition.id,
        status: "ACCEPTED",
        coverLetter: "I have run project-based robotics workshops for middle school students.",
        submittedAt: new Date("2026-03-01T14:00:00.000Z"),
      },
    }));

  await prisma.application.update({
    where: { id: acceptedApplication.id },
    data: {
      status: "ACCEPTED",
      coverLetter: "I have run project-based robotics workshops for middle school students.",
      submittedAt: new Date("2026-03-01T14:00:00.000Z"),
    },
  });

  await prisma.decision.upsert({
    where: { applicationId: acceptedApplication.id },
    create: {
      applicationId: acceptedApplication.id,
      decidedById: chapterLead.id,
      accepted: true,
      notes: "Strong fit for the chapter's robotics program.",
      decidedAt: new Date("2026-03-04T15:00:00.000Z"),
      hiringChairStatus: "APPROVED",
      hiringChairId: admin.id,
      hiringChairNote: "Approved for onboarding.",
      hiringChairAt: new Date("2026-03-05T15:00:00.000Z"),
    },
    update: {
      decidedById: chapterLead.id,
      accepted: true,
      notes: "Strong fit for the chapter's robotics program.",
      decidedAt: new Date("2026-03-04T15:00:00.000Z"),
      hiringChairStatus: "APPROVED",
      hiringChairId: admin.id,
      hiringChairNote: "Approved for onboarding.",
      hiringChairAt: new Date("2026-03-05T15:00:00.000Z"),
    },
  });

  const crossChapterApplication =
    (await prisma.application.findFirst({
      where: {
        applicantId: crossChapterApplicant.id,
        positionId: instructorPosition.id,
      },
    })) ??
    (await prisma.application.create({
      data: {
        applicantId: crossChapterApplicant.id,
        positionId: instructorPosition.id,
        status: "SUBMITTED",
        coverLetter: "I am applying across chapter lines to test escalation and permissions.",
        submittedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    }));

  await prisma.application.update({
    where: { id: crossChapterApplication.id },
    data: {
      status: "SUBMITTED",
      coverLetter: "I am applying across chapter lines to test escalation and permissions.",
      submittedAt: new Date("2026-03-15T12:00:00.000Z"),
    },
  });

  const cpApplication =
    (await prisma.application.findFirst({
      where: {
        applicantId: cpApplicant.id,
        positionId: chapterPresidentPosition.id,
      },
    })) ??
    (await prisma.application.create({
      data: {
        applicantId: cpApplicant.id,
        positionId: chapterPresidentPosition.id,
        status: "UNDER_REVIEW",
        coverLetter: "I want to build a strong chapter culture around robotics and design.",
        submittedAt: new Date("2026-03-14T12:00:00.000Z"),
      },
    }));

  await prisma.application.update({
    where: { id: cpApplication.id },
    data: {
      status: "UNDER_REVIEW",
      coverLetter: "I want to build a strong chapter culture around robotics and design.",
      submittedAt: new Date("2026-03-14T12:00:00.000Z"),
    },
  });

  const foundationsModule = await ensureTrainingModule({
    contentKey: "e2e-foundations",
    title: "E2E Foundations",
    description: "Required readiness module for E2E workflow checks.",
    type: TrainingModuleType.WORKSHOP,
    sortOrder: 800,
    requiresEvidence: false,
    requiresQuiz: false,
  });
  const capstoneModule = await ensureTrainingModule({
    contentKey: "e2e-curriculum-capstone",
    title: "E2E Curriculum Capstone",
    description: "Required curriculum review module for E2E workflow checks.",
    type: TrainingModuleType.CURRICULUM_REVIEW,
    sortOrder: 801,
    requiresEvidence: true,
    requiresQuiz: false,
  });

  await prisma.trainingAssignment.upsert({
    where: {
      userId_moduleId: {
        userId: blockedInstructor.id,
        moduleId: foundationsModule.id,
      },
    },
    create: {
      userId: blockedInstructor.id,
      moduleId: foundationsModule.id,
      status: "COMPLETE",
      completedAt: new Date("2026-03-08T12:00:00.000Z"),
    },
    update: {
      status: "COMPLETE",
      completedAt: new Date("2026-03-08T12:00:00.000Z"),
    },
  });
  await prisma.trainingAssignment.upsert({
    where: {
      userId_moduleId: {
        userId: blockedInstructor.id,
        moduleId: capstoneModule.id,
      },
    },
    create: {
      userId: blockedInstructor.id,
      moduleId: capstoneModule.id,
      status: "IN_PROGRESS",
    },
    update: {
      status: "IN_PROGRESS",
      completedAt: null,
    },
  });
  await prisma.trainingAssignment.upsert({
    where: {
      userId_moduleId: {
        userId: readyInstructor.id,
        moduleId: foundationsModule.id,
      },
    },
    create: {
      userId: readyInstructor.id,
      moduleId: foundationsModule.id,
      status: "COMPLETE",
      completedAt: new Date("2026-03-05T12:00:00.000Z"),
    },
    update: {
      status: "COMPLETE",
      completedAt: new Date("2026-03-05T12:00:00.000Z"),
    },
  });
  await prisma.trainingAssignment.upsert({
    where: {
      userId_moduleId: {
        userId: readyInstructor.id,
        moduleId: capstoneModule.id,
      },
    },
    create: {
      userId: readyInstructor.id,
      moduleId: capstoneModule.id,
      status: "COMPLETE",
      completedAt: new Date("2026-03-06T12:00:00.000Z"),
    },
    update: {
      status: "COMPLETE",
      completedAt: new Date("2026-03-06T12:00:00.000Z"),
    },
  });

  await prisma.instructorInterviewGate.upsert({
    where: { instructorId: blockedInstructor.id },
    create: {
      instructorId: blockedInstructor.id,
      status: "REQUIRED",
    },
    update: {
      status: "REQUIRED",
      outcome: null,
      completedAt: null,
      reviewedById: null,
      reviewedAt: null,
      reviewNotes: null,
    },
  });
  await prisma.instructorInterviewGate.upsert({
    where: { instructorId: readyInstructor.id },
    create: {
      instructorId: readyInstructor.id,
      status: "PASSED",
      outcome: "PASS",
      completedAt: new Date("2026-03-07T12:00:00.000Z"),
      reviewedById: admin.id,
      reviewedAt: new Date("2026-03-07T12:00:00.000Z"),
      reviewNotes: "E2E ready instructor interview passed.",
    },
    update: {
      status: "PASSED",
      outcome: "PASS",
      completedAt: new Date("2026-03-07T12:00:00.000Z"),
      reviewedById: admin.id,
      reviewedAt: new Date("2026-03-07T12:00:00.000Z"),
      reviewNotes: "E2E ready instructor interview passed.",
    },
  });

  const openReadinessRequest = await prisma.readinessReviewRequest.findFirst({
    where: {
      instructorId: blockedInstructor.id,
      status: {
        in: ["REQUESTED", "UNDER_REVIEW", "REVISION_REQUESTED"],
      },
    },
  });

  if (openReadinessRequest) {
    await prisma.readinessReviewRequest.update({
      where: { id: openReadinessRequest.id },
      data: {
        status: "REQUESTED",
        requestedAt: new Date("2026-03-16T10:00:00.000Z"),
        notes: "Blocked instructor is asking for a readiness check.",
      },
    });
  } else {
    await prisma.readinessReviewRequest.create({
      data: {
        instructorId: blockedInstructor.id,
        status: "REQUESTED",
        requestedAt: new Date("2026-03-16T10:00:00.000Z"),
        notes: "Blocked instructor is asking for a readiness check.",
      },
    });
  }

  const curriculumDraft =
    (await prisma.curriculumDraft.findFirst({
      where: {
        authorId: blockedInstructor.id,
        title: "E2E Robotics Curriculum",
      },
    })) ??
    (await prisma.curriculumDraft.create({
      data: {
        authorId: blockedInstructor.id,
        title: "E2E Robotics Curriculum",
        description: "A small but complete robotics launch draft for workflow testing.",
        interestArea: "Robotics",
        outcomes: ["Build a simple robot", "Explain one sensor loop"],
        weeklyPlans: [],
        status: "NEEDS_REVISION",
        reviewNotes: "Tighten pacing and student practice transitions.",
        submittedAt: new Date("2026-03-15T12:00:00.000Z"),
        reviewedAt: new Date("2026-03-16T12:00:00.000Z"),
      },
    }));

  await prisma.curriculumDraft.update({
    where: { id: curriculumDraft.id },
    data: {
      description: "A small but complete robotics launch draft for workflow testing.",
      interestArea: "Robotics",
      outcomes: ["Build a simple robot", "Explain one sensor loop"],
      status: "NEEDS_REVISION",
      reviewNotes: "Tighten pacing and student practice transitions.",
      submittedAt: new Date("2026-03-15T12:00:00.000Z"),
      reviewedAt: new Date("2026-03-16T12:00:00.000Z"),
    },
  });

  const evidenceSubmission = await prisma.trainingEvidenceSubmission.findFirst({
    where: {
      userId: blockedInstructor.id,
      moduleId: capstoneModule.id,
    },
  });

  if (evidenceSubmission) {
    await prisma.trainingEvidenceSubmission.update({
      where: { id: evidenceSubmission.id },
      data: {
        status: "REVISION_REQUESTED",
        fileUrl: `https://example.com/e2e-curriculum-proof?draftId=${curriculumDraft.id}`,
        reviewNotes: "Please make the capstone more teachable week by week.",
        createdAt: new Date("2026-03-15T12:30:00.000Z"),
      },
    });
  } else {
    await prisma.trainingEvidenceSubmission.create({
      data: {
        userId: blockedInstructor.id,
        moduleId: capstoneModule.id,
        status: "REVISION_REQUESTED",
        fileUrl: `https://example.com/e2e-curriculum-proof?draftId=${curriculumDraft.id}`,
        reviewNotes: "Please make the capstone more teachable week by week.",
        createdAt: new Date("2026-03-15T12:30:00.000Z"),
      },
    });
  }

  const roboticsCourse =
    (await prisma.course.findFirst({
      where: {
        title: "E2E Robotics Studio",
        chapterId: alphaChapter.id,
      },
    })) ??
    (await prisma.course.create({
      data: {
        title: "E2E Robotics Studio",
        description: "Robotics course used by E2E analytics and workflow tests.",
        format: CourseFormat.LEVELED,
        interestArea: "Robotics",
        chapterId: alphaChapter.id,
        leadInstructorId: readyInstructor.id,
      },
    }));

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      userId: student.id,
      courseId: roboticsCourse.id,
    },
  });

  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: {
        status: "ENROLLED",
        createdAt: new Date("2026-03-17T09:00:00.000Z"),
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: roboticsCourse.id,
        status: "ENROLLED",
        createdAt: new Date("2026-03-17T09:00:00.000Z"),
      },
    });
  }

  const roboticsPathway =
    (await prisma.pathway.findFirst({
      where: { name: "E2E Robotics Pathway" },
    })) ??
    (await prisma.pathway.create({
      data: {
        name: "E2E Robotics Pathway",
        description: "Pathway used for E2E registration analytics.",
        interestArea: "Robotics",
      },
    }));

  const pathwayEvent =
    (await prisma.pathwayEvent.findFirst({
      where: {
        pathwayId: roboticsPathway.id,
        title: "E2E Robotics Showcase Night",
      },
    })) ??
    (await prisma.pathwayEvent.create({
      data: {
        pathwayId: roboticsPathway.id,
        title: "E2E Robotics Showcase Night",
        description: "Milestone event for pathway-registration analytics.",
        eventDate: new Date("2026-03-22T18:00:00.000Z"),
      },
    }));

  await prisma.pathwayEventRegistration.upsert({
    where: {
      eventId_userId: {
        eventId: pathwayEvent.id,
        userId: student.id,
      },
    },
    create: {
      eventId: pathwayEvent.id,
      userId: student.id,
      registeredAt: new Date("2026-03-17T14:00:00.000Z"),
    },
    update: {
      registeredAt: new Date("2026-03-17T14:00:00.000Z"),
    },
  });

  // Canonical instructor Role Committee fixtures. The Chair is deliberately
  // non-admin so approval permissions are exercised exactly as they are in
  // production. The separate MEMBER account verifies committee packet access.
  const instructorTrack = await prisma.mentorshipTrack.upsert({
    where: { slug: "e2e-instructor-development" },
    create: {
      slug: "e2e-instructor-development",
      name: "E2E Instructor Development",
      description: "Stable end-to-end Mentorship fixture track.",
      programGroup: MentorshipProgramGroup.INSTRUCTOR,
      governanceMode: MentorshipGovernanceMode.FULL_PROGRAM,
      requiresQuarterlyReview: true,
    },
    update: {
      isActive: true,
      requiresQuarterlyReview: true,
    },
  });

  const instructorCommittee =
    (await prisma.mentorCommittee.findFirst({
      where: { trackId: instructorTrack.id, name: "E2E Instructor Role Committee" },
    })) ??
    (await prisma.mentorCommittee.create({
      data: {
        trackId: instructorTrack.id,
        name: "E2E Instructor Role Committee",
        description: "Decision group for the E2E instructor mentorship lane.",
        chairUserId: instructorChair.id,
      },
    }));

  await prisma.mentorCommittee.update({
    where: { id: instructorCommittee.id },
    data: { chairUserId: instructorChair.id },
  });
  await prisma.mentorCommitteeMember.upsert({
    where: {
      committeeId_userId: {
        committeeId: instructorCommittee.id,
        userId: instructorChair.id,
      },
    },
    create: {
      committeeId: instructorCommittee.id,
      userId: instructorChair.id,
      role: MentorCommitteeMemberRole.CHAIR,
    },
    update: { role: MentorCommitteeMemberRole.CHAIR },
  });
  await prisma.mentorCommitteeMember.upsert({
    where: {
      committeeId_userId: {
        committeeId: instructorCommittee.id,
        userId: committeeMember.id,
      },
    },
    create: {
      committeeId: instructorCommittee.id,
      userId: committeeMember.id,
      role: MentorCommitteeMemberRole.MEMBER,
    },
    update: { role: MentorCommitteeMemberRole.MEMBER },
  });
  await prisma.mentorCommitteeChair.updateMany({
    where: { roleType: MenteeRoleType.INSTRUCTOR },
    data: { isActive: false },
  });
  await prisma.mentorCommitteeChair.upsert({
    where: {
      userId_lane: {
        userId: instructorChair.id,
        lane: MentorCommitteeLane.INSTRUCTOR,
      },
    },
    create: {
      userId: instructorChair.id,
      lane: MentorCommitteeLane.INSTRUCTOR,
      roleType: MenteeRoleType.INSTRUCTOR,
      isActive: true,
    },
    update: { roleType: MenteeRoleType.INSTRUCTOR, isActive: true },
  });

  // Reset only the dedicated monthly-flow subject. Prior relationships remain
  // immutable history; the UI test creates a new active assignment every run.
  await prisma.gRDocument.deleteMany({ where: { userId: monthlyFlowMentee.id } });
  await prisma.mentorship.updateMany({
    where: { menteeId: monthlyFlowMentee.id, status: MentorshipStatus.ACTIVE },
    data: { status: MentorshipStatus.COMPLETE, endDate: new Date() },
  });

  const approvedInstructorTemplate =
    (await prisma.gRTemplate.findFirst({
      where: { title: "E2E Instructor Current G&R" },
    })) ??
    (await prisma.gRTemplate.create({
      data: {
        title: "E2E Instructor Current G&R",
        roleType: MenteeRoleType.INSTRUCTOR,
        roleMission: "Create an engaging, measurable learning experience and improve it through evidence.",
        status: GRTemplateStatus.GR_APPROVED,
        publishedAt: new Date("2026-03-01T00:00:00.000Z"),
        createdById: admin.id,
        lastEditedById: admin.id,
        goals: {
          create: {
            title: "Launch a learner-centered robotics experience",
            description: "Use learner feedback, delivery evidence, and follow-through to improve the class.",
            timePhase: "MONTHLY",
            sortOrder: 1,
          },
        },
      },
    }));
  await prisma.gRTemplate.update({
    where: { id: approvedInstructorTemplate.id },
    data: {
      status: GRTemplateStatus.GR_APPROVED,
      isActive: true,
      publishedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
  });

  const staleMentorship =
    (await prisma.mentorship.findFirst({
      where: {
        mentorId: mentor.id,
        menteeId: blockedInstructor.id,
        status: MentorshipStatus.ACTIVE,
      },
    })) ??
    (await prisma.mentorship.create({
      data: {
        mentorId: mentor.id,
        menteeId: blockedInstructor.id,
        type: "INSTRUCTOR",
        programGroup: MentorshipProgramGroup.INSTRUCTOR,
        governanceMode: MentorshipGovernanceMode.FULL_PROGRAM,
        status: MentorshipStatus.ACTIVE,
        startDate: new Date("2026-02-01T12:00:00.000Z"),
      },
    }));

  const reviewMentorship =
    (await prisma.mentorship.findFirst({
      where: {
        mentorId: mentor.id,
        menteeId: readyInstructor.id,
        status: MentorshipStatus.ACTIVE,
      },
    })) ??
    (await prisma.mentorship.create({
      data: {
        mentorId: mentor.id,
        menteeId: readyInstructor.id,
        chairId: instructorChair.id,
        trackId: instructorTrack.id,
        type: "INSTRUCTOR",
        programGroup: MentorshipProgramGroup.INSTRUCTOR,
        governanceMode: MentorshipGovernanceMode.FULL_PROGRAM,
        status: MentorshipStatus.ACTIVE,
        startDate: new Date("2026-02-15T12:00:00.000Z"),
        kickoffCompletedAt: new Date("2026-02-16T12:00:00.000Z"),
      },
    }));

  await prisma.mentorship.update({
    where: { id: staleMentorship.id },
    data: { trackId: instructorTrack.id, chairId: instructorChair.id },
  });
  await prisma.mentorship.update({
    where: { id: reviewMentorship.id },
    data: {
      trackId: instructorTrack.id,
      chairId: instructorChair.id,
      kickoffCompletedAt: new Date("2026-02-16T12:00:00.000Z"),
    },
  });

  const readyGRDocument = await prisma.gRDocument.upsert({
    where: {
      userId_templateId: {
        userId: readyInstructor.id,
        templateId: approvedInstructorTemplate.id,
      },
    },
    create: {
      userId: readyInstructor.id,
      mentorshipId: reviewMentorship.id,
      templateId: approvedInstructorTemplate.id,
      roleMission: approvedInstructorTemplate.roleMission,
      roleStartDate: new Date("2026-02-15T12:00:00.000Z"),
      status: "ACTIVE",
    },
    update: {
      mentorshipId: reviewMentorship.id,
      status: "ACTIVE",
    },
  });
  const templateGoal = await prisma.gRTemplateGoal.findFirst({
    where: { templateId: approvedInstructorTemplate.id, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (templateGoal) {
    const existingReadyGoal = await prisma.gRDocumentGoal.findFirst({
      where: { documentId: readyGRDocument.id, templateGoalId: templateGoal.id },
      select: { id: true },
    });
    if (existingReadyGoal) {
      await prisma.gRDocumentGoal.update({
        where: { id: existingReadyGoal.id },
        data: {
          title: templateGoal.title,
          description: templateGoal.description,
        },
      });
    } else {
      await prisma.gRDocumentGoal.create({
        data: {
        documentId: readyGRDocument.id,
        templateGoalId: templateGoal.id,
        title: templateGoal.title,
        description: templateGoal.description,
        timePhase: templateGoal.timePhase,
        sortOrder: templateGoal.sortOrder,
        },
      });
    }
  }

  const capacityMentorship =
    (await prisma.mentorship.findFirst({
      where: {
        mentorId: mentor.id,
        menteeId: capacityInstructor.id,
        status: MentorshipStatus.ACTIVE,
      },
    })) ??
    (await prisma.mentorship.create({
      data: {
        mentorId: mentor.id,
        menteeId: capacityInstructor.id,
        chairId: instructorChair.id,
        trackId: instructorTrack.id,
        type: "INSTRUCTOR",
        programGroup: MentorshipProgramGroup.INSTRUCTOR,
        governanceMode: MentorshipGovernanceMode.FULL_PROGRAM,
        status: MentorshipStatus.ACTIVE,
        startDate: new Date("2026-02-20T12:00:00.000Z"),
        kickoffCompletedAt: new Date("2026-02-21T12:00:00.000Z"),
      },
    }));
  await prisma.mentorship.update({
    where: { id: capacityMentorship.id },
    data: { trackId: instructorTrack.id, chairId: instructorChair.id },
  });

  const quarterlyMentorship =
    (await prisma.mentorship.findFirst({
      where: {
        mentorId: mentor.id,
        menteeId: quarterlyMentee.id,
        status: MentorshipStatus.ACTIVE,
      },
    })) ??
    (await prisma.mentorship.create({
      data: {
        mentorId: mentor.id,
        menteeId: quarterlyMentee.id,
        chairId: instructorChair.id,
        trackId: instructorTrack.id,
        type: "INSTRUCTOR",
        programGroup: MentorshipProgramGroup.INSTRUCTOR,
        governanceMode: MentorshipGovernanceMode.FULL_PROGRAM,
        status: MentorshipStatus.ACTIVE,
        startDate: new Date("2026-03-01T12:00:00.000Z"),
        kickoffCompletedAt: new Date("2026-03-02T12:00:00.000Z"),
      },
    }));
  await prisma.mentorship.update({
    where: { id: quarterlyMentorship.id },
    data: {
      trackId: instructorTrack.id,
      chairId: instructorChair.id,
      kickoffCompletedAt: new Date("2026-03-02T12:00:00.000Z"),
      cycleStage: "APPROVED",
    },
  });

  const quarterlyGRDocument = await prisma.gRDocument.upsert({
    where: {
      userId_templateId: {
        userId: quarterlyMentee.id,
        templateId: approvedInstructorTemplate.id,
      },
    },
    create: {
      userId: quarterlyMentee.id,
      mentorshipId: quarterlyMentorship.id,
      templateId: approvedInstructorTemplate.id,
      roleMission: approvedInstructorTemplate.roleMission,
      roleStartDate: new Date("2026-03-01T12:00:00.000Z"),
      status: "ACTIVE",
    },
    update: { mentorshipId: quarterlyMentorship.id, status: "ACTIVE" },
  });
  if (templateGoal) {
    const quarterlyGoal = await prisma.gRDocumentGoal.findFirst({
      where: { documentId: quarterlyGRDocument.id, templateGoalId: templateGoal.id },
      select: { id: true },
    });
    if (!quarterlyGoal) {
      await prisma.gRDocumentGoal.create({
        data: {
          documentId: quarterlyGRDocument.id,
          templateGoalId: templateGoal.id,
          title: templateGoal.title,
          description: templateGoal.description,
          timePhase: templateGoal.timePhase,
          sortOrder: templateGoal.sortOrder,
          progressState: "IN_PROGRESS",
        },
      });
    }
  }

  const quarterlyMonths = [
    new Date("2026-04-01T00:00:00.000Z"),
    new Date("2026-05-01T00:00:00.000Z"),
    new Date("2026-06-01T00:00:00.000Z"),
  ];
  for (const [index, month] of quarterlyMonths.entries()) {
    const cycleNumber = index + 1;
    const reflection = await prisma.monthlySelfReflection.upsert({
      where: {
        mentorshipId_cycleNumber: {
          mentorshipId: quarterlyMentorship.id,
          cycleNumber,
        },
      },
      create: {
        mentorshipId: quarterlyMentorship.id,
        menteeId: quarterlyMentee.id,
        cycleMonth: month,
        cycleNumber,
        overallReflection: `Cycle ${cycleNumber}: delivery became more learner-centered and measurable.`,
        engagementOverall: "Engaged and supported.",
        workingWell: "Student feedback and lesson iteration.",
        supportNeeded: "Continue observing learner outcomes.",
        mentorHelpfulness: "Specific and useful.",
        collaborationAssessment: "Strong collaboration.",
        teamMembersAboveAndBeyond: "The mentor supported evidence review.",
        collaborationImprovements: "Keep decisions documented.",
        additionalReflections: "Ready for committee synthesis.",
      },
      update: { cycleMonth: month },
    });
    await prisma.mentorGoalReview.upsert({
      where: { selfReflectionId: reflection.id },
      create: {
        mentorId: mentor.id,
        menteeId: quarterlyMentee.id,
        mentorshipId: quarterlyMentorship.id,
        selfReflectionId: reflection.id,
        cycleMonth: month,
        cycleNumber,
        isQuarterly: cycleNumber === 3,
        overallRating: cycleNumber === 1 ? GoalRatingColor.GETTING_STARTED : GoalRatingColor.ACHIEVED,
        overallComments: `Cycle ${cycleNumber} shows clear evidence of learner-centered improvement.`,
        planOfAction: "Continue the strongest practices and measure the next learner outcome.",
        status: GoalReviewStatus.APPROVED,
        chairReviewerId: instructorChair.id,
        chairApprovedAt: new Date(month.getTime() + 15 * 24 * 60 * 60 * 1000),
        releasedToMenteeAt: new Date(month.getTime() + 15 * 24 * 60 * 60 * 1000),
        pointsAwarded: 50,
      },
      update: {
        cycleMonth: month,
        cycleNumber,
        isQuarterly: cycleNumber === 3,
        status: GoalReviewStatus.APPROVED,
        chairReviewerId: instructorChair.id,
        chairApprovedAt: new Date(month.getTime() + 15 * 24 * 60 * 60 * 1000),
        releasedToMenteeAt: new Date(month.getTime() + 15 * 24 * 60 * 60 * 1000),
        pointsAwarded: 50,
      },
    });
  }

  const staleSession = await prisma.mentorshipSession.findFirst({
    where: {
      mentorshipId: staleMentorship.id,
      title: "E2E Stale Check-In",
    },
  });

  if (staleSession) {
    await prisma.mentorshipSession.update({
      where: { id: staleSession.id },
      data: {
        scheduledAt: new Date("2026-02-10T12:00:00.000Z"),
        completedAt: new Date("2026-02-10T12:30:00.000Z"),
      },
    });
  } else {
    await prisma.mentorshipSession.create({
      data: {
        mentorshipId: staleMentorship.id,
        menteeId: blockedInstructor.id,
        type: MentorshipSessionType.CHECK_IN,
        title: "E2E Stale Check-In",
        scheduledAt: new Date("2026-02-10T12:00:00.000Z"),
        completedAt: new Date("2026-02-10T12:30:00.000Z"),
        createdById: mentor.id,
      },
    });
  }

  const openRequest = await prisma.mentorshipRequest.findFirst({
    where: {
      mentorshipId: staleMentorship.id,
      menteeId: blockedInstructor.id,
      title: "E2E Open Support Request",
    },
  });

  if (openRequest) {
    await prisma.mentorshipRequest.update({
      where: { id: openRequest.id },
      data: {
        status: MentorshipRequestStatus.OPEN,
        kind: MentorshipRequestKind.PROJECT_FEEDBACK,
        visibility: MentorshipRequestVisibility.PRIVATE,
        details: "I need help tightening the robotics lesson arc before launch.",
        requestedAt: new Date("2026-03-17T11:00:00.000Z"),
      },
    });
  } else {
    await prisma.mentorshipRequest.create({
      data: {
        mentorshipId: staleMentorship.id,
        menteeId: blockedInstructor.id,
        requesterId: blockedInstructor.id,
        kind: MentorshipRequestKind.PROJECT_FEEDBACK,
        visibility: MentorshipRequestVisibility.PRIVATE,
        status: MentorshipRequestStatus.OPEN,
        title: "E2E Open Support Request",
        details: "I need help tightening the robotics lesson arc before launch.",
        requestedAt: new Date("2026-03-17T11:00:00.000Z"),
      },
    });
  }

  const mentorshipGoal =
    (await prisma.mentorshipProgramGoal.findFirst({
      where: {
        title: "E2E Instructor Launch Goal",
        roleType: "INSTRUCTOR",
      },
    })) ??
    (await prisma.mentorshipProgramGoal.create({
      data: {
        title: "E2E Instructor Launch Goal",
        description: "Prepare a launch-ready robotics learning experience.",
        roleType: "INSTRUCTOR",
        createdById: admin.id,
      },
    }));

  const cycleMonth = new Date("2026-03-01T00:00:00.000Z");
  const currentReflection = await prisma.monthlySelfReflection.upsert({
    where: {
      mentorshipId_cycleNumber: {
        mentorshipId: reviewMentorship.id,
        cycleNumber: 1,
      },
    },
    create: {
      mentorshipId: reviewMentorship.id,
      menteeId: readyInstructor.id,
      cycleMonth,
      cycleNumber: 1,
      overallReflection: "I made strong progress preparing launch materials.",
      engagementOverall: "I feel focused and supported.",
      workingWell: "Curriculum polish and student voice planning.",
      supportNeeded: "A final review before launch.",
      mentorHelpfulness: "Helpful and actionable.",
      collaborationAssessment: "Chapter collaboration is steady.",
      teamMembersAboveAndBeyond: "My mentor helped with sequencing.",
      collaborationImprovements: "Faster review turnarounds would help.",
      additionalReflections: "Ready for the next phase.",
    },
    update: {
      cycleMonth,
      overallReflection: "I made strong progress preparing launch materials.",
      engagementOverall: "I feel focused and supported.",
      workingWell: "Curriculum polish and student voice planning.",
      supportNeeded: "A final review before launch.",
      mentorHelpfulness: "Helpful and actionable.",
      collaborationAssessment: "Chapter collaboration is steady.",
      teamMembersAboveAndBeyond: "My mentor helped with sequencing.",
      collaborationImprovements: "Faster review turnarounds would help.",
      additionalReflections: "Ready for the next phase.",
    },
  });

  const reflectionGoalResponse = await prisma.selfReflectionGoalResponse.findFirst({
    where: {
      reflectionId: currentReflection.id,
      goalId: mentorshipGoal.id,
    },
  });

  if (reflectionGoalResponse) {
    await prisma.selfReflectionGoalResponse.update({
      where: { id: reflectionGoalResponse.id },
      data: {
        progressMade: "Built a strong week-by-week robotics draft.",
        objectiveAchieved: true,
        accomplishments: "Finished pacing, outcomes, and project checkpoints.",
        blockers: "Still need one final chair review.",
        nextMonthPlans: "Move from approval into class launch.",
      },
    });
  } else {
    await prisma.selfReflectionGoalResponse.create({
      data: {
        reflectionId: currentReflection.id,
        goalId: mentorshipGoal.id,
        progressMade: "Built a strong week-by-week robotics draft.",
        objectiveAchieved: true,
        accomplishments: "Finished pacing, outcomes, and project checkpoints.",
        blockers: "Still need one final chair review.",
        nextMonthPlans: "Move from approval into class launch.",
      },
    });
  }

  const pendingReview = await prisma.mentorGoalReview.upsert({
    where: { selfReflectionId: currentReflection.id },
    create: {
      mentorId: mentor.id,
      menteeId: readyInstructor.id,
      mentorshipId: reviewMentorship.id,
      selfReflectionId: currentReflection.id,
      cycleMonth,
      cycleNumber: 1,
      isQuarterly: false,
      overallRating: GoalRatingColor.ACHIEVED,
      overallComments: "Strong launch readiness and solid student-centered planning.",
      planOfAction: "Finalize approval and move into first delivery.",
      status: GoalReviewStatus.PENDING_CHAIR_APPROVAL,
      createdAt: new Date("2026-03-17T12:00:00.000Z"),
    },
    update: {
      mentorId: mentor.id,
      menteeId: readyInstructor.id,
      mentorshipId: reviewMentorship.id,
      cycleMonth,
      cycleNumber: 1,
      isQuarterly: false,
      overallRating: GoalRatingColor.ACHIEVED,
      overallComments: "Strong launch readiness and solid student-centered planning.",
      planOfAction: "Finalize approval and move into first delivery.",
      status: GoalReviewStatus.PENDING_CHAIR_APPROVAL,
      chairReviewerId: null,
      chairComments: null,
      chairApprovedAt: null,
      releasedToMenteeAt: null,
      pointsAwarded: null,
      createdAt: new Date("2026-03-17T12:00:00.000Z"),
    },
  });

  await prisma.goalReviewRating.deleteMany({
    where: { reviewId: pendingReview.id },
  });
  await prisma.goalReviewRating.create({
    data: {
      reviewId: pendingReview.id,
      goalId: mentorshipGoal.id,
      rating: GoalRatingColor.ACHIEVED,
      comments: "The goal is on track and clearly evidenced.",
    },
  });

  // Re-application: applicantId is no longer @unique, so use findFirst+create
  // to keep the seed idempotent across runs.
  const existingLegacyApp = await prisma.instructorApplication.findFirst({
    where: { applicantId: legacyApplicant.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const legacyAppPayload = {
    status: "INFO_REQUESTED" as const,
    motivation: "Legacy compatibility testing for the old instructor application path.",
    teachingExperience: "Facilitated clubs and tutoring programs.",
    availability: "Weekday afternoons",
    reviewerId: admin.id,
    infoRequest: "Please add one more example of teaching experience.",
    applicantResponse: "I also led a robotics camp last summer.",
  };
  if (existingLegacyApp) {
    await prisma.instructorApplication.update({
      where: { id: existingLegacyApp.id },
      data: legacyAppPayload,
    });
  } else {
    await prisma.instructorApplication.create({
      data: { applicantId: legacyApplicant.id, ...legacyAppPayload },
    });
  }

  console.log("Portal E2E seed ready.");
  console.log(`Admin login: e2e.admin@ypp.test / ${E2E_PASSWORD}`);
  console.log(`Chapter Lead login: e2e.chapter.lead.alpha@ypp.test / ${E2E_PASSWORD}`);
  console.log(`Monthly mentee login: e2e.mentee.monthly@ypp.test / ${E2E_PASSWORD}`);
  console.log(`Mentor login: e2e.mentor.alpha@ypp.test / ${E2E_PASSWORD}`);
  console.log(`Instructor Role Chair login: e2e.chair.instructor@ypp.test / ${E2E_PASSWORD}`);
  console.log(`Committee member login: e2e.committee.instructor@ypp.test / ${E2E_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
