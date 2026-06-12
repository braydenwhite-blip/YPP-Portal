"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "./cn";

/**
 * Master-database filter row (DS 2.0 tranche 2): chip links + a URL-synced
 * search input. Filters are LINKS, not client state — the server page reads
 * searchParams and re-queries, so filtered views are shareable, back-button
 * friendly, and StatCard click-to-filter lands on the same URLs.
 */
export function FilterBar({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? "Filters"}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {children}
    </div>
  );
}

/** One filter chip. Active chips render solid; the rest are quiet outlines. */
export function FilterChipLink({
  href,
  active,
  children,
  count,
  className,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
        "text-[12.5px] font-semibold transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-line bg-surface text-brand-800 hover:border-brand-400 hover:bg-brand-50",
        className
      )}
    >
      {children}
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] font-bold",
            active ? "bg-white/20 text-white" : "bg-brand-50 text-brand-700"
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Debounced search input that writes `?q=` into the URL (preserving every
 * other param) so the server page re-queries. router.replace keeps typing
 * out of the history stack.
 */
export function UrlSyncedSearchInput({
  paramKey = "q",
  placeholder,
  className,
  wrapClassName,
  "aria-label": ariaLabel,
}: {
  paramKey?: string;
  placeholder?: string;
  className?: string;
  wrapClassName?: string;
  "aria-label"?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get(paramKey) ?? "";
  const [value, setValue] = useState(initial);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) params.set(paramKey, trimmed);
      else params.delete(paramKey);
      router.replace(`${pathname}${params.size > 0 ? `?${params}` : ""}`, {
        scroll: false,
      });
    }, 300);
    return () => window.clearTimeout(timer);
    // searchParams intentionally read once per change; re-running on every
    // navigation would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, paramKey, pathname, router]);

  return (
    <div className={cn("relative flex items-center", wrapClassName)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 text-[14px] text-ink-muted"
      >
        ⌕
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder ?? "Search"}
        className={cn(
          "h-9.5 w-full rounded-[8px] border border-line bg-surface pl-8 pr-3",
          "text-[13.5px] text-ink placeholder:text-ink-muted/70",
          "transition-colors duration-150 hover:border-brand-400",
          "focus:border-brand-500 focus:outline-2 focus:outline-offset-1 focus:outline-brand-400/40",
          className
        )}
      />
    </div>
  );
}
