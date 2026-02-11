import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";

export default async function ParentResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <EmptyState
      icon="📚"
      badge="Parent Portal"
      title="Resources for Parents"
      description="This page will provide curated articles, guides, and resources to help parents understand and support their student's passion journey — from college prep to mental health."
      addedBy="admins (content is published by the YPP team)"
      actionLabel="Go to Admin Panel"
      actionHref="/admin"
    />
  );
}
