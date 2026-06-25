import { notFound, redirect } from "next/navigation";

import { ActionsHub } from "@/components/people-strategy/actions-hub";
import type { ActionsHubTab } from "@/components/people-strategy/actions-hub-tabs";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  getMyActionItems,
  listActionChapters,
  listActionDepartments,
  listVisibleActionItems,
} from "@/lib/people-strategy/action-queries";
import {
  applyActionFilters,
  hasActiveHubFilters,
  parseActionFilters,
  type ActionFilters,
} from "@/lib/people-strategy/action-filters";
import {
  canCreateAction,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { selectNeedsInput } from "@/lib/people-strategy/my-actions-selectors";
import { filterActionsByInitiative } from "@/lib/people-strategy/strategic-initiative-summary";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import {
  filterActiveHubItems,
  filterApprovedHubItems,
} from "@/lib/people-strategy/action-approval";

export const dynamic = "force-dynamic";
export const metadata = { title: "Actions" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function resolveHubTab(params: {
  who: string;
  view?: string;
  officer: boolean;
}): ActionsHubTab {
  if (params.view === "approved") return "approved";
  if (params.view === "input") return "input";
  if (params.officer && params.who === "all") return "all";
  if (params.who === "me") return "mine";
  return params.officer ? "all" : "mine";
}

/** Hub ignores advanced filters that are not exposed in the UI. */
function hubFilterLens(filters: ActionFilters): ActionFilters {
  return {
    ...filters,
    status: "ALL",
    priority: "ALL",
    actionType: "ALL",
    relatedType: "ALL",
    source: "ALL",
    preset: "ALL",
    sort: "deadline_asc",
  };
}

export default async function ActionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isActionTrackerEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  const params = (await searchParams) ?? {};
  const whoParam = firstParam(params.who);
  const viewParam = firstParam(params.view);
  if (firstParam(params.create) === "1") redirect("/actions/new");

  const initiativeParam = firstParam(params.initiative)?.trim() ?? "";
  const initiativeDef = initiativeParam ? getInitiativeDef(initiativeParam) : null;

  const officer = isOfficerTier(viewer);
  const canCreate = canCreateAction(viewer);
  const who = officer ? whoParam ?? "all" : "me";

  let myItems: Awaited<ReturnType<typeof getMyActionItems>> = [];
  let allItems: Awaited<ReturnType<typeof listVisibleActionItems>> = [];
  let departments: Awaited<ReturnType<typeof listActionDepartments>> = [];
  let chapters: Awaited<ReturnType<typeof listActionChapters>> = [];

  try {
    [myItems, allItems, departments, chapters] = await Promise.all([
      getMyActionItems(viewer.id, viewer),
      officer ? listVisibleActionItems(viewer) : Promise.resolve([]),
      canCreate ? listActionDepartments() : Promise.resolve([]),
      // Chapter filter is a leadership lens over the whole queue — officers only.
      officer ? listActionChapters() : Promise.resolve([]),
    ]);
  } catch (error) {
    console.error("[actions] Failed to load action hub data:", error);
  }

  const now = new Date();
  const filters = parseActionFilters(params);
  const hubFilters = hubFilterLens(filters);
  const filtersActive = hasActiveHubFilters(hubFilters);

  const createHref = initiativeDef
    ? `/actions/new?initiativeId=${encodeURIComponent(initiativeDef.id)}`
    : "/actions/new";

  let source =
    viewParam === "input"
      ? selectNeedsInput(myItems, viewer.id)
      : who === "all"
        ? allItems
        : myItems;

  if (initiativeDef) source = filterActionsByInitiative(source, initiativeDef.id);
  const filtered = applyActionFilters(source, hubFilters, now);
  const items =
    viewParam === "approved"
      ? filterApprovedHubItems(filtered)
      : filterActiveHubItems(filtered, now);

  const activeTab = resolveHubTab({ who, view: viewParam, officer });

  return (
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <ActionsHub
        items={items}
        now={now}
        filters={hubFilters}
        hasActiveFilters={filtersActive}
        departments={departments}
        chapters={chapters}
        activeTab={activeTab}
        officer={officer}
        createHref={createHref}
        canCreate={canCreate}
        viewer={viewer}
      />
    </div>
  );
}
