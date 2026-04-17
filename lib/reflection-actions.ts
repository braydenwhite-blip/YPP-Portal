"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { MentorshipProgramGroup, QuestionType, RoleType } from "@prisma/client";
import { parseRoleType } from "@/lib/authorization";
import { getMentorshipProgramGroupForRole } from "@/lib/mentorship-canonical";

// ============================================
// REFLECTION FORM MANAGEMENT (Admin)
// ============================================

export async function getReflectionForms() {
  const session = await getSession();
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
  const session = await getSession();
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
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      mentorPairs: {
        select: { menteeId: true },
      },
    },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can create reflection forms");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const roleType = parseRoleType(formData.get("roleType")) as RoleType;
  const groupRaw = String(formData.get("mentorshipProgramGroup") ?? "").trim();
  const mentorshipProgramGroup =
    groupRaw &&
    Object.values(MentorshipProgramGroup).includes(
      groupRaw as MentorshipProgramGroup
    )
      ? (groupRaw as MentorshipProgramGroup)
      : null;

  const form = await prisma.reflectionForm.create({
    data: {
      title,
      description,
      roleType,
      mentorshipProgramGroup,
    },
  });

  revalidatePath("/admin/reflection-forms");
  return form;
}

export async function updateReflectionForm(formId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      mentorPairs: {
        select: { menteeId: true },
      },
    },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can update reflection forms");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const isActive = formData.get("isActive") === "true";
  const groupRaw = String(formData.get("mentorshipProgramGroup") ?? "").trim();
  const mentorshipProgramGroup =
    groupRaw &&
    Object.values(MentorshipProgramGroup).includes(
      groupRaw as MentorshipProgramGroup
    )
      ? (groupRaw as MentorshipProgramGroup)
      : null;

  const form = await prisma.reflectionForm.update({
    where: { id: formId },
    data: {
      title,
      description,
      isActive,
      mentorshipProgramGroup,
    },
  });

  revalidatePath("/admin/reflection-forms");
  return form;
}

// ============================================
// REFLECTION QUESTION MANAGEMENT (Admin)
// ============================================

export async function addReflectionQuestion(formId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      mentorPairs: {
        select: { menteeId: true },
      },
    },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can add questions");
  }

  const question = formData.get("question") as string;
  const sectionTitle = (formData.get("sectionTitle") as string) || "";
  const helperText = (formData.get("helperText") as string) || "";
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
      sectionTitle: sectionTitle || null,
      helperText: helperText || null,
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
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      mentorPairs: {
        select: { menteeId: true },
      },
    },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can update questions");
  }

  const question = formData.get("question") as string;
  const sectionTitle = (formData.get("sectionTitle") as string) || "";
  const helperText = (formData.get("helperText") as string) || "";
  const type = formData.get("type") as QuestionType;
  const required = formData.get("required") === "true";
  const optionsRaw = formData.get("options") as string;
  const options = optionsRaw ? optionsRaw.split(",").map((o) => o.trim()) : [];
  const sortOrder = parseInt(formData.get("sortOrder") as string);

  const updated = await prisma.reflectionQuestion.update({
    where: { id: questionId },
    data: {
      question,
      sectionTitle: sectionTitle || null,
      helperText: helperText || null,
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
  const session = await getSession();
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
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [user, activeMentorship] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
    }),
    prisma.mentorship.findFirst({
      where: {
        menteeId: session.user.id,
        status: "ACTIVE",
      },
      select: {
        programGroup: true,
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  if (!user) throw new Error("User not found");

  const programGroup =
    activeMentorship?.programGroup ??
    getMentorshipProgramGroupForRole(user.primaryRole);

  const forms = await prisma.reflectionForm.findMany({
    where: {
      roleType: user.primaryRole,
      isActive: true,
    },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    forms.find((form) => form.mentorshipProgramGroup === programGroup) ??
    forms.find((form) => form.mentorshipProgramGroup == null) ??
    forms[0] ??
    null
  );
}

export async function submitReflection(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const formId = formData.get("formId") as string;
  const monthStr = formData.get("month") as string;
  const parsedMonth = new Date(monthStr);
  const month = new Date(parsedMonth.getFullYear(), parsedMonth.getMonth(), 1);

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
  revalidatePath("/mentorship");
  revalidatePath("/my-program");
  return submission;
}

export async function getMyReflections() {
  const session = await getSession();
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
  const session = await getSession();
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
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT");

  if (!isOwner && !isAdmin && !isMentor && !isChapterLead) {
    throw new Error("Unauthorized to view this reflection");
  }

  return submission;
}

// ============================================
// REFLECTION VIEWING (Mentors/Admin)
// ============================================

export async function getMenteeReflections(menteeId?: string) {
  const session = await getSession();
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
    (r) => r.role === "MENTOR" || r.role === "CHAPTER_PRESIDENT"
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
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: true,
      mentorPairs: {
        select: { menteeId: true },
      },
    },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT");
  const isMentor = user?.roles.some((r) => r.role === "MENTOR");

  if (!isAdmin && !isChapterLead && !isMentor) {
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

  if (!isAdmin && isMentor && !isChapterLead) {
    const menteeIds = (user?.mentorPairs ?? []).map(
      (pairing: { menteeId: string }) => pairing.menteeId
    );
    where.userId = { in: menteeIds.length > 0 ? menteeIds : ["__none__"] };
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
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  if (!user?.roles.some((r) => r.role === "ADMIN")) {
    throw new Error("Only admins can create default forms");
  }

  const formConfigs: Array<{
    id: string;
    title: string;
    description: string;
    roleType: RoleType;
  }> = [
    {
      id: "default-instructor-form",
      title: "Monthly Instructor Self-Reflection",
      description: "Reflect on your goals, collaboration, and support needs.",
      roleType: "INSTRUCTOR",
    },
    {
      id: "default-chapter-lead-form",
      title: "Monthly Chapter President Self-Reflection",
      description: "Reflect on leadership progress, collaboration, and next steps.",
      roleType: "CHAPTER_PRESIDENT",
    },
    {
      id: "default-mentor-form",
      title: "Monthly Mentor Self-Reflection",
      description: "Reflect on mentorship support, collaboration, and next steps.",
      roleType: "MENTOR",
    },
    {
      id: "default-staff-form",
      title: "Monthly Staff Self-Reflection",
      description: "Reflect on progress, teamwork, and support needs.",
      roleType: "STAFF",
    },
    {
      id: "default-student-form",
      title: "Monthly Student Self-Reflection",
      description: "Reflect on progress, support needs, and next steps.",
      roleType: "STUDENT",
    },
  ];

  const defaultQuestions = [
    {
      sectionTitle: "Overall Reflection",
      helperText: "Share the big picture from this month.",
      question: "How would you describe this past month? How is YPP performing overall from your perspective?",
      type: "TEXTAREA" as QuestionType,
      required: true,
    },
    {
      sectionTitle: "Engagement & Fulfillment",
      helperText: "Focus on what is working and where support is needed.",
      question: "How has your experience been working in your position over the past month?",
      type: "TEXTAREA" as QuestionType,
      required: true,
    },
    {
      sectionTitle: "Engagement & Fulfillment",
      helperText: "Call out what is going especially well.",
      question: "What is working especially well for you?",
      type: "TEXTAREA" as QuestionType,
      required: true,
    },
    {
      sectionTitle: "Engagement & Fulfillment",
      helperText: "Name the support, changes, or mentorship that would help most.",
      question: "What support or changes would help you perform at your highest level? How helpful has your mentor been this month? How can we better support you?",
      type: "TEXTAREA" as QuestionType,
      required: true,
    },
    {
      sectionTitle: "Leadership Team Collaboration",
      helperText: "Reflect on collaboration and communication.",
      question: "How would you assess collaboration and communication within the leadership team?",
      type: "TEXTAREA" as QuestionType,
      required: true,
    },
    {
      sectionTitle: "Leadership Team Collaboration",
      helperText: "Recognize strong contributors and areas to improve.",
      question: "Are there team members who have gone above and beyond? Are there areas or ways where stronger collaboration or communication is needed?",
      type: "TEXTAREA" as QuestionType,
      required: false,
    },
    {
      sectionTitle: "Goal Progress",
      helperText: "Use this for goal-by-goal monthly progress, blockers, wins, and next steps.",
      question: "For each assigned goal, what progress was made, what was accomplished, what blockers exist, and what are you hoping to accomplish next month?",
      type: "TEXTAREA" as QuestionType,
      required: true,
    },
    {
      sectionTitle: "Additional Reflections",
      helperText: "Include extra wins, concerns, ideas, feedback, or deliverables.",
      question: "Is there anything else you would like us to know, including wins, concerns, ideas, feedback, or deliverables you sent or are sending?",
      type: "TEXTAREA" as QuestionType,
      required: false,
    },
  ];

  const forms = [];

  for (const config of formConfigs) {
    const form = await prisma.reflectionForm.upsert({
      where: { id: config.id },
      create: {
        id: config.id,
        title: config.title,
        description: config.description,
        roleType: config.roleType,
        isActive: true,
      },
      update: {
        title: config.title,
        description: config.description,
        roleType: config.roleType,
        isActive: true,
      },
    });

    await prisma.reflectionQuestion.deleteMany({
      where: { formId: form.id },
    });

    await prisma.reflectionQuestion.createMany({
      data: defaultQuestions.map((question, index) => ({
        formId: form.id,
        sectionTitle: question.sectionTitle,
        helperText: question.helperText,
        question: question.question,
        type: question.type,
        options: [],
        required: question.required,
        sortOrder: index + 1,
      })),
    });

    forms.push(form);
  }

  revalidatePath("/admin/reflection-forms");
  revalidatePath("/reflection");
  return forms;
}
