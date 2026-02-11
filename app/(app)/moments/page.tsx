import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function BreakthroughMomentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="💡"
      badge="Breakthroughs"
      title="Breakthrough Moments"
      description="This page will celebrate students' 'aha!' moments — those times when everything clicks. Students share breakthroughs and the community celebrates them."
      addedBy="students (moments) and mentors (recognition)"
      actionLabel="Go to Admin Panel"
      actionHref="/admin"
    />
  );
}
