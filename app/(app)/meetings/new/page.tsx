import skin from "@/components/ui-v2/portal-skin.module.css";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import { SimpleSurface, SimpleActionStrip, type SimpleAction } from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { CreateMeetingForm } from "@/components/weekly-meetings/create-meeting-form";
import { prisma } from "@/lib/prisma";
import { listMeetingPartnerOptions } from "@/lib/weekly-meetings/partners";
import { requireMeetingRunner } from "@/lib/weekly-meetings/permissions";
import { listAssignableUsers, listTeams } from "@/lib/weekly-meetings/teams";
import { weekKey, weekStartFor } from "@/lib/weekly-meetings/week";

export const dynamic = "force-dynamic";
export const metadata = { title: "New meeting · Meetings" };

const strip: SimpleAction[] = [
  { label: "All meetings", href: "/meetings", icon: "calendar" },
  { label: "Submit weekly impact", href: "/my-weekly-impact", icon: "list" },
];

export default async function NewMeetingPage() {
  const viewer = await requireMeetingRunner();
  const [teamsRaw, people, chaptersRaw, partners] = await Promise.all([
    listTeams(),
    listAssignableUsers(),
    prisma.chapter.findMany({
      select: { id: true, name: true, president: { select: { id: true } } },
      orderBy: { name: "asc" },
    }),
    listMeetingPartnerOptions(),
  ]);

  const teams = teamsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    memberIds: t.members.map((m) => m.userId),
  }));

  const chapters = chaptersRaw.map((c) => ({
    id: c.id,
    name: c.name,
    presidentId: c.president?.id ?? null,
  }));

  return (
    <div className={skin.portalSkin}>
      <SimpleSurface
        maxWidth={720}
        header={
          <PageHeaderV2
            eyebrow="Meetings"
            backHref="/meetings"
            backLabel="Meetings"
            title="New meeting"
            subtitle="Pick a type, add everyone who should be there, and go."
            actions={<CommandModeToggle />}
          />
        }
        aboveBrowse={
          <div className="flex flex-col gap-5">
            <CreateMeetingForm
              teams={teams}
              chapters={chapters}
              people={people}
              partners={partners}
              currentUserId={viewer.id}
              defaultWeekKey={weekKey(weekStartFor())}
              cancelHref="/meetings"
            />
            <SimpleActionStrip actions={strip} />
          </div>
        }
      />
    </div>
  );
}
