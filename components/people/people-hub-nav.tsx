import Link from "next/link";

export type PeopleHubTab = "directory" | "performance" | "classes";

type TabDef = {
  key: PeopleHubTab;
  label: string;
  href: string;
};

const TABS: TabDef[] = [
  { key: "directory", label: "Directory", href: "/people" },
  { key: "performance", label: "Attention", href: "/people/performance" },
  { key: "classes", label: "Classes", href: "/people/classes" },
];

/** Primary switcher for the People hub. */
export function PeopleHubNav({
  active,
  showPerformance = false,
  showClasses = false,
}: {
  active: PeopleHubTab;
  showPerformance?: boolean;
  showClasses?: boolean;
}) {
  const visible = TABS.filter((tab) => {
    if (tab.key === "performance") return showPerformance;
    if (tab.key === "classes") return showClasses;
    return true;
  });

  return (
    <nav className="ps-workspace-nav" aria-label="People hub">
      <div className="ps-tabs">
        {visible.map((tab) => {
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
