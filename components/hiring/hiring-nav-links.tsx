"use client";

import Link from "next/link";

import { buttonVariants, cn } from "@/components/ui-v2";

/**
 * Mockup header actions: Board | Waitlist toggle + primary Add applicant.
 */
export function HiringNavLinks({
  current,
  boardCount,
  showWaitlist = true,
}: {
  current: "board" | "waitlist";
  boardCount?: number;
  showWaitlist?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <nav
        aria-label="Hiring pages"
        className="flex items-center gap-0.5 rounded-full border border-line-soft bg-white p-0.5 shadow-sm"
      >
        <Link
          href="/admin/instructor-applicants"
          aria-current={current === "board" ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold no-underline transition-colors",
            current === "board"
              ? "bg-brand-700 text-white shadow-sm"
              : "text-ink-muted hover:text-ink"
          )}
        >
          Board{typeof boardCount === "number" ? ` (${boardCount})` : ""}
        </Link>
        {showWaitlist ? (
          <Link
            href="/admin/applicants/waitlist"
            aria-current={current === "waitlist" ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold no-underline transition-colors",
              current === "waitlist"
                ? "bg-brand-700 text-white shadow-sm"
                : "text-ink-muted hover:text-ink"
            )}
          >
            Waitlist
          </Link>
        ) : null}
      </nav>
      <Link
        href="/admin/external-applicants/new"
        className={cn(buttonVariants({ variant: "primary", size: "md" }), "no-underline")}
      >
        + Add applicant
      </Link>
    </div>
  );
}
