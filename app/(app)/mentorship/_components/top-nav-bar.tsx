"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui-v2";

export type TopNavBarProps = {
  /** Whether the user has mentor/admin access for review-related links. */
  hasReviewAccess: boolean;
  /** Whether the user has admin access. */
  isAdmin: boolean;
};

const NAV_ITEMS: { href: string; label: string; icon: string; requiresReview?: boolean; requiresAdmin?: boolean }[] = [
  { href: "/mentorship?view=me", label: "My Development", icon: "🌱" },
  { href: "/mentorship/mentees", label: "Mentees", icon: "👥" },
  { href: "/mentorship/schedule", label: "Schedule", icon: "📅" },
  { href: "/mentorship/reviews", label: "Reviews", icon: "📝", requiresReview: true },
  { href: "/mentorship/feedback", label: "Feedback", icon: "💬", requiresReview: true },
  { href: "/mentorship/cycles", label: "Cycles", icon: "🔄", requiresReview: true },
  { href: "/mentorship/resources", label: "Resources", icon: "📚" },
  { href: "/mentorship/awards", label: "Awards", icon: "🏆", requiresReview: true },
  { href: "/admin/mentorship", label: "Admin", icon: "⚙️", requiresAdmin: true },
];

/**
 * Top navigation bar for the mentorship hub — actual buttons linking to
 * the main pages. Every user gets Schedule and Resources regardless of
 * mentor/mentee status.
 */
export function TopNavBar({ hasReviewAccess, isAdmin }: TopNavBarProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Mentorship pages"
      className="flex flex-wrap items-center gap-1.5 rounded-[14px] border border-line-soft bg-surface px-3 py-2 shadow-sm"
    >
      {NAV_ITEMS.filter((item) => {
        if (item.requiresAdmin && !isAdmin) return false;
        if (item.requiresReview && !hasReviewAccess) return false;
        return true;
      }).map((item) => {
        const isActive =
          pathname === item.href ||
          pathname.startsWith(item.href + "/") ||
          (item.href === "/mentorship?view=me" && (pathname === "/mentorship" || pathname.includes("view=me")));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold no-underline transition-colors",
              isActive
                ? "bg-brand-600 text-white shadow-sm"
                : "text-ink-muted hover:bg-brand-50 hover:text-brand-700"
            )}
          >
            <span className="text-[14px]">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}