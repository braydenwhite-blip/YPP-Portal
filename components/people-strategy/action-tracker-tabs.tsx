import Link from "next/link";

/**
 * Shared tab bar for the leadership Action Tracker area (All Actions, Classes,
 * …). `active` highlights the current surface. Routes that exist render as
 * links; not-yet-built surfaces render as disabled placeholders so the layout
 * is complete without dead links.
 */

export type ActionTrackerTab =
  | "command"
  | "all"
  | "my"
  | "classes"
  | "meetings"
  | "responsibility"
  | "people";

type TabDef = { key: ActionTrackerTab; label: string; href?: string };

const TABS: TabDef[] = [
  { key: "command", label: "Work Hub", href: "/work" },
  { key: "all", label: "All Actions", href: "/actions/all" },
  { key: "my", label: "My Actions", href: "/actions" },
  { key: "classes", label: "Classes", href: "/actions/all/classes" },
  { key: "meetings", label: "Meetings", href: "/actions/meetings" },
  { key: "responsibility", label: "Responsibility Map", href: "/actions/responsibility" },
  { key: "people", label: "People Dashboard", href: "/actions/people" },
];

export function ActionTrackerTabs({
  active,
  showPeople = false,
}: {
  // Optional: on surfaces that are not themselves a tab (the create form, the
  // detail view) pass no `active` so the full bar renders with nothing current.
  active?: ActionTrackerTab;
  showPeople?: boolean;
}) {
  const tabs = TABS.filter((tab) => tab.key !== "people" || showPeople || active === "people");

  return (
    // A <nav>, not a tablist: these links navigate between pages rather than
    // switching panels in place, so tab/tablist ARIA would be dishonest.
    // Rendered as a contained segmented control (.ps-tabs) for a premium,
    // clearly-grouped nav rather than a loose row of buttons.
    <nav aria-label="Action tracker views" className="ps-tabs">
      {tabs.map((tab) => {
        if (tab.key === active) {
          return (
            <span key={tab.key} className="ps-tab" aria-current="page">
              {tab.label}
            </span>
          );
        }
        if (tab.href) {
          return (
            <Link key={tab.key} href={tab.href} className="ps-tab">
              {tab.label}
            </Link>
          );
        }
        return null;
      })}
    </nav>
  );
}
