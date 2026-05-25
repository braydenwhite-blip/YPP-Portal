import { redirect } from "next/navigation";

import ActionCenterSubNav from "@/components/leadership-action-center/sub-nav";
import ActionCenterSectionHeader from "@/components/leadership-action-center/section-header";
import TaskTableClient from "@/components/leadership-action-center/task-table-client";
import { getLeadershipSession } from "@/lib/leadership-action-center/authorization";
import {
  listActionItems,
  listLeadershipUsers,
  listMeetings,
} from "@/lib/leadership-action-center/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Items · Leadership Action Center" };

export default async function ActionCenterTasksPage() {
  const session = await getLeadershipSession();
  if (!session) redirect("/");

  const [items, users, meetings] = await Promise.all([
    listActionItems({ includeArchived: false }),
    listLeadershipUsers(),
    listMeetings({ includeArchived: false }),
  ]);

  const rows = items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? null,
    category: item.category,
    status: item.status,
    priority: item.priority,
    dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    weekStart: item.weekStart ? item.weekStart.toISOString() : null,
    needsOfficerDiscussion: item.needsOfficerDiscussion,
    officerDiscussionDate: item.officerDiscussionDate
      ? item.officerDiscussionDate.toISOString()
      : null,
    meetingId: item.meeting?.id ?? null,
    meetingTitle: item.meeting?.title ?? null,
    primaryOwnerId: item.primaryOwner?.id ?? null,
    primaryOwnerName: item.primaryOwner?.name ?? null,
    ownerNames: item.ownerNames,
    inputNeededNames: item.inputNeededNames,
    inputNeededUsers: item.inputNeededFrom.map((link) => ({
      id: link.user.id,
      name: link.user.name,
      email: link.user.email,
    })),
    inputNeededUserIds: item.inputNeededFrom.map((link) => link.user.id),
    notes: item.notes ?? null,
    archivedAt: item.archivedAt ? item.archivedAt.toISOString() : null,
    updatedAt: item.updatedAt.toISOString(),
    updates: [] as Array<{
      id: string;
      kind: string;
      body: string;
      createdAt: string;
      authorName: string | null;
    }>,
  }));

  // Activity log lazy-loads via the detail drawer's edit action; we only need
  // the per-row updates count for now to keep the initial payload light.

  return (
    <div className="page-shell">
      <ActionCenterSectionHeader
        badge="Admin · Leadership"
        title="Action items"
        description="Filter, edit, and review the entire tracker. Click a row to open details."
        actions={[
          { label: "Overview", href: "/admin/action-center" },
          { label: "Import", href: "/admin/action-center/import" },
        ]}
      />

      <ActionCenterSubNav />

      <TaskTableClient
        rows={rows}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        meetings={meetings.map((m) => ({ id: m.id, title: m.title }))}
      />
    </div>
  );
}
