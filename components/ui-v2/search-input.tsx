"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Standard search affordance. `kbdHint` renders the shortcut chip — pass
 * "⌘K" only on inputs that actually open the Help Agent.
 */
export const SearchInputV2 = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { kbdHint?: string; wrapClassName?: string }
>(function SearchInputV2({ kbdHint, className, wrapClassName, ...props }, ref) {
  return (
    <div className={cn("relative flex items-center", wrapClassName)}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 text-[14px] text-ink-muted"
      >
        ⌕
      </span>
      <input
        ref={ref}
        type="search"
        className={cn(
          "h-9.5 w-full rounded-[8px] border border-line bg-surface pl-8 pr-12",
          "text-[13.5px] text-ink placeholder:text-ink-muted/70",
          "transition-colors duration-150 hover:border-brand-400",
          "focus:border-brand-500 focus:outline-2 focus:outline-offset-1 focus:outline-brand-400/40",
          className
        )}
        {...props}
      />
      {kbdHint ? (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 rounded border border-line bg-surface-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted"
        >
          {kbdHint}
        </kbd>
      ) : null}
    </div>
  );
});
