import { PageHeaderV2 } from "@/components/ui-v2";
import { CreateMeetingForm } from "@/components/weekly-meetings/create-meeting-form";
import { prisma } from "@/lib/prisma";
import { requireMeetingRunner } from "@/lib/weekly-meetings/permissions";
import { listAssignableUsers, listTeams } from "@/lib/weekly-meetings/teams";
import { weekKey, weekStartFor } from "@/lib/weekly-meetings/week";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  await requireMeetingRunner();
  const [teams, people, chapters] = await Promise.all([
    listTeams(),
    listAssignableUsers(),
    prisma.chapter.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 pb-16">
      <PageHeaderV2
        eyebrow="Weekly Meetings"
        title="New meeting"
        subtitle="Pick a type and the form adapts to what it needs."
        backHref="/meetings"
        backLabel="Meetings"
      />
      <CreateMeetingForm
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        chapters={chapters}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        defaultWeekKey={weekKey(weekStartFor())}
      />
    </div>
  );
}
