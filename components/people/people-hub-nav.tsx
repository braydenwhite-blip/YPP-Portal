import Link from "next/link";

export type PeopleHubTab =
  | "reviews"
  | "develop"
  | "check-ins"
  | "mentorship"
  | "quarterly-reviews";

type TabDef = {
  key: PeopleHubTab;
  label: string;
  href: string;
};

const TABS: TabDef[] = [
  { key: "reviews", label: "People & Reviews", href: "/people" },
  { key: "develop", label: "Development", href: "/people/develop" },
  { key: "check-ins", label: "Monthly Check-ins", href: "/people/check-ins" },
  { key: "mentorship", label: "Mentorship", href: "/people/mentorship" },
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
      </div>
    </nav>
  );
}
