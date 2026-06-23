import { PageHeaderV2 } from "@/components/ui-v2";
import { TeamAdmin } from "@/components/weekly-meetings/team-admin";
import { requireTeamAdmin } from "@/lib/weekly-meetings/permissions";
import { listAssignableUsers, listTeams } from "@/lib/weekly-meetings/teams";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  await requireTeamAdmin();
  const [teams, users] = await Promise.all([
    listTeams({ includeArchived: true }),
    listAssignableUsers(),
  ]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 pb-16">
      <PageHeaderV2
        eyebrow="Admin"
        title="Teams"
        subtitle="Create teams and assign members for Weekly Impact and team meetings."
      />
      <TeamAdmin teams={teams} users={users} />
    </div>
  );
}
