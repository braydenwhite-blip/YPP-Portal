import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function AwardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="🏆"
      badge="Recognition"
      title="Awards & Achievements"
      description="This page will display awards earned by students — recognition for dedication, breakthrough moments, persistence, improvement, and innovation."
      addedBy="admins and instructors"
      actionLabel="Go to Admin Panel"
      actionHref="/admin"
    />
  );
}
