"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { RoleType, StudentIntakeCaseStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-verification-actions";
import { createBulkSystemNotifications, createSystemNotification } from "@/lib/notification-actions";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalInt(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

async function requireParent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }

  return session;
}

async function requireChapterReviewer() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true, chapter: { select: { id: true, name: true } } },
  });

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterPresident = roles.includes("CHAPTER_PRESIDENT");

  if (!user || (!isAdmin && !isChapterPresident)) {
    throw new Error("Unauthorized");
  }

  return {
    session,
    user,
    isAdmin,
    isChapterPresident,
  };
}

async function assertReviewerHasCaseAccess(caseId: string) {
  const reviewer = await requireChapterReviewer();
  const intakeCase = await prisma.studentIntakeCase.findUnique({
    where: { id: caseId },
    include: {
      parent: { select: { id: true, name: true, email: true, phone: true } },
      chapter: { select: { id: true, name: true } },
      studentUser: {
        select: {
          id: true,
          email: true,
          profile: true,
          roles: { select: { role: true } },
        },
      },
    },
  });

  if (!intakeCase) {
    throw new Error("Student intake case not found");
  }

  if (!reviewer.isAdmin && reviewer.user.chapterId !== intakeCase.chapterId) {
    throw new Error("Unauthorized");
  }

  return { reviewer, intakeCase };
}

async function createMilestone(params: {
  intakeCaseId: string;
  status: StudentIntakeCaseStatus;
  title: string;
  body?: string | null;
  createdById?: string | null;
  visibleToParent?: boolean;
}) {
  const {
    intakeCaseId,
    status,
    title,
    body = null,
    createdById = null,
    visibleToParent = true,
  } = params;

  return prisma.studentIntakeMilestone.create({
    data: {
      intakeCaseId,
      status,
      title,
      body,
      createdById,
      visibleToParent,
    },
  });
}

async function getChapterIntakeRecipients(chapterId: string) {
  const recipients = await prisma.user.findMany({
    where: {
      OR: [
        {
          roles: {
            some: {
              role: "ADMIN",
            },
          },
        },
        {
          chapterId,
          roles: {
            some: {
              role: "CHAPTER_PRESIDENT",
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return recipients.map((recipient) => recipient.id);
}

function buildDefaultMentorPlanItems(params: {
  studentName: string;
  reviewOwnerId: string | null;
  reviewerId: string;
}) {
  const ownerId = params.reviewOwnerId ?? params.reviewerId;
  const now = Date.now();

  return [
    {
      title: "Assign a primary mentor",
      details: `Choose the first mentor who will own ${params.studentName}'s early support plan.`,
      ownerId,
      dueAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Review student goals and support needs",
      details: `Read the parent intake notes and translate them into the first support priorities for ${params.studentName}.`,
      ownerId,
      dueAt: new Date(now + 4 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Prepare the student welcome handoff",
      details: `Make sure ${params.studentName} knows the next step after approval and is ready for the first mentorship touchpoint.`,
      ownerId,
      dueAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
    },
  ];
}

async function ensureStudentUserFromIntake(params: {
  intakeCase: Awaited<ReturnType<typeof assertReviewerHasCaseAccess>>["intakeCase"];
}) {
  const { intakeCase } = params;
  const normalizedEmail = intakeCase.studentEmail.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      roles: true,
      profile: true,
    },
  });

  if (existingUser && !existingUser.roles.some((role) => role.role === "STUDENT")) {
    throw new Error("This email already belongs to a non-student account. Use a different email or update the existing account manually.");
  }

  let createdNewStudent = false;
  let studentUserId = existingUser?.id ?? null;

  if (!existingUser) {
    const randomPassword = crypto.randomBytes(24).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const newStudent = await prisma.user.create({
      data: {
        name: intakeCase.studentName,
        email: normalizedEmail,
        passwordHash,
        primaryRole: RoleType.STUDENT,
        chapterId: intakeCase.chapterId,
        roles: {
          create: [{ role: RoleType.STUDENT }],
        },
        profile: {
          create: {
            grade: intakeCase.studentGrade ?? null,
            school: intakeCase.studentSchool ?? null,
            interests: intakeCase.interests,
            parentEmail: intakeCase.parent.email,
            parentPhone: intakeCase.parent.phone ?? null,
          },
        },
      },
      select: { id: true },
    });

    studentUserId = newStudent.id;
    createdNewStudent = true;
  } else {
    studentUserId = existingUser.id;

    if (!existingUser.profile) {
      await prisma.userProfile.create({
        data: {
          userId: existingUser.id,
          grade: intakeCase.studentGrade ?? null,
          school: intakeCase.studentSchool ?? null,
          interests: intakeCase.interests,
          parentEmail: intakeCase.parent.email,
          parentPhone: intakeCase.parent.phone ?? null,
        },
      });
    } else {
      await prisma.userProfile.update({
        where: { userId: existingUser.id },
        data: {
          grade: existingUser.profile.grade ?? intakeCase.studentGrade ?? undefined,
          school: existingUser.profile.school ?? intakeCase.studentSchool ?? undefined,
          interests:
            existingUser.profile.interests.length > 0
              ? existingUser.profile.interests
              : intakeCase.interests,
          parentEmail: existingUser.profile.parentEmail ?? intakeCase.parent.email,
          parentPhone: existingUser.profile.parentPhone ?? intakeCase.parent.phone ?? undefined,
        },
      });
    }
  }

  if (!studentUserId) {
    throw new Error("Unable to prepare student account.");
  }

  return {
    studentUserId,
    createdNewStudent,
  };
}

async function upsertApprovedParentLink(params: {
  parentId: string;
  studentId: string;
  relationship: string;
  reviewerId: string;
}) {
  const { parentId, studentId, relationship, reviewerId } = params;

  return prisma.parentStudent.upsert({
    where: {
      parentId_studentId: {
        parentId,
        studentId,
      },
    },
    update: {
      relationship,
      isPrimary: true,
      approvalStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
    create: {
      parentId,
      studentId,
      relationship,
      isPrimary: true,
      approvalStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  });
}

async function launchStudentIntakeMentorPlanInternal(params: {
  intakeCaseId: string;
  reviewerId: string;
}) {
  const intakeCase = await prisma.studentIntakeCase.findUnique({
    where: { id: params.intakeCaseId },
    select: {
      id: true,
      parentId: true,
      studentUserId: true,
      studentName: true,
      reviewOwnerId: true,
      mentorPlanLaunchedAt: true,
      status: true,
    },
  });

  if (!intakeCase?.studentUserId) {
    throw new Error("Cannot launch a mentor plan before the student account exists.");
  }

  if (intakeCase.mentorPlanLaunchedAt) {
    return intakeCase;
  }

  const existingActionItems = await prisma.mentorshipActionItem.findMany({
    where: {
      menteeId: intakeCase.studentUserId,
      mentorshipId: null,
    },
    select: { id: true },
    take: 1,
  });

  if (existingActionItems.length === 0) {
    const defaultItems = buildDefaultMentorPlanItems({
      studentName: intakeCase.studentName,
      reviewOwnerId: intakeCase.reviewOwnerId,
      reviewerId: params.reviewerId,
    });

    await prisma.mentorshipActionItem.createMany({
      data: defaultItems.map((item) => ({
        mentorshipId: null,
        menteeId: intakeCase.studentUserId!,
        title: item.title,
        details: item.details,
        ownerId: item.ownerId,
        createdById: params.reviewerId,
        dueAt: item.dueAt,
      })),
    });
  }

  await prisma.studentIntakeCase.update({
    where: { id: intakeCase.id },
    data: {
      status: StudentIntakeCaseStatus.MENTOR_PLAN_LAUNCHED,
      mentorPlanLaunchedAt: new Date(),
      nextAction: "Assign mentor and begin first support cycle",
      blockerNote: null,
    },
  });

  await createMilestone({
    intakeCaseId: intakeCase.id,
    status: StudentIntakeCaseStatus.MENTOR_PLAN_LAUNCHED,
    title: "Mentor action plan launched",
    body: "Your chapter launched the first support plan. A mentor assignment comes next.",
    createdById: params.reviewerId,
  });

  await createSystemNotification(
    intakeCase.parentId,
    "SYSTEM",
    "Mentor action plan launched",
    `The first support plan for ${intakeCase.studentName} is now open in the chapter workflow.`,
    `/parent/student-intake/${intakeCase.id}`
  );

  return intakeCase;
}

export async function getParentStudentIntakeCases() {
  const session = await requireParent();

  return prisma.studentIntakeCase.findMany({
    where: { parentId: session.user.id },
    include: {
      chapter: { select: { id: true, name: true } },
      studentUser: { select: { id: true, name: true, email: true } },
      milestones: {
        where: { visibleToParent: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getParentStudentIntakeCase(caseId: string) {
  const session = await requireParent();

  return prisma.studentIntakeCase.findFirst({
    where: {
      id: caseId,
      parentId: session.user.id,
    },
    include: {
      chapter: { select: { id: true, name: true } },
      studentUser: { select: { id: true, name: true, email: true } },
      milestones: {
        where: { visibleToParent: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getStudentIntakeCasesForReview() {
  const { user: reviewer, isAdmin } = await requireChapterReviewer();

  return prisma.studentIntakeCase.findMany({
    where: isAdmin
      ? {
          status: {
            in: [
              StudentIntakeCaseStatus.SUBMITTED,
              StudentIntakeCaseStatus.UNDER_REVIEW,
            ],
          },
        }
      : {
          chapterId: reviewer.chapterId ?? "__none__",
          status: {
            in: [
              StudentIntakeCaseStatus.SUBMITTED,
              StudentIntakeCaseStatus.UNDER_REVIEW,
            ],
          },
        },
    include: {
      parent: { select: { id: true, name: true, email: true } },
      chapter: { select: { id: true, name: true } },
      reviewOwner: { select: { id: true, name: true } },
      milestones: {
        where: { visibleToParent: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function createStudentIntakeCase(formData: FormData) {
  const session = await requireParent();

  const studentName = getString(formData, "studentName");
  const studentEmail = getString(formData, "studentEmail").toLowerCase();
  const studentGrade = getOptionalInt(formData.get("studentGrade"));
  const studentSchool = getString(formData, "studentSchool", false);
  const chapterId = getString(formData, "chapterId");
  const relationship = getString(formData, "relationship", false) || "Parent";
  const interests = splitList(getString(formData, "interests", false));
  const goals = splitList(getString(formData, "goals", false));
  const supportNeeds = getString(formData, "supportNeeds", false);
  const parentNotes = getString(formData, "parentNotes", false);

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true },
  });

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const intakeCase = await prisma.studentIntakeCase.create({
    data: {
      parentId: session.user.id,
      chapterId,
      studentName,
      studentEmail,
      studentGrade,
      studentSchool: studentSchool || null,
      relationship,
      interests,
      goals,
      supportNeeds: supportNeeds || null,
      parentNotes: parentNotes || null,
    },
  });

  await createMilestone({
    intakeCaseId: intakeCase.id,
    status: StudentIntakeCaseStatus.DRAFT,
    title: "Draft created",
    body: "Your student journey draft is ready for one last review before submission.",
    createdById: session.user.id,
  });

  revalidatePath("/parent");
  revalidatePath("/parent/connect");
  redirect(`/parent/student-intake/${intakeCase.id}`);
}

export async function submitStudentIntakeCase(formData: FormData) {
  const session = await requireParent();
  const caseId = getString(formData, "id");

  const intakeCase = await prisma.studentIntakeCase.findFirst({
    where: {
      id: caseId,
      parentId: session.user.id,
    },
    include: {
      chapter: { select: { id: true, name: true } },
    },
  });

  if (!intakeCase) {
    throw new Error("Student intake case not found");
  }

  if (intakeCase.status !== StudentIntakeCaseStatus.DRAFT) {
    throw new Error("Only draft intake cases can be submitted.");
  }

  await prisma.studentIntakeCase.update({
    where: { id: caseId },
    data: {
      status: StudentIntakeCaseStatus.SUBMITTED,
      submittedAt: new Date(),
      nextAction: "Chapter review",
    },
  });

  await createMilestone({
    intakeCaseId: caseId,
    status: StudentIntakeCaseStatus.SUBMITTED,
    title: "Submitted for chapter review",
    body: `The ${intakeCase.chapter.name} team now has the case in its review queue.`,
    createdById: session.user.id,
  });

  const chapterRecipients = await getChapterIntakeRecipients(intakeCase.chapterId);
  if (chapterRecipients.length > 0) {
    await createBulkSystemNotifications(
      chapterRecipients,
      "SYSTEM",
      "New student intake submitted",
      `${intakeCase.studentName} has a new parent-led intake case waiting for review.`,
      "/chapter/student-intake"
    );
  }

  await createSystemNotification(
    session.user.id,
    "SYSTEM",
    "Student journey submitted",
    `Your intake case for ${intakeCase.studentName} was submitted and is waiting for chapter review.`,
    `/parent/student-intake/${caseId}`
  );

  revalidatePath("/parent");
  revalidatePath(`/parent/student-intake/${caseId}`);
  revalidatePath("/chapter");
  revalidatePath("/chapter/student-intake");
}

export async function updateStudentIntakeCaseStatus(formData: FormData) {
  const caseId = getString(formData, "id");
  const requestedStatus = getString(formData, "status", false) as StudentIntakeCaseStatus | "";
  const reviewerNote = getString(formData, "reviewerNote", false);
  const blockerNote = getString(formData, "blockerNote", false);
  const nextAction = getString(formData, "nextAction", false);

  const { reviewer, intakeCase } = await assertReviewerHasCaseAccess(caseId);
  const nextStatus = (requestedStatus || intakeCase.status) as StudentIntakeCaseStatus;
  const movingIntoReview =
    nextStatus === StudentIntakeCaseStatus.UNDER_REVIEW &&
    intakeCase.status !== StudentIntakeCaseStatus.UNDER_REVIEW;

  await prisma.studentIntakeCase.update({
    where: { id: caseId },
    data: {
      status: nextStatus,
      reviewerNote: reviewerNote || intakeCase.reviewerNote || null,
      blockerNote: blockerNote || null,
      nextAction:
        nextStatus === StudentIntakeCaseStatus.UNDER_REVIEW
          ? nextAction || "Continue review"
          : nextAction || intakeCase.nextAction || null,
      reviewOwnerId: reviewer.user.id,
    },
  });

  if (movingIntoReview) {
    await createMilestone({
      intakeCaseId: caseId,
      status: StudentIntakeCaseStatus.UNDER_REVIEW,
      title: "Under chapter review",
      body: `${intakeCase.chapter.name} is reviewing the intake details and mapping the next steps.`,
      createdById: reviewer.user.id,
    });

    await createSystemNotification(
      intakeCase.parentId,
      "SYSTEM",
      "Student journey is under review",
      `${intakeCase.chapter.name} is now reviewing ${intakeCase.studentName}'s intake case.`,
      `/parent/student-intake/${caseId}`
    );
  }

  revalidatePath("/chapter");
  revalidatePath("/chapter/student-intake");
  revalidatePath(`/parent/student-intake/${caseId}`);
  revalidatePath("/parent");
}

export async function launchStudentIntakeMentorPlan(formData: FormData | string) {
  const caseId = typeof formData === "string" ? formData : getString(formData, "id");
  const { reviewer, intakeCase } = await assertReviewerHasCaseAccess(caseId);

  if (!intakeCase.studentUserId) {
    throw new Error("Approve the intake case before launching the mentor plan.");
  }

  await launchStudentIntakeMentorPlanInternal({
    intakeCaseId: caseId,
    reviewerId: reviewer.user.id,
  });

  revalidatePath("/chapter");
  revalidatePath("/chapter/student-intake");
  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${intakeCase.studentUserId}`);
  revalidatePath(`/parent/student-intake/${caseId}`);
  revalidatePath("/parent");
}

export async function approveStudentIntakeCase(formData: FormData) {
  const caseId = getString(formData, "id");
  const { reviewer, intakeCase } = await assertReviewerHasCaseAccess(caseId);

  if (
    intakeCase.status !== StudentIntakeCaseStatus.SUBMITTED &&
    intakeCase.status !== StudentIntakeCaseStatus.UNDER_REVIEW &&
    intakeCase.status !== StudentIntakeCaseStatus.APPROVED
  ) {
    throw new Error("Only submitted or in-review cases can be approved.");
  }

  const { studentUserId, createdNewStudent } = await ensureStudentUserFromIntake({
    intakeCase,
  });

  await upsertApprovedParentLink({
    parentId: intakeCase.parentId,
    studentId: studentUserId,
    relationship: intakeCase.relationship,
    reviewerId: reviewer.user.id,
  });

  await prisma.studentIntakeCase.update({
    where: { id: caseId },
    data: {
      status: StudentIntakeCaseStatus.APPROVED,
      studentUserId,
      reviewedAt: new Date(),
      reviewedById: reviewer.user.id,
      reviewOwnerId: reviewer.user.id,
      nextAction: "Launch mentor action plan",
    },
  });

  await createMilestone({
    intakeCaseId: caseId,
    status: StudentIntakeCaseStatus.APPROVED,
    title: "Approved by chapter",
    body: `${intakeCase.studentName}'s journey was approved and the student record is now active.`,
    createdById: reviewer.user.id,
  });

  if (createdNewStudent) {
    await sendVerificationEmail(studentUserId);
  }

  await launchStudentIntakeMentorPlanInternal({
    intakeCaseId: caseId,
    reviewerId: reviewer.user.id,
  });

  await createSystemNotification(
    intakeCase.parentId,
    "SYSTEM",
    "Student journey approved",
    `${intakeCase.studentName}'s intake was approved. The chapter has started the next support steps.`,
    `/parent/student-intake/${caseId}`
  );

  revalidatePath("/parent");
  revalidatePath(`/parent/student-intake/${caseId}`);
  revalidatePath("/chapter");
  revalidatePath("/chapter/student-intake");
  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${studentUserId}`);
}

export async function rejectStudentIntakeCase(formData: FormData) {
  const caseId = getString(formData, "id");
  const reviewerNote = getString(formData, "reviewerNote", false);
  const blockerNote = getString(formData, "blockerNote", false);
  const nextAction = getString(formData, "nextAction", false);

  const { reviewer, intakeCase } = await assertReviewerHasCaseAccess(caseId);

  if (
    intakeCase.status !== StudentIntakeCaseStatus.SUBMITTED &&
    intakeCase.status !== StudentIntakeCaseStatus.UNDER_REVIEW
  ) {
    throw new Error("Only submitted or in-review cases can be rejected.");
  }

  await prisma.studentIntakeCase.update({
    where: { id: caseId },
    data: {
      status: StudentIntakeCaseStatus.REJECTED,
      reviewerNote: reviewerNote || intakeCase.reviewerNote || null,
      blockerNote: blockerNote || null,
      nextAction: nextAction || "Contact chapter team for next steps",
      reviewedAt: new Date(),
      reviewedById: reviewer.user.id,
      reviewOwnerId: reviewer.user.id,
    },
  });

  await createMilestone({
    intakeCaseId: caseId,
    status: StudentIntakeCaseStatus.REJECTED,
    title: "Needs follow-up before approval",
    body: `${intakeCase.chapter.name} updated the case and paused the journey for follow-up.`,
    createdById: reviewer.user.id,
  });

  await createSystemNotification(
    intakeCase.parentId,
    "SYSTEM",
    "Student journey needs follow-up",
    `${intakeCase.chapter.name} updated ${intakeCase.studentName}'s intake case and added a follow-up step.`,
    `/parent/student-intake/${caseId}`
  );

  revalidatePath("/parent");
  revalidatePath(`/parent/student-intake/${caseId}`);
  revalidatePath("/chapter");
  revalidatePath("/chapter/student-intake");
}
