"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function submitMentorQuestion(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const passionId = formData.get("passionId") as string | null;
  const question = formData.get("question") as string;
  const isAnonymous = formData.get("isAnonymous") === "on";

  if (!question?.trim()) throw new Error("Question is required");

  await prisma.mentorQuestion.create({
    data: {
      studentId: session.user.id,
      passionId: passionId || null,
      question: question.trim(),
      isAnonymous,
      status: "PENDING",
      views: 0,
    },
  });

  revalidatePath("/mentor/ask");
}

export async function answerMentorQuestion(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const roles = session.user.roles ?? [];
  const canAnswer =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("ADMIN");
  if (!canAnswer) throw new Error("Unauthorized");

  const questionId = formData.get("questionId") as string;
  const answer = formData.get("answer") as string;

  if (!questionId || !answer?.trim()) throw new Error("Missing fields");

  await prisma.mentorAnswer.create({
    data: {
      questionId,
      mentorId: session.user.id,
      answer: answer.trim(),
      helpful: 0,
    },
  });

  // Mark question as answered
  await prisma.mentorQuestion.update({
    where: { id: questionId },
    data: { status: "ANSWERED" },
  });

  revalidatePath("/mentor/ask");
}

export async function upvoteMentorAnswer(answerId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.mentorAnswer.update({
    where: { id: answerId },
    data: { helpful: { increment: 1 } },
  });

  revalidatePath("/mentor/ask");
}
