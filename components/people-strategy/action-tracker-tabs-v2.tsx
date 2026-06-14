import { FilterBar, FilterChipLink } from "@/components/ui-v2";

import type { ActionTrackerTab } from "./action-tracker-tabs";

/**
 * Action Tracker tab bar on ui-v2 (Knowledge OS V2 Phase 3F) — the Tailwind
 * rebuild of `ActionTrackerTabs` for the rebuilt `/actions` and `/actions/all`
 * surfaces. Same routes and `active` contract; rendered as ui-v2
 * `FilterChipLink`s with advanced tracker tools tucked behind disclosure.
 */

type TabDef = { key: ActionTrackerTab; label: string; href: string };

const TABS: TabDef[] = [
  { key: "command", label: "Work", href: "/work" },
  { key: "initiatives", label: "Initiatives", href: "/operations/initiatives" },
  { key: "my", label: "My actions", href: "/actions" },
  { key: "all", label: "All actions", href: "/actions/all" },
  { key: "meetings", label: "Meetings", href: "/actions/meetings" },
  { key: "classes", label: "Class tracker", href: "/actions/all/classes" },
  { key: "responsibility", label: "Responsibility Map", href: "/actions/responsibility" },
];

const PRIMARY_TABS = new Set<ActionTrackerTab>([
  "command",
  "initiatives",
  "my",
  "all",
  "meetings",
]);

export function ActionTrackerTabsV2({
  active,
}: {
  active?: ActionTrackerTab;
}) {
  const tabs = TABS;
  const primaryTabs = tabs.filter((tab) => PRIMARY_TABS.has(tab.key) || tab.key === active);
  const advancedTabs = tabs.filter((tab) => !PRIMARY_TABS.has(tab.key) && tab.key !== active);
  return (
    <div className="flex flex-col gap-2">
      <FilterBar aria-label="Action tracker views">
        {primaryTabs.map((tab) => (
          <FilterChipLink key={tab.key} href={tab.href} active={tab.key === active}>
            {tab.label}
          </FilterChipLink>
        ))}
      </FilterBar>
      {advancedTabs.length > 0 ? (
        <details className="rounded-[10px] border border-line-soft bg-surface px-3 py-2">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-muted">
            More action tools
          </summary>
          <FilterBar aria-label="Advanced action tracker tools" className="mt-2">
            {advancedTabs.map((tab) => (
              <FilterChipLink key={tab.key} href={tab.href} active={tab.key === active}>
                {tab.label}
              </FilterChipLink>
            ))}
          </FilterBar>
        </details>
      ) : null}
    </div>
  );
}
