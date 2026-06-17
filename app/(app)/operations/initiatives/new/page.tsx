import { notFound } from "next/navigation";

import { InitiativePlanStart, type InitiativePlanOption } from "@/components/command-center/initiative-plan-start";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import { SimpleActionStrip, SimpleSurface, type SimpleAction } from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { meetingCategoryLabel } from "@/lib/people-strategy/meeting-categories";
import { buildInitiativeActionPrefill } from "@/lib/people-strategy/strategic-recommendations";
import {
  getInitiativeDef,
  INITIATIVE_PRIORITY_LABELS,
  INITIATIVE_PRIORITY_WEIGHT,
  isTerminalStatus,
  listInitiativeDefs,
} from "@/lib/people-strategy/strategic-initiatives";
import { initiativeHref } from "@/lib/people-strategy/strategic-timeline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan initiative · Work" };

function toPlanOption(def: ReturnType<typeof listInitiativeDefs>[number]): InitiativePlanOption {
  const meetingParams = new URLSearchParams();
  meetingParams.set("area", def.area);
  meetingParams.set("title", `Plan: ${def.title}`);
  meetingParams.set(
    "purpose",
    def.description.slice(0, 500) || `Planning session for ${def.title}.`
  );

  return {
    id: def.id,
    title: def.title,
    description: def.description,
    areaLabel: meetingCategoryLabel(def.area),
    priorityLabel: INITIATIVE_PRIORITY_LABELS[def.priority],
    planHref: initiativeHref(def.id),
    actionHref: buildInitiativeActionPrefill(def),
    meetingHref: `/actions/meetings/new?${meetingParams.toString()}`,
  };
}

export default async function NewInitiativePlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ initiative?: string }>;
}) {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const sessionUser = await requireOfficer().catch(() => null);
  if (!sessionUser) notFound();

  const sp = (await searchParams) ?? {};
  const initialParam = sp.initiative?.trim() ?? "";
  const initialId = initialParam && getInitiativeDef(initialParam) ? initialParam : undefined;

  const initiatives = listInitiativeDefs()
    .filter((def) => !isTerminalStatus(def.status))
    .sort((a, b) => INITIATIVE_PRIORITY_WEIGHT[b.priority] - INITIATIVE_PRIORITY_WEIGHT[a.priority])
    .map(toPlanOption);

  const strip: SimpleAction[] = [
    { label: "All initiatives", href: "/operations/initiatives", icon: "flag" },
    { label: "Add action", href: "/actions/new", icon: "bolt" },
    { label: "Schedule meeting", href: "/actions/meetings/new", icon: "calendar" },
  ];

  return (
    <SimpleSurface
      maxWidth={720}
      header={
        <PageHeaderV2
          eyebrow="Work"
          backHref="/operations/initiatives"
          backLabel="Initiatives"
          title="Plan initiative work"
          subtitle="Pick a priority, then add an action or meeting that ladders up to it."
          actions={<CommandModeToggle />}
        />
      }
      aboveBrowse={
        <div className="flex flex-col gap-5">
          <InitiativePlanStart
            initiatives={initiatives}
            cancelHref="/operations/initiatives"
            initialId={initialId}
          />
          <SimpleActionStrip actions={strip} />
        </div>
      }
    />
  );
}
