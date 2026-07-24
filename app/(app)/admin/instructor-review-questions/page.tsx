import { redirect } from "next/navigation";

import { InstructorReviewQuestionsAdmin } from "@/components/admin/instructor-review-questions-admin";
import { requireSessionUser, hasRole } from "@/lib/authorization";
import { listInstructorReviewQuestions } from "@/lib/instructor-feedback-actions";

export const metadata = { title: "Mentorship review questions — Admin" };

export default async function InstructorReviewQuestionsPage() {
  const session = await requireSessionUser();
  if (!hasRole(session.roles, "ADMIN", session.primaryRole)) {
    redirect("/");
  }

  const questions = await listInstructorReviewQuestions();
  return <InstructorReviewQuestionsAdmin initialQuestions={questions} />;
}
