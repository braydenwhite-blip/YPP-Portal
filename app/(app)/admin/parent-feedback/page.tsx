import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ParentFeedbackPanel from "@/components/parent-feedback-panel";
import { listAllParentFeedback, summarizeParentFeedback } from "@/lib/parent-feedback-service";

export const metadata = { title: "Admin Parent Feedback | YPP" };

export default async function AdminParentFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const feedback = await listAllParentFeedback();

  return (
    <ParentFeedbackPanel
      title="Admin Parent Feedback"
      subtitle="Platform-wide feedback from parents across chapters, students, and instructors."
      feedback={feedback}
      summary={summarizeParentFeedback(feedback)}
      emptyMessage="No parent feedback has been submitted yet."
    />
  );
}
