"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CommandModeToggle } from "@/components/command-center/command-mode";
import { useHelpAgent } from "@/components/help-agent/help-agent-provider";
import { cn } from "@/components/ui-v2";

/**
 * Global command bar — the calm top chrome that sits above every page.
 *
 * One consistent place for the things you reach for constantly, no matter which
 * surface you're on:
 *   • a workspace/context label so you always know where you are,
 *   • global search (the YPP Help Agent, ⌘K) to jump to any person, class,
 *     partner, meeting, or action,
 *   • a quick-create menu for the work officers start most often,
 *   • a one-tap Help Agent entry,
 *   • a compact role indicator.
 *
 * Search + Help open the same global Help Agent palette already mounted in the
 * app shell, so there is a single, predictable "find anything" surface.
 */

type QuickCreateItem = { label: string; href: string; icon: string; hint?: string };

export default function CommandBar({
  workspaceLabel,
  roleLabel,
  officerTier = false,
}: {
  /** e.g. "Leadership Workspace" — the operating context the user is in. */
  workspaceLabel: string;
  /** Short role/title indicator, e.g. "Admin". */
  roleLabel: string;
  /** Officers get the quick-create menu (actions, meetings, initiatives, partners). */
  officerTier?: boolean;
}) {
  const helpAgent = useHelpAgent();
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  // Close the quick-create menu on outside click / Escape.
  useEffect(() => {
    if (!createOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (createRef.current && !createRef.current.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setCreateOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createOpen]);

  const quickCreate: QuickCreateItem[] = [
    { label: "New action", href: "/actions/new", icon: "✅", hint: "Track work & follow-ups" },
    { label: "Log a meeting", href: "/actions/meetings/new", icon: "📅", hint: "Decisions & follow-ups" },
    { label: "New initiative", href: "/operations/initiatives/new", icon: "🎯", hint: "Plan a quarter" },
    { label: "Add a partner", href: "/partners/new", icon: "🤝", hint: "External relationships" },
    { label: "Find a person", href: "/people/find", icon: "👥", hint: "Search or add someone" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 px-4 py-2.5 sm:px-6",
        "border-b border-[rgba(99,102,241,0.1)]",
        "bg-[rgba(255,255,255,0.82)] backdrop-blur-md",
        "supports-[backdrop-filter]:bg-[rgba(255,255,255,0.7)]"
      )}
    >
      {/* Workspace / context label */}
      <div className="hidden min-w-0 shrink-0 items-center gap-2 md:flex">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-md bg-linear-to-br from-[var(--ypp-purple-500)] to-[var(--ypp-purple-700)] text-[12px] text-white"
        >
          ◆
        </span>
        <span className="truncate text-[12.5px] font-semibold text-[var(--nav-purple-800)]">
          {workspaceLabel}
        </span>
      </div>

      {/* Global search — opens the YPP Help Agent (⌘K) */}
      <button
        type="button"
        onClick={() => helpAgent?.open()}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 py-2",
          "border border-[rgba(99,102,241,0.16)] bg-white/80",
          "text-left text-[13px] text-[var(--gray-500)] shadow-[0_1px_3px_rgba(59,15,110,0.05)]",
          "transition-colors duration-150 hover:border-[rgba(99,102,241,0.3)] hover:bg-white hover:text-[var(--nav-purple-700)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,102,241,0.45)]"
        )}
        aria-label="Search YPP — people, classes, partners, meetings, actions (⌘K)"
      >
        <span aria-hidden className="text-[14px]">
          ⌕
        </span>
        <span className="min-w-0 flex-1 truncate">
          Search people, classes, partners, work…
        </span>
        <kbd
          aria-hidden
          className="hidden rounded border border-[rgba(99,102,241,0.18)] bg-[rgba(99,102,241,0.06)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--nav-purple-500)] sm:inline"
        >
          ⌘K
        </kbd>
      </button>

      {/* Quick create (officers) */}
      {officerTier ? (
        <div className="relative shrink-0" ref={createRef}>
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={createOpen}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-white",
              "bg-linear-to-br from-[var(--ypp-purple-500)] to-[var(--ypp-purple-700)]",
              "shadow-[0_2px_8px_rgba(99,102,241,0.28)] transition-transform duration-150 hover:-translate-y-0.5",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,102,241,0.45)]"
            )}
          >
            <span aria-hidden className="text-[15px] leading-none">
              +
            </span>
            <span className="hidden sm:inline">Create</span>
          </button>

          {createOpen ? (
            <div
              role="menu"
              aria-label="Quick create"
              className="absolute right-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-[14px] border border-[rgba(99,102,241,0.14)] bg-white p-1.5 shadow-[0_12px_40px_rgba(59,15,110,0.16)]"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--gray-500)]">
                Quick create
              </p>
              {quickCreate.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setCreateOpen(false)}
                  className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-[var(--text-secondary)] no-underline transition-colors duration-150 hover:bg-[rgba(99,102,241,0.07)] hover:text-[var(--nav-purple-800)]"
                >
                  <span aria-hidden className="text-[15px]">
                    {item.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{item.label}</span>
                    {item.hint ? (
                      <span className="truncate text-[11px] text-[var(--gray-500)]">{item.hint}</span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* View preference — Calm / Executive density, shared across every
          operating surface. Officers only (member pages don't read it), but
          always reachable: a compact pill on narrow screens, full on wider. */}
      {officerTier ? (
        <>
          <div className="shrink-0 sm:hidden">
            <CommandModeToggle compact />
          </div>
          <div className="hidden shrink-0 sm:block">
            <CommandModeToggle />
          </div>
        </>
      ) : null}

      {/* Help Agent entry */}
      <button
        type="button"
        onClick={() => helpAgent?.open()}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          "border border-[rgba(99,102,241,0.16)] bg-white/80 text-[15px] text-[var(--nav-purple-700)]",
          "transition-colors duration-150 hover:border-[rgba(99,102,241,0.3)] hover:bg-white",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,102,241,0.45)]"
        )}
        aria-label="Open the YPP Help Agent"
        title="Help Agent"
      >
        ?
      </button>

      {/* Role indicator */}
      {roleLabel ? (
        <span className="hidden shrink-0 items-center rounded-full border border-[rgba(99,102,241,0.16)] bg-[rgba(99,102,241,0.05)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--nav-purple-700)] lg:inline-flex">
          {roleLabel}
        </span>
      ) : null}
    </header>
  );
}
