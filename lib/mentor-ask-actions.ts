"use server";

import {
import { getSession } from "@/lib/auth-supabase";
  createMentorshipRequest,
  markMentorshipResponseHelpful,
  respondToMentorshipRequest,
} from "@/lib/mentorship-hub-actions";

export async function submitMentorQuestion(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const question = String(formData.get("question") ?? "").trim();
  if (!question) throw new Error("Question is required");

  const requestFormData = new FormData();
  requestFormData.set("kind", "GENERAL_QNA");
  requestFormData.set("visibility", "PUBLIC");
  requestFormData.set("question", question);

  const passionId = String(formData.get("passionId") ?? "").trim();
  if (passionId) {
    requestFormData.set("passionId", passionId);
  }

  if (
    formData.get("isAnonymous") === "on" ||
    String(formData.get("isAnonymous") ?? "").trim() === "true"
  ) {
    requestFormData.set("isAnonymous", "true");
  }

  await createMentorshipRequest(requestFormData);
}

export async function answerMentorQuestion(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const roles = session.user.roles ?? [];
  const canAnswer =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("ADMIN");
  if (!canAnswer) throw new Error("Unauthorized");

  const requestFormData = new FormData();
  requestFormData.set("requestId", String(formData.get("questionId") ?? ""));
  requestFormData.set("answer", String(formData.get("answer") ?? ""));
  await respondToMentorshipRequest(requestFormData);
}

export async function upvoteMentorAnswer(answerId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await markMentorshipResponseHelpful(answerId);
}
