import { redirect } from "next/navigation";

import { PeopleReviewsPage } from "@/components/people-strategy/people-reviews-page";
import { getSession } from "@/lib/auth-supabase";
import { canAccessLeadershipPreviewStack } from "@/lib/leadership-preview-access";
import { type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { getPeopleHubAccess } from "@/lib/people/hub-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "People & Reviews — Pathways Portal" };

/** Leadership landing — People & Reviews mockup. Others go to the directory. */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (
    !canAccessLeadershipPreviewStack({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles: session.user.roles,
      primaryRole: session.user.primaryRole,
      internalLevel: session.user.internalLevel,
    })
  ) {
    redirect("/");
  }

  const hubAccess = getPeopleHubAccess(viewer);
  if (!hubAccess.showPerformance) {
    redirect("/people/directory");
  }

  return <PeopleReviewsPage searchParams={searchParams} basePath="/people" />;
}
