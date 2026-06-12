import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import {
  listActionDepartments,
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import {
  ACTION_FILTER_PARAM_KEYS,
  ACTION_PRESETS,
  applyActionFilters,
  buildActionFilterQuery,
  countActionPresets,
  groupActionsByLinkedEntity,
  hasActiveFilters,
  linkedGroupHeading,
  parseActionFilters,
} from "@/lib/people-strategy/action-filters";
import {
  loadRelatedEntityLabels,
  type RelatedEntitySummary,
} from "@/lib/people-strategy/connections";
import {
  summarizeDepartments,
  summarizeStatuses,
} from "@/lib/people-strategy/action-analytics";
import {
  ButtonLink,
  cn,
  LegacySurfaceBanner,
  PageHeaderV2,
} from "@/components/ui-v2";
import { ActionFiltersBar } from "@/components/people-strategy/action-filters-bar";
import {
  ActionStatusDonut,
  DepartmentBars,
} from "@/components/people-strategy/action-analytics-cards";
import { listSavedActionViews } from "@/lib/people-strategy/saved-views";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import { ActionListCard } from "@/components/people-strategy/action-list-card";
import { ActionInboxGroups } from "@/components/people-strategy/action-inbox-groups";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { SavedViewsBar } from "@/components/people-strategy/saved-views-bar";
import {
  ActionPresetChips,
  type ActionPresetChip,
} from "@/components/people-strategy/action-preset-chips";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · All Actions" };

/** A drill-in stat tile: a non-zero count with an optional filter href. */
function StatTile({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "default" | "danger" | "brand";
}) {
  const body = (
    <>
      <p
        className={cn(
          "m-0 text-[22px] font-bold leading-tight",
          tone === "danger" ? "text-danger-700" : tone === "brand" ? "text-brand-700" : "text-ink"
        )}
      >
        {value}
      </p>
      <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </p>
    </>
  );
  const className = cn(
    "min-w-[120px] flex-1 rounded-[12px] border bg-surface px-3.5 py-3 shadow-card",
    tone === "danger" ? "border-red-200" : "border-line-soft",
    href ? "transition-colors hover:border-brand-400" : ""
  );
  return href ? (
    <Link href={href} className={cn(className, "no-underline")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function AllActionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Outer gate: with ENABLE_ACTION_TRACKER off the route does not exist.
  if (!isActionTrackerEnabled()) notFound();

  // Officer-tier and above only. requireOfficer() throws "Unauthorized" for
  // members / instructors below officer (and for unauthenticated requests,
  // which the proxy already redirects before reaching here) — deny with a 404
  // so the route's existence is not leaked.
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const params = (await searchParams) ?? {};
  const filters = parseActionFilters(params);
  const now = new Date();

  const [visible, departments, savedViews] = await Promise.all([
    listVisibleActionItems(viewer),
    listActionDepartments(),
    listSavedActionViews(viewer.id),
  ]);

  // ONE filtered set drives everything below: the summary strip, the charts,
  // the department bars, the grouped list, and the CSV export link.
  const items = applyActionFilters(visible, filters, now);

  const statusBreakdown = summarizeStatuses(items, now);
  const departmentBars = summarizeDepartments(items, now);
  const flaggedCount = items.filter((i) => i.flaggedAt != null).length;
  const officersOnlyCount = items.filter((i) => i.visibility === "OFFICERS_ONLY").length;

  const exportQuery = buildActionFilterQuery(filters);
  const exportHref = exportQuery
    ? `/api/admin/actions/export.csv?${exportQuery}`
    : "/api/admin/actions/export.csv";

  // Group-by toggle: department (default) or linked entity. Items keep the
  // deadline sort within each group.
  const groupParam = Array.isArray(params.group) ? params.group[0] : params.group;
  const groupBy: "department" | "linked" = groupParam === "linked" ? "linked" : "department";

  type DisplayGroup = {
    name: string;
    href: string | null;
    items: ActionItemWithRelations[];
  };
  let displayGroups: DisplayGroup[];

  if (groupBy === "linked") {
    // Group by each linked entity and title the group with that entity's own
    // name ("Algebra 101 · Class") via one batched label lookup, not per type.
    const linkedGroups = groupActionsByLinkedEntity(items);
    const refs = linkedGroups
      .filter((g) => g.relatedType && g.relatedId)
      .map((g) => ({ type: g.relatedType!, id: g.relatedId! }));
    const labels = await loadRelatedEntityLabels(refs).catch(
      () => new Map<string, RelatedEntitySummary>()
    );
    displayGroups = linkedGroups
      .map((g) => ({
        name: linkedGroupHeading(g, labels),
        href: labels.get(g.key)?.href ?? null,
        items: g.items,
      }))
      .sort((a, b) => {
        if (a.name === "Not linked") return 1;
        if (b.name === "Not linked") return -1;
        return a.name.localeCompare(b.name);
      });
  } else {
    const groups = new Map<string, ActionItemWithRelations[]>();
    for (const item of items) {
      const key = item.department?.name ?? "Unassigned";
      const bucket = groups.get(key);
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }
    // Keep the "Unassigned" catch-all bucket last.
    displayGroups = Array.from(groups.entries())
      .map(([name, groupItems]) => ({ name, href: null, items: groupItems }))
      .sort((a, b) => {
        if (a.name === "Unassigned") return 1;
        if (b.name === "Unassigned") return -1;
        return a.name.localeCompare(b.name);
      });
  }

  // Group-toggle links preserve the active filters.
  const groupToggleHref = (g: "department" | "linked") => {
    const p = new URLSearchParams(buildActionFilterQuery(filters));
    if (g === "linked") p.set("group", "linked");
    else p.delete("group");
    const qs = p.toString();
    return qs ? `/actions/all?${qs}` : "/actions/all";
  };

  // Build a drill-in link from a stat tile: keep the current filters and apply
  // one more (e.g. clicking "Overdue" filters the list to overdue), so the
  // overview strip doubles as fast navigation.
  const statFilterHref = (key: string, value: string) => {
    const p = new URLSearchParams(buildActionFilterQuery(filters));
    p.set(key, value);
    p.delete("group");
    if (groupBy === "linked") p.set("group", "linked");
    const qs = p.toString();
    return qs ? `/actions/all?${qs}` : "/actions/all";
  };

  // Strategic view-preset chips (Phase 2). Counts reflect the OTHER active
  // filters (everything except the preset itself) so each chip shows how many
  // actions that lens holds in the current context; clicking toggles the preset
  // while preserving the rest of the view (department, search, group, …).
  const presetCountBase =
    filters.preset === "ALL"
      ? items
      : applyActionFilters(visible, { ...filters, preset: "ALL" }, now);
  const presetCounts = countActionPresets(presetCountBase, now);
  const presetChips: ActionPresetChip[] = ACTION_PRESETS.map((preset) => {
    const active = filters.preset === preset.value;
    const p = new URLSearchParams(buildActionFilterQuery(filters));
    if (active) p.delete(ACTION_FILTER_PARAM_KEYS.preset);
    else p.set(ACTION_FILTER_PARAM_KEYS.preset, preset.value);
    if (groupBy === "linked") p.set("group", "linked");
    const qs = p.toString();
    return {
      value: preset.value,
      label: preset.label,
      description: preset.description,
      href: qs ? `/actions/all?${qs}` : "/actions/all",
      active,
      count: presetCounts[preset.value],
    };
  });

  const filtersActive = hasActiveFilters(filters);
  const showPeopleDashboardTab = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);
  const lastUpdated = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(now);

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5">
      <LegacySurfaceBanner
        title="Work Hub is the front door for browsing work now."
        body="Actions, follow-ups, partner requests, and check-ins triage together there — this page keeps the filters, analytics, and CSV export."
        ctaLabel="Open Work Hub"
        ctaHref="/work?view=actions"
      />
      <PageHeaderV2
        eyebrow="Admin · People Strategy"
        title="Action Tracker"
        subtitle="Every leadership action item, grouped by department — leads, executors, and input owners at a glance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={exportHref} variant="secondary" size="md">
              Export CSV
            </ButtonLink>
            <ButtonLink href="/actions/new" variant="primary" size="md">
              New action
            </ButtonLink>
          </div>
        }
      >
        <p className="m-0 text-[12.5px] text-ink-muted">
          {items.length} {items.length === 1 ? "action" : "actions"} in view · updated{" "}
          {lastUpdated}
        </p>
      </PageHeaderV2>

      <ActionTrackerTabsV2 active="all" showPeople={showPeopleDashboardTab} />

      <ActionFiltersBar departments={departments} filters={filters} hasActive={filtersActive} />

      <ActionPresetChips chips={presetChips} />

      <SavedViewsBar
        views={savedViews}
        currentQuery={exportQuery}
        hasActiveFilters={filtersActive}
      />

      {/* Operational inbox (Action 4.0) — ranked triage lenses over the full
          visible board (not the current filter), so the most important work is
          always one glance away regardless of how the list is filtered. */}
      <ActionInboxGroups items={visible} now={now} />

      {/* Overview — collapsed by default so the list is reachable fast. */}
      <CollapsibleSection
        title="Overview"
        summary={`${statusBreakdown.total} in view · ${statusBreakdown.counts.OVERDUE} overdue · ${flaggedCount} flagged`}
        defaultOpen={false}
      >
        {/* Summary strip — reflects the current filters, and each count drills
            into the matching filter where one exists. */}
        <div className="flex flex-wrap gap-3">
          <StatTile label="Total" value={statusBreakdown.total} tone="brand" />
          <StatTile
            label="Overdue"
            value={statusBreakdown.counts.OVERDUE}
            tone={statusBreakdown.counts.OVERDUE > 0 ? "danger" : "default"}
            href={statFilterHref("status", "OVERDUE")}
          />
          <StatTile
            label="In progress"
            value={statusBreakdown.counts.IN_PROGRESS}
            href={statFilterHref("status", "IN_PROGRESS")}
          />
          <StatTile
            label="Officers only"
            value={officersOnlyCount}
            href={statFilterHref("vis", "OFFICERS_ONLY")}
          />
          <StatTile label="Flagged" value={flaggedCount} />
        </div>

        {/* Analytics: status donut + department mini-bars */}
        <div className="mt-4 flex flex-wrap gap-4">
          <ActionStatusDonut breakdown={statusBreakdown} />
          <DepartmentBars bars={departmentBars} />
        </div>
      </CollapsibleSection>

      {/* Grouped list by department */}
      {items.length === 0 ? (
        <div className="rounded-[12px] border border-line-soft bg-surface px-4 py-4 text-[13.5px] text-ink-muted shadow-card">
          {filtersActive
            ? "No action items match the current filters."
            : "No action items are visible yet. Create the first one with New action."}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-ink-muted">Group by:</span>
            <Link
              href={groupToggleHref("department")}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] font-semibold no-underline transition-colors",
                groupBy === "department"
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line text-ink-muted hover:border-brand-400 hover:text-brand-700"
              )}
            >
              Department
            </Link>
            <Link
              href={groupToggleHref("linked")}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] font-semibold no-underline transition-colors",
                groupBy === "linked"
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line text-ink-muted hover:border-brand-400 hover:text-brand-700"
              )}
            >
              Linked item
            </Link>
          </div>
          {displayGroups.map((group) => (
            <section key={group.name} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="m-0 text-[15px] font-bold text-ink">
                  {group.href ? (
                    <Link href={group.href} className="text-ink hover:text-brand-700">
                      {group.name}
                    </Link>
                  ) : (
                    group.name
                  )}
                </h2>
                <span className="text-[12px] text-ink-muted">
                  {group.items.length} {group.items.length === 1 ? "action" : "actions"}
                </span>
              </div>
              {group.items.map((item) => (
                <ActionListCard key={item.id} item={item} now={now} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
