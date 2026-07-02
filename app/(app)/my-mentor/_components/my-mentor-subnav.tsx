"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui-v2";

const ITEMS: { href: string; label: string; match?: string }[] = [
  { href: "/mentorship?view=me", label: "Overview", match: "/mentorship" },
  { href: "/my-mentor/goals", label: "Goals" },
  { href: "/my-mentor/progress", label: "Progress" },
  { href: "/my-mentor/reflection", label: "Reflection" },
  { href: "/my-mentor/schedule", label: "Schedule" },
  { href: "/my-mentor/resources", label: "Resources" },
  { href: "/my-mentor/awards", label: "Awards" },
  { href: "/my-mentor/help", label: "Get help" },
];

/**
 * Shared sub-navigation for the mentee "My development" detail surfaces
 * (/my-mentor/*), styled to match the mentorship hub's segmented-pill
 * language. "Overview" always leads back to the hub's mentee POV.
 */
export function MyMentorSubnav() {
  const pathname = usePathname() ?? "/my-mentor";

  return (
    <nav aria-label="My development sections" className="flex flex-wrap gap-1.5">
      {ITEMS.map((item) => {
        const matchPath = item.match ?? item.href;
        const active =
          pathname === matchPath || pathname.startsWith(matchPath + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold no-underline transition-colors",
              active
                ? "bg-brand-50 text-brand-800"
                : "text-ink-muted hover:bg-brand-50/60 hover:text-brand-700"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default MyMentorSubnav;
