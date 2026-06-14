"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [
  { segment: "", label: "Overview" },
  { segment: "roster", label: "Roster" },
  { segment: "settings", label: "Settings" },
] as const;

export function ClassAdminNav({
  classId,
  showFeedback,
}: {
  classId: string;
  showFeedback: boolean;
}) {
  const pathname = usePathname();
  const base = `/admin/classes/${classId}`;
  const tabs = showFeedback
    ? [...BASE_TABS, { segment: "feedback", label: "Feedback" } as const]
    : BASE_TABS;

  return (
    <nav className="ps-workspace-nav" aria-label="Class admin sections">
      <div className="ps-tabs m-0 w-full max-w-none">
        {tabs.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active =
            tab.segment === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);

          return active ? (
            <span key={tab.segment || "overview"} className="ps-tab" aria-current="page">
              {tab.label}
            </span>
          ) : (
            <Link key={tab.segment || "overview"} href={href} className="ps-tab">
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
