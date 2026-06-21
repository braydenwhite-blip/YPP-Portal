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
import { loadClassCommandCenter } from "@/lib/classes/command-center";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classes — Pathways Portal" };

function asTab(value: string | undefined): ClassOperationsTab {
  if (value === "ready" || value === "attention") return "operations";
  if (value === "review" || value === "archive") return value;
  return "operations";
}

/** Manage the class catalog — program operations for admins. */
export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; cursor?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  if (!hasRole(session.user.roles, "ADMIN", session.user.primaryRole ?? null)) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const tab = asTab(params.tab);
  const cursor = params.cursor ?? null;

  const [operationsPage, proposals] = await Promise.all([
    getAdminClassOperationsList({ cursor }),
    getAdminProposalQueue(),
  ]);

  const counts = deriveClassOperationsCounts(operationsPage.items, proposals);
  const liveItems = operationsPage.items.filter(
    (o) => !o.actionFlags.isCancelled && !o.actionFlags.isCompleted
  );
  const commandCenter =
    tab === "operations" ? await loadClassCommandCenter(liveItems) : null;

  return (
    <ClassOperationsHub
      tab={tab}
      operationsPage={operationsPage}
      proposals={proposals}
      counts={counts}
      commandCenter={commandCenter}
    />
  );
}
