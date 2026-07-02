"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/components/ui-v2/cn";
import { buildActionsHubTabHref } from "@/lib/people-strategy/action-filters";

export type ActionsHubTab = "all" | "mine";

const TABS: Array<{
  key: ActionsHubTab;
  label: string;
  tabParams: Record<string, string>;
  officerOnly?: boolean;
}> = [
  { key: "mine", label: "My Actions", tabParams: { who: "me" } },
  { key: "all", label: "All Actions", tabParams: { who: "all" }, officerOnly: true },
];

export function ActionsHubTabs({
  active,
  officer,
}: {
  active: ActionsHubTab;
  officer: boolean;
}) {
  const searchParams = useSearchParams();
  const currentParams = Object.fromEntries(searchParams.entries());
  const tabs = TABS.filter((tab) => !tab.officerOnly || officer);

  return (
    <nav aria-label="Actions hub views" className="flex shrink-0 flex-nowrap items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const href = buildActionsHubTabHref(tab.tabParams, currentParams);
        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold no-underline transition-colors",
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
