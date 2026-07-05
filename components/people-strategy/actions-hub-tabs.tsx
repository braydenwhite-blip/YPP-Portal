"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/components/ui-v2/cn";
import { buildActionsHubTabHref } from "@/lib/people-strategy/action-filters";

export type ActionsHubTab = "all" | "mine" | "archived";

const TABS: Array<{
  key: ActionsHubTab;
  label: string;
  tabParams: Record<string, string>;
  officerOnly?: boolean;
  basePath?: string;
}> = [
  { key: "mine", label: "My Actions", tabParams: { who: "me" } },
  { key: "all", label: "All Actions", tabParams: { who: "all" }, officerOnly: true },
  {
    key: "archived",
    label: "Archived",
    tabParams: { who: "me" },
    basePath: "/actions/archived",
  },
];

export function ActionsHubTabs({
  active,
  officer,
  archivedScope = "me",
}: {
  active: ActionsHubTab;
  officer: boolean;
  /** When the archived tab is active, whether the officer is viewing all archived work. */
  archivedScope?: "me" | "all";
}) {
  const searchParams = useSearchParams();
  const currentParams = Object.fromEntries(searchParams.entries());
  const tabs = TABS.filter((tab) => !tab.officerOnly || officer);

  return (
    <nav aria-label="Actions hub views" className="flex shrink-0 flex-nowrap items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const tabParams =
          tab.key === "archived"
            ? {
                who:
                  officer && (currentParams.who === "all" || archivedScope === "all")
                    ? "all"
                    : "me",
              }
            : tab.tabParams;
        const href = buildActionsHubTabHref(
          tabParams,
          currentParams,
          tab.basePath ?? "/actions",
        );
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
