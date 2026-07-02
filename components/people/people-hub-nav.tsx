import Link from "next/link";

export type PeopleHubTab = "reviews" | "check-ins" | "quarterly-reviews";

type TabDef = {
  key: PeopleHubTab;
  label: string;
  href: string;
};

// Development + Mentorship moved into the unified Mentorship Command Center
// (/mentorship?view=admin) — linked below the tabs rather than duplicated.
const TABS: TabDef[] = [
  { key: "reviews", label: "People & Reviews", href: "/people" },
  { key: "check-ins", label: "Monthly Check-ins", href: "/people/check-ins" },
  { key: "quarterly-reviews", label: "Quarterly Reviews", href: "/people/quarterly-reviews" },
];

/** Primary switcher for the People hub. */
export function PeopleHubNav({
  active,
  showPerformance = false,
}: {
  /** Omit when the current page is not one of the hub tabs (e.g. legacy directory). */
  active?: PeopleHubTab;
  /** Shows leadership tabs (People & Reviews, check-ins, mentorship, quarterly reviews). */
  showPerformance?: boolean;
}) {
  if (!showPerformance) return null;

  return (
    <nav className="ps-workspace-nav" aria-label="People hub">
      <div className="ps-tabs">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return isActive ? (
            <span key={tab.key} className="ps-tab" aria-current="page">
              {tab.label}
            </span>
          ) : (
            <Link key={tab.key} href={tab.href} className="ps-tab">
              {tab.label}
            </Link>
          );
        })}
        <Link href="/mentorship?view=admin" className="ps-tab">
          Mentorship &amp; Development ↗
        </Link>
      </div>
    </nav>
  );
}
