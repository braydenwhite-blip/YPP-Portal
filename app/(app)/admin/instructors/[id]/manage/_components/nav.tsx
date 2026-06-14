"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "pipeline", label: "Pipeline" },
  { segment: "teaching", label: "Teaching" },
  { segment: "strategy", label: "Reviews" },
  { segment: "notes", label: "Notes" },
] as const;

export function InstructorManageNav({ instructorId }: { instructorId: string }) {
  const pathname = usePathname();
  const base = `/admin/instructors/${instructorId}/manage`;

  return (
    <nav className="ps-workspace-nav" aria-label="Instructor admin sections">
      <div className="ps-tabs">
        {TABS.map((tab) => {
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
