import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function ParentConnectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="👨‍👩‍👧‍👦"
      badge="Parent Portal"
      title="Connect with Students"
      description="This page will let parents connect their account with their student(s) to view progress, receive reports, and stay engaged with the passion journey."
      addedBy="parents (connection requests) and students (approvals)"
      actionLabel="Go to Admin Panel"
      actionHref="/admin"
    />
  );
}
