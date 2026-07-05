import { notFound, redirect } from "next/navigation";

import { cookies } from "next/headers";
import { ActionsHub } from "@/components/people-strategy/actions-hub";
import type { ActionsHubTab } from "@/components/people-strategy/actions-hub-tabs";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  ACTIONS_ONLY_PREVIEW_COOKIE_NAME,
  isActionsOnlyPreviewActive,
} from "@/lib/leadership-preview-access";
import { isOfficerTierFromAuth } from "@/lib/public-gate";
import {
  getMyArchivedActionItems,
  listActionChapters,
  listActionDepartments,
  listVisibleArchivedActionItems,
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
import { filterActionsByInitiative } from "@/lib/people-strategy/strategic-initiative-summary";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { filterArchivedItems } from "@/lib/people-strategy/action-approval";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archived Actions" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

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

export default async function ArchivedActionsPage({
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

  const cookieStore = await cookies();
  const actionsOnlyPreviewCookie =
    cookieStore.get(ACTIONS_ONLY_PREVIEW_COOKIE_NAME)?.value ?? null;
  const previewViewer = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    internalLevel: session.user.internalLevel,
  };
  const actionsOnlyPreview = isActionsOnlyPreviewActive(previewViewer, {
    previewCookie: actionsOnlyPreviewCookie,
    allowAdminPreviewCookie: isOfficerTierFromAuth(
      session.user.roles ?? [],
      session.user.primaryRole,
    ),
  });

  const params = (await searchParams) ?? {};
  const whoParam = firstParam(params.who);

  const initiativeParam = firstParam(params.initiative)?.trim() ?? "";
  const initiativeDef = initiativeParam ? getInitiativeDef(initiativeParam) : null;

  const officer = actionsOnlyPreview ? false : isOfficerTier(viewer);
  const canCreate = actionsOnlyPreview ? false : canCreateAction(viewer);
  const archivedScope =
    actionsOnlyPreview || !officer || whoParam !== "all" ? "me" : "all";

  let myItems: Awaited<ReturnType<typeof getMyArchivedActionItems>> = [];
  let allItems: Awaited<ReturnType<typeof listVisibleArchivedActionItems>> = [];
  let departments: Awaited<ReturnType<typeof listActionDepartments>> = [];
  let chapters: Awaited<ReturnType<typeof listActionChapters>> = [];

  try {
    [myItems, allItems, departments, chapters] = await Promise.all([
      getMyArchivedActionItems(session.user.id, viewer),
      officer ? listVisibleArchivedActionItems(viewer) : Promise.resolve([]),
      actionsOnlyPreview ? Promise.resolve([]) : listActionDepartments(),
      officer ? listActionChapters() : Promise.resolve([]),
    ]);
  } catch (error) {
    console.error("[actions/archived] Failed to load archived actions:", error);
  }

  const now = new Date();
  const filters = parseActionFilters(params);
  const hubFilters = hubFilterLens(filters);
  const filtersActive = hasActiveHubFilters(hubFilters);

  const createHref = initiativeDef
    ? `/actions/new?initiativeId=${encodeURIComponent(initiativeDef.id)}`
    : "/actions/new";

  let source = archivedScope === "all" ? allItems : myItems;

  if (initiativeDef) source = filterActionsByInitiative(source, initiativeDef.id);
  const filtered = applyActionFilters(source, hubFilters, now);
  const items = filterArchivedItems(filtered);

  return (
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <ActionsHub
        items={items}
        now={now}
        filters={hubFilters}
        hasActiveFilters={filtersActive}
        departments={departments}
        chapters={chapters}
        activeTab="archived"
        officer={officer}
        createHref={createHref}
        canCreate={canCreate}
        viewer={viewer}
        actionsOnlyPreview={actionsOnlyPreview}
        hubBasePath="/actions/archived"
        activeTabArchivedScope={archivedScope}
      />
    </div>
  );
}
