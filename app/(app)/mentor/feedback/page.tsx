import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function MentorFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="💬"
      badge="Mentorship"
      title="Mentor Feedback Portal"
      description="This page will let students submit work for review and receive personalized feedback from experienced mentors and instructors."
      addedBy="students (requests) and mentors (feedback)"
      actionLabel="Go to Mentor Dashboard"
      actionHref="/admin/mentors"
    />
  );
}
