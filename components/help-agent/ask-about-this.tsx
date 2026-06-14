"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui-v2";
import { entityPrompts } from "@/lib/help-agent/chief-of-staff";

/**
 * "Ask about this" — a lightweight, embedded entry point to the existing Chief
 * of Staff (Help Agent), prefilled with this record's context.
 *
 * It does NOT introduce a new system: every option is a link to the existing
 * `/help-agent` page carrying `?entityType=…&entityId=…&q=…`. The Help Agent
 * page reads that context, scopes the deterministic answer to the record, and
 * auto-runs the chosen question. Page-aware prompts come from the shared
 * `entityPrompts()` map so the same suggestions appear everywhere.
 */
export function AskAboutThis({
  entityType,
  entityId,
  label = "Ask about this",
  size = "sm",
  variant = "secondary",
  align = "right",
  className,
}: {
  entityType: string;
  entityId: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const prompts = entityPrompts(entityType);

  function hrefFor(question: string) {
    const params = new URLSearchParams({ entityType, entityId, q: question });
    return `/help-agent?${params.toString()}`;
  }

  // Close on outside click / Escape so the menu never traps focus.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[8px] border font-sans font-semibold transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
          size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9.5 px-4 text-[13.5px]",
          variant === "ghost"
            ? "border-transparent bg-transparent text-brand-700 hover:bg-brand-50"
            : "border-line bg-surface text-brand-800 hover:border-brand-400 hover:bg-brand-50"
        )}
      >
        <span aria-hidden className="text-brand-600">
          ✦
        </span>
        {label}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-1.5 w-72 overflow-hidden rounded-[12px] border border-line bg-surface shadow-card",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <p className="m-0 border-b border-line-soft px-3 py-2 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
            Ask the Chief of Staff
          </p>
          <ul className="m-0 flex list-none flex-col p-1.5">
            {prompts.map((p) => (
              <li key={p.question}>
                <Link
                  role="menuitem"
                  href={hrefFor(p.question)}
                  onClick={() => setOpen(false)}
                  className="block rounded-[8px] px-2.5 py-2 text-[13px] font-medium text-ink hover:bg-brand-50 hover:text-brand-800"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
