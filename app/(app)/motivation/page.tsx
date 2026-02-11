import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function MotivationBoostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="💪"
      badge="Support"
      title="Motivation Boost"
      description="This page will provide quick encouragement from mentors who've walked this path — words of support for when students feel stuck, frustrated, or burned out."
      addedBy="admins and mentors"
      actionLabel="Go to Admin Panel"
      actionHref="/admin"
    />
  );
}
