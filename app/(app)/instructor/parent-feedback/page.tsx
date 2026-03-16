import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ParentFeedbackPanel from "@/components/parent-feedback-panel";
import {
  listAllParentFeedback,
  listChapterParentFeedback,
  listInstructorScopedParentFeedback,
  summarizeParentFeedback,
} from "@/lib/parent-feedback-service";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Parent Feedback | YPP" };

export default async function InstructorParentFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const canAccess =
    roles.includes("INSTRUCTOR") || roles.includes("ADMIN") || roles.includes("CHAPTER_LEAD");

  if (!canAccess) {
    redirect("/");
  }

  const chapterId = session.user.chapterId ?? null;

  const feedback = roles.includes("ADMIN")
    ? await listAllParentFeedback()
    : roles.includes("CHAPTER_LEAD") && chapterId
      ? await listChapterParentFeedback(chapterId)
      : await listInstructorScopedParentFeedback(session.user.id);

  const scopeLabel = roles.includes("ADMIN")
    ? "Platform-wide view for admin review."
    : roles.includes("CHAPTER_LEAD")
      ? chapterId
        ? `Chapter-scoped view for ${(
            await prisma.chapter.findUnique({
              where: { id: chapterId },
              select: { name: true },
            })
          )?.name ?? "your chapter"}.`
        : "Chapter-scoped view."
      : "Feedback linked to your classes, students, or instructor profile.";

  return (
    <ParentFeedbackPanel
      title="Parent Feedback"
      subtitle={scopeLabel}
      feedback={feedback}
      summary={summarizeParentFeedback(feedback)}
      emptyMessage="No parent feedback is connected to this view yet."
    />
  );
}
