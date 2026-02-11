import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function CuratedResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="📚"
      badge="Mentorship"
      title="Curated Resources"
      description="This page will show hand-picked resources recommended by mentors — the best free and paid courses, books, tools, and videos for each passion area."
      addedBy="mentors and instructors"
      actionLabel="Go to Mentor Dashboard"
      actionHref="/admin/mentors"
    />
  );
}
