import { cva } from "class-variance-authority";

import { cn } from "./cn";

/**
 * Design System 2.0 — the dark premium sidebar vocabulary (master plan §22.4).
 *
 * The sidebar chassis (positioning, mobile off-canvas, scroll regions) still
 * lives on the frozen legacy structural classes in app/globals.css
 * (.app-shell/.sidebar/.sidebar-toggle/.sidebar-backdrop) so all nine roles
 * keep their exact responsive behavior; everything VISUAL — surface, type,
 * items, groups, badges — is defined here and composed by
 * components/app-shell.tsx and components/nav.tsx. One chrome for every role;
 * only the resolved nav content varies.
 *
 * Legacy `.nav*` and sidebar skin blocks in globals.css go dead with this
 * module and are listed for CSS deletion milestone 1 (addendum §9).
 */

/** The dark premium surface, layered over the legacy `.sidebar` chassis. */
export const sidebarSurfaceClass = cn(
  "border-r border-white/10 bg-brand-900",
  "bg-linear-to-b from-brand-900 via-[#340b5e] to-brand-950",
  "shadow-[4px_0_24px_rgba(26,5,51,0.35)]"
);

/*
 * CSS deletion milestone 1: the legacy `.sidebar-header`/`.sidebar-footer`
 * border declarations were removed from globals.css, so the 1px separators
 * are fully owned here — `border-b`/`border-t` carry width+style (Tailwind
 * v4 emits border-style alongside width utilities), white/10 the color.
 */
export const sidebarHeaderClass = "border-b border-b-white/10 px-5 pb-4 pt-5";
export const sidebarFooterClass = "border-t border-t-white/10 px-3 pb-4 pt-3";

/** Uppercase section label ("Top Tools", "Shortcuts", group names). */
export const sidebarSectionTitleClass =
  "px-3 pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/45";

/** One nav link row. `active` carries the brand-400 accent bar. */
export const sidebarLinkVariants = cva(
  [
    "group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-2",
    "text-[13px] font-medium no-underline transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400",
  ],
  {
    variants: {
      active: {
        true: [
          "bg-white/[0.12] font-semibold text-white",
          "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px]",
          "before:-translate-y-1/2 before:rounded-r-full before:bg-brand-400",
        ],
        false: "text-white/75 hover:bg-white/[0.08] hover:text-white",
      },
      nested: {
        true: "py-1.5 text-[12.5px]",
        false: "",
      },
    },
    defaultVariants: { active: false, nested: false },
  }
);

/** The emoji icon tile inside a nav link. */
export const sidebarIconVariants = cva(
  [
    "flex shrink-0 items-center justify-center rounded-[8px] leading-none",
    "transition-colors duration-150",
  ],
  {
    variants: {
      active: {
        true: "bg-brand-400/25",
        false: "bg-white/[0.07] group-hover:bg-white/[0.12]",
      },
      nested: {
        true: "size-6 text-[12.5px]",
        false: "size-7 text-[14px]",
      },
    },
    defaultVariants: { active: false, nested: false },
  }
);

/** Notification count pill on a nav link. */
export const sidebarBadgeClass =
  "ml-auto rounded-full bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-950";

/** Disclosure toggle for "More Tools" and nav groups. */
export const sidebarGroupToggleVariants = cva(
  [
    "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left",
    "text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400",
  ],
  {
    variants: {
      active: {
        true: "text-brand-300",
        false: "text-white/50 hover:text-white/80",
      },
      locked: {
        true: "cursor-default opacity-50 hover:text-white/50",
        false: "",
      },
    },
    defaultVariants: { active: false, locked: false },
  }
);

export function SidebarChevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto text-[13px] leading-none text-white/40 transition-transform duration-150",
        open && "rotate-90"
      )}
    >
      ›
    </span>
  );
}

/** "New!" unlock badge on a group toggle. */
export const sidebarNewBadgeClass =
  "rounded-full bg-brand-400/90 px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-brand-950";

/** The nav filter input (the Help Agent owns ⌘K; this just filters links). */
export const sidebarFilterInputClass = cn(
  "w-full rounded-[10px] border border-white/12 bg-white/[0.06] px-3 py-2 pr-8",
  "text-[13px] text-white placeholder:text-white/40",
  "transition-colors duration-150",
  "focus:border-brand-400/60 focus:outline-none"
);

/** The sidebar user footer card (identity + sign out). */
export function SidebarUserCard({
  initials,
  name,
  roleLabel,
  action,
}: {
  initials: string;
  name: string;
  roleLabel: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.06] p-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-400/25 text-[12.5px] font-bold text-white"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[13px] font-semibold text-white">{name}</p>
          <p className="m-0 truncate text-[11px] capitalize text-white/55">{roleLabel}</p>
        </div>
      </div>
      {action ? <div className="mt-2.5">{action}</div> : null}
    </div>
  );
}

/** Dark-surface secondary button (sign out, sidebar utilities). */
export const sidebarGhostButtonClass = cn(
  "inline-flex w-full cursor-pointer items-center justify-center rounded-[8px]",
  "border border-white/15 bg-transparent px-3 py-1.5",
  "text-[12px] font-semibold text-white/80 transition-colors duration-150",
  "hover:border-white/30 hover:bg-white/[0.08] hover:text-white",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400"
);
