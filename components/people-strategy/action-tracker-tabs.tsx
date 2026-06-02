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
  { key: "meetings", label: "Officer Meetings", href: "/officer-meetings" },
  { key: "people", label: "People" },
];

export function ActionTrackerTabs({ active }: { active: ActionTrackerTab }) {
  return (
    // A <nav>, not a tablist: these links navigate between pages rather than
    // switching panels in place, so tab/tablist ARIA would be dishonest.
    <nav
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
            // aria-label carries the reason so it isn't title-only (which
            // keyboard/touch/SR users never get).
            aria-label={`${tab.label} — coming soon`}
            title="Coming soon"
            style={{ opacity: 0.5, pointerEvents: "none", cursor: "default" }}
          >
            {tab.label}
          </span>
        );
      })}
    </nav>
  );
}
