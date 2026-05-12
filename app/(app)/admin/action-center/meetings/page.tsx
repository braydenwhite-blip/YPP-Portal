import { redirect } from "next/navigation";

import ActionCenterSubNav from "@/components/leadership-action-center/sub-nav";
import ActionCenterSectionHeader from "@/components/leadership-action-center/section-header";
import MeetingsClient from "@/components/leadership-action-center/meetings-client";
import { getLeadershipSession } from "@/lib/leadership-action-center/authorization";
import { listLeadershipUsers } from "@/lib/leadership-action-center/queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings · Leadership Action Center" };

export default async function MeetingsPage() {
  const session = await getLeadershipSession();
  if (!session) redirect("/");

  const [meetings, users] = await Promise.all([
    prisma.leadershipMeeting.findMany({
      where: { archivedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        actionItems: {
          where: { archivedAt: null },
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            dueDate: true,
            needsOfficerDiscussion: true,
            officerDiscussionDate: true,
            primaryOwner: { select: { name: true } },
            notes: true,
          },
          orderBy: [
            { needsOfficerDiscussion: "desc" },
            { dueDate: { sort: "asc", nulls: "last" } },
          ],
        },
        _count: { select: { actionItems: true } },
      },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    }),
    listLeadershipUsers(),
  ]);

  const dto = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    kind: m.kind,
    scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
    notes: m.notes,
    ownerId: m.owner?.id ?? null,
    ownerName: m.owner?.name ?? null,
    archivedAt: m.archivedAt ? m.archivedAt.toISOString() : null,
    taskCount: m._count.actionItems,
    tasks: m.actionItems.map((task) => ({
      id: task.id,
      title: task.title,
      category: task.category,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      needsOfficerDiscussion: task.needsOfficerDiscussion,
      officerDiscussionDate: task.officerDiscussionDate
        ? task.officerDiscussionDate.toISOString()
        : null,
      primaryOwnerName: task.primaryOwner?.name ?? null,
      notes: task.notes,
    })),
  }));

  return (
    <div className="page-shell">
      <ActionCenterSectionHeader
        badge="Admin · Leadership"
        title="Meetings"
        description="Officers, Marketing, Tech, and other leadership meetings. Click one to see linked tasks and a suggested agenda."
        actions={[{ label: "+ New meeting", href: "/admin/action-center/meetings?new=1", primary: true }]}
      />
      <ActionCenterSubNav />
      <MeetingsClient
        meetings={dto}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
      />
    </div>
  );
}
