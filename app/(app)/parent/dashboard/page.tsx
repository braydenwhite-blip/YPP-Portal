import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="📊"
      badge="Parent Portal"
      title="My Student Dashboard"
      description="This page will show parents an overview of their connected student's progress — recent activity, passion areas, upcoming events, and quick stats."
      addedBy="instructors and the system (from student activity)"
      actionLabel="Connect a Student"
      actionHref="/parent/connect"
    />
  );
}
