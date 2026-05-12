import { redirect } from "next/navigation";

import ActionCenterSubNav from "@/components/leadership-action-center/sub-nav";
import ActionCenterSectionHeader from "@/components/leadership-action-center/section-header";
import ImportClient from "@/components/leadership-action-center/import-client";
import { getLeadershipSession } from "@/lib/leadership-action-center/authorization";
import { listMeetings } from "@/lib/leadership-action-center/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import · Leadership Action Center" };

export default async function ImportPage() {
  const session = await getLeadershipSession();
  if (!session) redirect("/");
  if (!session.canManage) redirect("/admin/action-center");

  const meetings = await listMeetings({ includeArchived: false });

  return (
    <div className="page-shell">
      <ActionCenterSectionHeader
        badge="Admin · Leadership"
        title="Import tasks"
        description="Paste rows from the spreadsheet or weekly email. Preview, deduplicate, then commit."
        actions={[{ label: "Tasks", href: "/admin/action-center/tasks" }]}
      />
      <ActionCenterSubNav />

      <ImportClient meetings={meetings.map((m) => ({ id: m.id, title: m.title }))} />
    </div>
  );
}
