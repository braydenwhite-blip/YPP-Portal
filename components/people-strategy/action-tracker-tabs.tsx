import Link from "next/link";

/**
 * Shared tab bar for the leadership Action Tracker area (All Actions, Classes,
 * …). `active` highlights the current surface. Routes that exist render as
 * links; not-yet-built surfaces render as disabled placeholders so the layout
 * is complete without dead links.
 */

export type ActionTrackerTab =
  | "all"
  | "my"
  | "classes"
  | "input"
  | "meetings"
  | "people";

type TabDef = { key: ActionTrackerTab; label: string; href?: string };

const TABS: TabDef[] = [
  { key: "all", label: "All Actions", href: "/all-actions" },
  { key: "my", label: "My Actions", href: "/my-actions" },
  { key: "classes", label: "Classes", href: "/all-actions/classes" },
  { key: "input", label: "Needs My Input" },
  { key: "meetings", label: "Officer Meetings" },
  { key: "people", label: "People" },
];

export function ActionTrackerTabs({ active }: { active: ActionTrackerTab }) {
  return (
    <div
      role="tablist"
      aria-label="Action tracker views"
      style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}
    >
      {TABS.map((tab) => {
        if (tab.key === active) {
          return (
            <span key={tab.key} className="button small" aria-current="page">
              {tab.label}
            </span>
          );
        }
        if (tab.href) {
          return (
            <Link key={tab.key} href={tab.href} className="button outline small">
              {tab.label}
            </Link>
          );
        }
        return (
          <span
            key={tab.key}
            className="button outline small"
            aria-disabled="true"
            title="Coming soon"
            style={{ opacity: 0.5, pointerEvents: "none", cursor: "default" }}
          >
            {tab.label}
          </span>
        );
      })}
    </div>
  );
}
