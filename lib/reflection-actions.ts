"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { QuestionType, RoleType } from "@prisma/client";

// ============================================
// REFLECTION FORM MANAGEMENT (Admin)
// ============================================

export async function getReflectionForms() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  return prisma.reflectionForm.findMany({
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
      },
      _count: {
        select: { submissions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReflectionFormById(formId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  return prisma.reflectionForm.findUnique({
    where: { id: formId },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function createReflectionForm(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can create reflection forms");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const roleType = formData.get("roleType") as RoleType;

  const form = await prisma.reflectionForm.create({
    data: {
      title,
      description,
      roleType,
    },
  });

  revalidatePath("/admin/reflection-forms");
  return form;
}

export async function updateReflectionForm(formId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can update reflection forms");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const isActive = formData.get("isActive") === "true";

  const form = await prisma.reflectionForm.update({
    where: { id: formId },
    data: {
      title,
      description,
      isActive,
    },
  });

  revalidatePath("/admin/reflection-forms");
  return form;
}

// ============================================
// REFLECTION QUESTION MANAGEMENT (Admin)
// ============================================

export async function addReflectionQuestion(formId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can add questions");
  }

  const question = formData.get("question") as string;
  const type = formData.get("type") as QuestionType;
  const required = formData.get("required") === "true";
  const optionsRaw = formData.get("options") as string;
  const options = optionsRaw ? optionsRaw.split(",").map((o) => o.trim()) : [];

  // Get the next sort order
  const lastQuestion = await prisma.reflectionQuestion.findFirst({
    where: { formId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (lastQuestion?.sortOrder || 0) + 1;

  const newQuestion = await prisma.reflectionQuestion.create({
    data: {
      formId,
      question,
      type,
      required,
      options,
      sortOrder,
    },
  });

  revalidatePath("/admin/reflection-forms");
  return newQuestion;
}

export async function updateReflectionQuestion(
  questionId: string,
  formData: FormData
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can update questions");
  }

  const question = formData.get("question") as string;
  const type = formData.get("type") as QuestionType;
  const required = formData.get("required") === "true";
  const optionsRaw = formData.get("options") as string;
  const options = optionsRaw ? optionsRaw.split(",").map((o) => o.trim()) : [];
  const sortOrder = parseInt(formData.get("sortOrder") as string);

  const updated = await prisma.reflectionQuestion.update({
    where: { id: questionId },
    data: {
      question,
      type,
      required,
      options,
      sortOrder,
    },
  });

  revalidatePath("/admin/reflection-forms");
  return updated;
}

export async function deleteReflectionQuestion(questionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can delete questions");
  }

  await prisma.reflectionQuestion.delete({
    where: { id: questionId },
  });

  revalidatePath("/admin/reflection-forms");
}

// ============================================
// REFLECTION SUBMISSION (Users)
// ============================================

export async function getActiveReflectionForm() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) throw new Error("User not found");

  // Find the active form for the user's role
  const form = await prisma.reflectionForm.findFirst({
    where: {
      roleType: user.primaryRole,
      isActive: true,
    },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return form;
}

export async function submitReflection(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const formId = formData.get("formId") as string;
  const monthStr = formData.get("month") as string;
  const month = new Date(monthStr);

  // Check if already submitted for this month
  const existingSubmission = await prisma.reflectionSubmission.findFirst({
    where: {
      userId: session.user.id,
      formId,
      month: {
        gte: new Date(month.getFullYear(), month.getMonth(), 1),
        lt: new Date(month.getFullYear(), month.getMonth() + 1, 1),
      },
    },
  });

  if (existingSubmission) {
    throw new Error("You have already submitted a reflection for this month");
  }

  // Get all questions for this form
  const questions = await prisma.reflectionQuestion.findMany({
    where: { formId },
  });

  // Collect responses
  const responses: { questionId: string; value: string }[] = [];
  for (const question of questions) {
    const value = formData.get(`question_${question.id}`) as string;
    if (question.required && !value) {
      throw new Error(`Please answer: ${question.question}`);
    }
    if (value) {
      responses.push({ questionId: question.id, value });
    }
  }

  // Create submission with responses
  const submission = await prisma.reflectionSubmission.create({
    data: {
      userId: session.user.id,
      formId,
      month,
      responses: {
        create: responses.map((r) => ({
          questionId: r.questionId,
          value: r.value,
        })),
      },
    },
    include: {
      responses: true,
    },
  });

  revalidatePath("/reflection");
  revalidatePath("/reflection/history");
  return submission;
}

export async function getMyReflections() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  return prisma.reflectionSubmission.findMany({
    where: { userId: session.user.id },
    include: {
      form: true,
      responses: {
        include: {
          question: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getReflectionById(submissionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const submission = await prisma.reflectionSubmission.findUnique({
    where: { id: submissionId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      form: true,
      responses: {
        include: {
          question: true,
        },
        orderBy: {
          question: { sortOrder: "asc" },
        },
      },
    },
  });

  if (!submission) return null;

  // Check access - user can see their own, mentors/admins can see mentees'
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      mentorPairs: { where: { menteeId: submission.userId } },
    },
  });

  const isOwner = submission.userId === session.user.id;
  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isMentor = (user?.mentorPairs?.length || 0) > 0;
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isOwner && !isAdmin && !isMentor && !isChapterLead) {
    throw new Error("Unauthorized to view this reflection");
  }

  return submission;
}

// ============================================
// REFLECTION VIEWING (Mentors/Admin)
// ============================================

export async function getMenteeReflections(menteeId?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      mentorPairs: true,
    },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isMentor = user?.roles.some(
    (r) => r.role === "MENTOR" || r.role === "CHAPTER_LEAD"
  );

  if (!isAdmin && !isMentor) {
    throw new Error("Unauthorized");
  }

  // Get mentee IDs
  let menteeIds: string[] = [];
  if (menteeId) {
    menteeIds = [menteeId];
  } else if (isAdmin) {
    // Admins can see all
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    menteeIds = allUsers.map((u) => u.id);
  } else {
    // Mentors see their mentees
    menteeIds = user?.mentorPairs?.map((m) => m.menteeId) || [];
  }

  return prisma.reflectionSubmission.findMany({
    where: {
      userId: { in: menteeIds },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, primaryRole: true },
      },
      form: true,
      responses: {
        include: {
          question: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getAllReflectionSubmissions(filters?: {
  roleType?: RoleType;
  month?: Date;
  chapterId?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const where: any = {};

  if (filters?.roleType) {
    where.user = { primaryRole: filters.roleType };
  }

  if (filters?.month) {
    const startOfMonth = new Date(
      filters.month.getFullYear(),
      filters.month.getMonth(),
      1
    );
    const endOfMonth = new Date(
      filters.month.getFullYear(),
      filters.month.getMonth() + 1,
      1
    );
    where.month = { gte: startOfMonth, lt: endOfMonth };
  }

  if (filters?.chapterId || (!isAdmin && isChapterLead)) {
    where.user = {
      ...where.user,
      chapterId: filters?.chapterId || user?.chapterId,
    };
  }

  return prisma.reflectionSubmission.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapterId: true,
        },
      },
      form: true,
      responses: {
        include: { question: true },
        orderBy: { question: { sortOrder: "asc" } },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
}

// ============================================
// DEFAULT FORM CREATION (Utility)
// ============================================

export async function createDefaultReflectionForms() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can create default forms");
  }

  // Create default instructor reflection form
  const instructorForm = await prisma.reflectionForm.upsert({
    where: { id: "default-instructor-form" },
    create: {
      id: "default-instructor-form",
      title: "Monthly Instructor Reflection",
      description: "Share your experiences and plan your growth",
      roleType: "INSTRUCTOR",
      isActive: true,
      questions: {
        create: [
          {
            question: "How happy are you at YPP?",
            type: "RATING_1_5",
            required: true,
            sortOrder: 1,
          },
          {
            question: "What's working well for you?",
            type: "TEXTAREA",
            required: true,
            sortOrder: 2,
          },
          {
            question:
              "What support or changes would help you succeed in this role and beyond YPP?",
            type: "TEXTAREA",
            required: true,
            sortOrder: 3,
          },
          {
            question: "Revisions to future goals",
            type: "TEXTAREA",
            required: false,
            sortOrder: 4,
          },
          {
            question: "Action Items and Implementation Plan",
            type: "TEXTAREA",
            required: true,
            sortOrder: 5,
          },
        ],
      },
    },
    update: {},
  });

  // Create default chapter lead reflection form
  const chapterLeadForm = await prisma.reflectionForm.upsert({
    where: { id: "default-chapter-lead-form" },
    create: {
      id: "default-chapter-lead-form",
      title: "Monthly Chapter President Reflection",
      description: "Reflect on your chapter leadership and growth",
      roleType: "CHAPTER_LEAD",
      isActive: true,
      questions: {
        create: [
          {
            question: "How happy are you at YPP?",
            type: "RATING_1_5",
            required: true,
            sortOrder: 1,
          },
          {
            question: "What's working well for your chapter?",
            type: "TEXTAREA",
            required: true,
            sortOrder: 2,
          },
          {
            question: "What challenges is your chapter facing?",
            type: "TEXTAREA",
            required: true,
            sortOrder: 3,
          },
          {
            question:
              "What support or resources would help your chapter succeed?",
            type: "TEXTAREA",
            required: true,
            sortOrder: 4,
          },
          {
            question: "Goals and action items for next month",
            type: "TEXTAREA",
            required: true,
            sortOrder: 5,
          },
        ],
      },
    },
    update: {},
  });

  revalidatePath("/admin/reflection-forms");
  return { instructorForm, chapterLeadForm };
}
