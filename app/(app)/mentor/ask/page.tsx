import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function AskMentorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="🙋"
      badge="Mentorship"
      title="Ask a Mentor"
      description="This page will let students ask questions and get advice from experienced mentors and instructors. Browse answered questions or submit your own."
      addedBy="students (questions) and mentors (answers)"
      actionLabel="Go to Mentor Dashboard"
      actionHref="/admin/mentors"
    />
  );
}
