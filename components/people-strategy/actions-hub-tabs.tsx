import Link from "next/link";

import { cn } from "@/components/ui-v2/cn";

export type ActionsHubTab = "all" | "mine" | "input" | "approved";

const TABS: Array<{
  key: ActionsHubTab;
  label: string;
  href: string;
  officerOnly?: boolean;
}> = [
  { key: "all", label: "All Actions", href: "/actions?who=all", officerOnly: true },
  { key: "mine", label: "My Actions", href: "/actions?who=me" },
  { key: "input", label: "Needs My Input", href: "/actions?view=input" },
  { key: "approved", label: "Approved", href: "/actions?view=approved" },
];

export function ActionsHubTabs({
  active,
  officer,
}: {
  active: ActionsHubTab;
  officer: boolean;
}) {
  const tabs = TABS.filter((tab) => !tab.officerOnly || officer);

  return (
    <nav aria-label="Actions hub views" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-semibold no-underline transition-colors",
              isActive
                ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                : "border-line-soft bg-surface text-brand-800 hover:border-brand-300 hover:bg-brand-50"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
