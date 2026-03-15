"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createSurvey(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const chapterId = formData.get("chapterId") as string;

  if (!title) {
    throw new Error("Title is required");
  }

  const survey = await prisma.parentSurvey.create({
    data: {
      title,
      description: description || "",
      chapterId: chapterId || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/parent-surveys");
  return survey;
}

export async function addSurveyQuestion(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const surveyId = formData.get("surveyId") as string;
  const label = formData.get("label") as string;
  const fieldType = formData.get("fieldType") as string;
  const required = formData.get("required") === "true";
  const options = formData.get("options") as string;

  if (!surveyId || !label || !fieldType) {
    throw new Error("Missing required fields");
  }

  // Get the current max order for this survey
  const maxOrder = await prisma.parentSurveyQuestion.aggregate({
    where: { surveyId },
    _max: { sortOrder: true },
  });

  await prisma.parentSurveyQuestion.create({
    data: {
      surveyId,
      label,
      fieldType: fieldType as any,
      required,
      options: options || null,
      sortOrder: (maxOrder._max?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/admin/parent-surveys");
}

export async function removeSurveyQuestion(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const id = formData.get("id") as string;
  if (!id) {
    throw new Error("Question ID is required");
  }

  await prisma.parentSurveyQuestion.delete({
    where: { id },
  });

  revalidatePath("/admin/parent-surveys");
}

export async function publishSurvey(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const surveyId = formData.get("surveyId") as string;
  if (!surveyId) {
    throw new Error("Survey ID is required");
  }

  await prisma.parentSurvey.update({
    where: { id: surveyId },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/admin/parent-surveys");
  revalidatePath("/parent/feedback");
}

export async function closeSurvey(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const surveyId = formData.get("surveyId") as string;
  if (!surveyId) {
    throw new Error("Survey ID is required");
  }

  await prisma.parentSurvey.update({
    where: { id: surveyId },
    data: { status: "CLOSED" },
  });

  revalidatePath("/admin/parent-surveys");
  revalidatePath("/parent/feedback");
}

export async function submitSurveyResponse(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const surveyId = formData.get("surveyId") as string;
  if (!surveyId) {
    throw new Error("Survey ID is required");
  }

  // Check survey is active
  const survey = await prisma.parentSurvey.findUnique({
    where: { id: surveyId },
    include: { questions: true },
  });

  if (!survey || survey.status !== "ACTIVE") {
    throw new Error("Survey is not active");
  }

  // Check if user already responded
  const existingResponse = await prisma.parentSurveyResponse.findFirst({
    where: {
      surveyId,
      parentId: session.user.id,
    },
  });

  if (existingResponse) {
    throw new Error("You have already responded to this survey");
  }

  // Create response with answers
  const response = await prisma.parentSurveyResponse.create({
    data: {
      surveyId,
      parentId: session.user.id,
    },
  });

  // Create answers for each question
  for (const question of survey.questions) {
    const answerValue = formData.get(`answer_${question.id}`) as string;
    if (answerValue !== null && answerValue !== undefined) {
      await prisma.parentSurveyAnswer.create({
        data: {
          responseId: response.id,
          questionId: question.id,
          value: answerValue || "",
        },
      });
    }
  }

  revalidatePath("/parent/feedback");
  revalidatePath(`/parent/surveys/${surveyId}`);
  revalidatePath("/admin/parent-surveys");
}

export async function getSurveyResults(surveyId: string) {
  const survey = await prisma.parentSurvey.findUnique({
    where: { id: surveyId },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          answers: true,
        },
      },
      responses: true,
    },
  });

  if (!survey) {
    throw new Error("Survey not found");
  }

  const responseCount = survey.responses.length;

  const questionResults = survey.questions.map((question) => {
    const answers = question.answers;
    const distribution: Record<string, number> = {};

    for (const answer of answers) {
      const val = answer.value || "(empty)";
      distribution[val] = (distribution[val] || 0) + 1;
    }

    return {
      id: question.id,
      label: question.label,
      fieldType: question.fieldType,
      answerCount: answers.length,
      distribution,
    };
  });

  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    responseCount,
    questions: questionResults,
  };
}
