import { redirect } from "next/navigation";

import {
  ClassOperationsHub,
  deriveClassOperationsCounts,
  type ClassOperationsTab,
} from "@/components/classes/class-operations-hub";
import { getSession } from "@/lib/auth-supabase";
import { hasRole } from "@/lib/authorization";
import {
  getAdminClassOperationsList,
  getAdminProposalQueue,
} from "@/lib/admin-class-operations";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import {
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classes · People · Pathways Portal" };

function asTab(value: string | undefined): ClassOperationsTab {
  // Legacy tab names → current views
  if (value === "ready" || value === "attention") return "operations";
  if (value === "review" || value === "archive") return value;
  return "operations";
}

/** Manage the class catalog — under People so officers know where to go. */
export default async function PeopleClassesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; cursor?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  if (!hasRole(viewer.roles, "ADMIN", viewer.primaryRole ?? null)) {
    redirect("/people");
  }

  const params = (await searchParams) ?? {};
  const tab = asTab(params.tab);
  const cursor = params.cursor ?? null;

  const [operationsPage, proposals] = await Promise.all([
    getAdminClassOperationsList({ cursor }),
    getAdminProposalQueue(),
  ]);

  const counts = deriveClassOperationsCounts(operationsPage.items, proposals);
  const hubAccess = getPeopleHubAccess(viewer);

  return (
    <ClassOperationsHub
      tab={tab}
      operationsPage={operationsPage}
      proposals={proposals}
      counts={counts}
      showPeopleNav
      showPerformanceTab={hubAccess.showPerformance}
    />
  );
}
