import { cva } from "class-variance-authority";

import { cn } from "./cn";
import marbleStyles from "./sidebar-marble.module.css";

/**
 * Sidebar vocabulary — light cream surface with bubbly pill nav links.
 *
 * Structural layout (positioning, mobile off-canvas, scroll regions) stays on
 * the legacy classes in app/globals.css (.app-shell/.sidebar/*).
 */

/** Light sidebar surface layered over the legacy `.sidebar` chassis. */
export const sidebarSurfaceClass = cn(
  "border-r border-[rgba(99,102,241,0.08)]",
  "bg-linear-to-b from-white to-[#f8f9fc]",
  "shadow-[4px_0_24px_rgba(59,15,110,0.04)]",
  "backdrop-blur-md"
);

export const sidebarHeaderClass = "border-b border-[rgba(99,102,241,0.08)] px-5 pb-4 pt-6";
export const sidebarFooterClass = "border-t border-[rgba(99,102,241,0.08)] px-3 pb-4 pt-3";

/** Bubbly card wrapping a nav section (Top Tools, More Tools). */
export const sidebarNavPanelClass = cn(
  "overflow-hidden rounded-[14px] border border-[rgba(99,102,241,0.11)]",
  "bg-linear-to-[165deg] from-white/97 via-[#f8f9ff]/99 to-[#fcfcff]/98",
  "shadow-[0_4px_22px_rgba(59,15,110,0.07),inset_0_1px_0_rgba(255,255,255,0.85)]"
);

/** Uppercase section label ("Top Tools", "Shortcuts", group names). */
export const sidebarSectionTitleClass = cn(
  "border-b border-[rgba(99,102,241,0.1)] px-3.5 py-2.5",
  "bg-linear-to-b from-[rgba(99,102,241,0.07)] to-[rgba(99,102,241,0.02)]",
  "text-[10px] font-extrabold uppercase tracking-[0.11em] text-[var(--nav-purple-700)]"
);

/** Thin divider between major nav sections (e.g. before "More Tools"). */
export const sidebarSectionDividerClass = "mx-2 my-2 border-t border-[rgba(99,102,241,0.08)]";

/** Disclosure toggle for "More Tools" and nav groups. */
export const sidebarGroupToggleVariants = cva(
  [
    "group flex w-full items-center gap-2 border-0 bg-transparent px-3 py-1.5 text-left shadow-none",
    "text-[10.5px] font-bold uppercase tracking-[0.12em] transition-colors duration-200",
    "appearance-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,102,241,0.45)]",
  ],
  {
    variants: {
      active: {
        true: "text-[var(--nav-purple-800)]",
        false: "text-[var(--gray-600)] hover:bg-[rgba(99,102,241,0.05)] hover:text-[var(--nav-purple-700)]",
      },
      open: {
        true: "text-[var(--nav-purple-700)]",
        false: "",
      },
      locked: {
        true: "cursor-default opacity-45 hover:bg-transparent hover:text-[var(--gray-600)]",
        false: "",
      },
    },
    compoundVariants: [
      {
        active: true,
        open: true,
        className: "text-[var(--nav-purple-800)]",
      },
    ],
    defaultVariants: { active: false, open: false, locked: false },
  }
);

export function SidebarChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={cn(
        "ml-auto size-3 shrink-0 text-[var(--gray-500)] transition-[transform,color] duration-200",
        "group-hover:text-[var(--nav-purple-600)]",
        open && "rotate-90 text-[var(--nav-purple-700)]"
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 2.5 8 6 4.5 9.5" />
    </svg>
  );
}

/** One nav link row — bubbly pill with purple active accent. */
export const sidebarLinkVariants = cva(
  [
    "group relative flex items-center gap-3 rounded-full border border-transparent px-2.5 py-2.5",
    "text-[13px] font-medium no-underline transition-all duration-[180ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
    "text-[var(--text-secondary)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,102,241,0.45)]",
  ],
  {
    variants: {
      active: {
        true: [
          "font-semibold text-[var(--nav-purple-800)]",
          "bg-linear-to-r from-[rgba(99,102,241,0.16)] via-[rgba(99,102,241,0.07)] to-[rgba(255,255,255,0.65)]",
          "border-[rgba(99,102,241,0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_14px_rgba(99,102,241,0.1)]",
          "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px]",
          "before:rounded-r-full before:bg-linear-to-b before:from-[var(--ypp-purple)] before:to-[var(--ypp-purple-400)]",
        ],
        false: [
          "hover:-translate-y-0.5 hover:text-[var(--nav-purple-800)]",
          "hover:border-[rgba(99,102,241,0.18)]",
          "hover:bg-[radial-gradient(130%_200%_at_10%_0%,rgba(255,255,255,0.98)_0%,rgba(237,233,254,0.88)_40%,rgba(224,219,254,0.55)_100%)]",
          "hover:shadow-[0_8px_22px_rgba(99,102,241,0.14),0_3px_8px_rgba(59,15,110,0.07),inset_0_1px_0_rgba(255,255,255,0.92)]",
        ],
      },
      nested: {
        true: "py-2 text-[12.5px]",
        false: "",
      },
    },
    defaultVariants: { active: false, nested: false },
  }
);

/** The emoji icon tile inside a nav link. */
export const sidebarIconVariants = cva(
  [
    "flex shrink-0 items-center justify-center rounded-full leading-none",
    "bg-linear-to-[145deg] from-[rgba(99,102,241,0.11)] to-[rgba(99,102,241,0.06)]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
    "transition-all duration-[180ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
    "group-hover:scale-[1.06] group-hover:from-[rgba(99,102,241,0.22)] group-hover:to-[rgba(99,102,241,0.11)]",
    "group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_4px_12px_rgba(99,102,241,0.15)]",
  ],
  {
    variants: {
      active: {
        true: "from-[rgba(99,102,241,0.26)] to-[rgba(99,102,241,0.13)] shadow-[0_0_0_1px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.55)]",
        false: "",
      },
      nested: {
        true: "size-[30px] text-[15px]",
        false: "size-9 text-[17px]",
      },
    },
    defaultVariants: { active: false, nested: false },
  }
);

/** Notification count pill on a nav link. */
export const sidebarBadgeClass =
  "ml-auto rounded-full bg-linear-to-br from-[#7c3aed] to-[#6366f1] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_1px_2px_rgba(59,15,110,0.2)]";

/** "New!" unlock badge on a group toggle. */
export const sidebarNewBadgeClass =
  "rounded-full bg-[#7c3aed] px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-white";

/** The nav filter input (the Help Agent owns ⌘K; this just filters links). */
export const sidebarFilterInputClass = cn(
  "w-full rounded-[10px] border border-[rgba(99,102,241,0.14)] bg-[rgba(255,255,255,0.92)] px-3 py-2 pr-8",
  "text-[13px] text-[var(--text-secondary)] placeholder:text-[var(--gray-500)]",
  "shadow-[0_1px_3px_rgba(59,15,110,0.06)] transition-colors duration-150",
  "focus:border-[rgba(99,102,241,0.45)] focus:outline-none focus:ring-[3px] focus:ring-[rgba(99,102,241,0.12)]"
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
    <div className={cn(marbleStyles.marblePanel, "p-3.5")}>
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[var(--ypp-purple-500)] to-[var(--ypp-purple-700)] text-[13px] font-bold tracking-tight text-white"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[13px] font-bold text-[var(--ypp-purple-800)]">{name}</p>
          <p className="m-0 mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--gray-500)]">
            {roleLabel}
          </p>
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

/** Light-surface secondary button (sign out, sidebar utilities). */
export const sidebarGhostButtonClass = cn(
  "inline-flex w-full cursor-pointer items-center justify-center rounded-[var(--radius-md)]",
  "border border-[var(--border)] bg-white px-3 py-1.5",
  "text-[12px] font-semibold text-[var(--text-secondary)] transition-colors duration-150",
  "hover:border-[rgba(99,102,241,0.22)] hover:bg-[#f8f9fc] hover:text-[var(--nav-purple-800)]",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(99,102,241,0.45)]"
);
