import { FilterBar, FilterChipLink } from "@/components/ui-v2";

import type { ActionTrackerTab } from "./action-tracker-tabs";

/**
 * Action Tracker tab bar on ui-v2 (Knowledge OS V2 Phase 3F) — the Tailwind
 * rebuild of `ActionTrackerTabs` for the rebuilt `/actions` and `/actions/all`
 * surfaces. Same routes and `active` contract; rendered as ui-v2
 * `FilterChipLink`s. The legacy `ActionTrackerTabs` (`.ps-tabs`) is untouched
 * for the action surfaces still on the legacy skin (People Dashboard,
 * Responsibility Map, classes, completion report).
 */

type TabDef = { key: ActionTrackerTab; label: string; href: string };

const TABS: TabDef[] = [
  { key: "command", label: "Work Hub", href: "/work" },
  { key: "all", label: "All Actions", href: "/actions/all" },
  { key: "my", label: "My Actions", href: "/actions" },
  { key: "classes", label: "Classes", href: "/actions/all/classes" },
  { key: "meetings", label: "Meetings", href: "/actions/meetings" },
  { key: "responsibility", label: "Responsibility Map", href: "/actions/responsibility" },
  { key: "people", label: "People Dashboard", href: "/actions/people" },
];

export function ActionTrackerTabsV2({
  active,
  showPeople = false,
}: {
  active?: ActionTrackerTab;
  showPeople?: boolean;
}) {
  const tabs = TABS.filter(
    (tab) => tab.key !== "people" || showPeople || active === "people"
  );
  return (
    <FilterBar aria-label="Action tracker views">
      {tabs.map((tab) => (
        <FilterChipLink key={tab.key} href={tab.href} active={tab.key === active}>
          {tab.label}
        </FilterChipLink>
      ))}
    </FilterBar>
  );
}
