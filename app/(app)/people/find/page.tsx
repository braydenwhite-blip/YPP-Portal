import { notFound, redirect } from "next/navigation";

import { CommandModeToggle } from "@/components/command-center/command-mode";
import { PeopleFindStart, type PersonFindOption } from "@/components/command-center/people-find-start";
import { SimpleActionStrip, SimpleSurface, type SimpleAction } from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { hasRole } from "@/lib/authorization";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  loadPeopleDirectory,
  type PersonDirectoryRow,
} from "@/lib/people/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a person · People" };

function toFindOption(row: PersonDirectoryRow): PersonFindOption {
  const roleLabel = row.primaryRole.replace(/_/g, " ");

  const meetingParams = new URLSearchParams();
  meetingParams.set("relatedType", "USER");
  meetingParams.set("relatedId", row.id);
  meetingParams.set("title", `Meeting with ${row.name}`);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleLabel,
    affiliation: row.affiliation,
    profileHref: `/people/${row.id}`,
    actionHref: `/actions/new?relatedType=USER&relatedId=${encodeURIComponent(row.id)}`,
    meetingHref: `/actions/meetings/new?${meetingParams.toString()}`,
  };
}

export default async function FindPersonPage({
  searchParams,
}: {
  searchParams?: Promise<{ person?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) notFound();

  const canAddPerson = hasRole(viewer.roles, "ADMIN", viewer.primaryRole);

  const sp = (await searchParams) ?? {};
  const initialParam = sp.person?.trim() ?? "";

  const [{ rows }, chapters] = await Promise.all([
    loadPeopleDirectory({ role: "all" }),
    canAddPerson
      ? prisma.chapter.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const people = rows.map(toFindOption);
  const initialId =
    initialParam && people.some((p) => p.id === initialParam) ? initialParam : undefined;

  const strip: SimpleAction[] = [
    { label: "People directory", href: "/people", icon: "users" },
    { label: "Add action", href: "/actions/new", icon: "bolt" },
    { label: "Schedule meeting", href: "/actions/meetings/new", icon: "calendar" },
  ];

  return (
    <SimpleSurface
      maxWidth={720}
      header={
        <PageHeaderV2
          eyebrow="People"
          backHref="/people"
          backLabel="People"
          title="Find a person"
          subtitle="Search the directory, open a profile, or add someone new."
          actions={<CommandModeToggle />}
        />
      }
      aboveBrowse={
        <div className="flex flex-col gap-5">
          <PeopleFindStart
            people={people}
            chapters={chapters}
            canAddPerson={canAddPerson}
            cancelHref="/people"
            initialId={initialId}
          />
          <SimpleActionStrip actions={strip} />
        </div>
      }
    />
  );
}
