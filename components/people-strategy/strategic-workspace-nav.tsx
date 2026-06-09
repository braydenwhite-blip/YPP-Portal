import Link from "next/link";
import type { ReactNode } from "react";

import { ActionCommandBar } from "./action-command-bar";

/**
 * Strategic workspace navigation (3.5, Phase B).
 *
 * One reusable, accessible switcher + breadcrumb + header for every strategic
 * operations surface, replacing the ad-hoc per-page `<nav>` pill rows that each
 * carried a different set/order of links and no active state. Pure server
 * components — the page passes its `current` key and breadcrumb trail; nothing
 * here touches the client, so it SSRs and is trivially testable.
 *
 * Visual language reuses the design-system segmented control (`.ps-tabs` /
 * `.ps-tab`, with the `aria-current="page"` gradient active pill) so the
 * workspace switcher reads native next to the rest of the tracker.
 */

export type StrategicNavKey =
  | "command-center"
  | "portfolio"
  | "initiatives"
  | "projects"
  | "weekly-review"
  | "actions"
  | "meetings";

type NavItem = { key: StrategicNavKey; label: string; href: string };

/**
 * The strategic workspace, in leadership-reading order: the cockpit, then the
 * executive overview, then the program → project ladder, then the weekly cadence
 * and the underlying execution trackers. Not a giant navbar — the seven places a
 * leader actually moves between every week.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { key: "command-center", label: "Command Center", href: "/operations/command-center" },
  { key: "portfolio", label: "Portfolio", href: "/operations/portfolio" },
  { key: "initiatives", label: "Initiatives", href: "/operations/initiatives" },
  { key: "projects", label: "Projects", href: "/operations/projects" },
  { key: "weekly-review", label: "Weekly Review", href: "/operations/weekly-review" },
  { key: "actions", label: "Actions", href: "/actions/command-center" },
  { key: "meetings", label: "Meetings", href: "/actions/meetings" },
];

/**
 * The portfolio / initiatives / projects surfaces are gated behind the strategic
 * initiatives flag. The Command Center and Weekly Review are not, so when that
 * flag is off they must not link into destinations that would 404.
 */
const STRATEGIC_ONLY: ReadonlySet<StrategicNavKey> = new Set([
  "portfolio",
  "initiatives",
  "projects",
]);

export function StrategicWorkspaceNav({
  current,
  showStrategic = true,
}: {
  current?: StrategicNavKey;
  showStrategic?: boolean;
}) {
  const items = showStrategic
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => !STRATEGIC_ONLY.has(item.key));
  return (
    <div className="ps-workspace-nav">
      <nav className="ps-tabs" aria-label="Strategic workspace">
        {items.map((item) => {
          const active = item.key === current;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="ps-tab"
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export type StrategicCrumb = { label: string; href?: string };

/**
 * Makes the Portfolio → Initiative → Project hierarchy explicit. The last crumb
 * is the current page (never a link); earlier crumbs link up the stack.
 */
export function StrategicBreadcrumbs({ trail }: { trail: StrategicCrumb[] }) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="ps-breadcrumbs">
        {trail.map((crumb, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <li key={`${crumb.label}-${idx}`} className="ps-crumb">
              {crumb.href && !isLast ? (
                <Link href={crumb.href}>{crumb.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
              )}
              {!isLast ? (
                <span className="ps-crumb-sep" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The single header every strategic page uses: optional breadcrumbs, the shared
 * command bar (eyebrow / title / subtitle / meta / actions), and the workspace
 * switcher — composed once so pages stop hand-rolling three separate blocks.
 */
export function StrategicWorkspaceHeader({
  current,
  breadcrumbs,
  showStrategic = true,
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: {
  current?: StrategicNavKey;
  breadcrumbs?: StrategicCrumb[];
  showStrategic?: boolean;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ps-workspace-header">
      {breadcrumbs && breadcrumbs.length > 0 ? <StrategicBreadcrumbs trail={breadcrumbs} /> : null}
      <ActionCommandBar
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        meta={meta}
        actions={actions}
      />
      <StrategicWorkspaceNav current={current} showStrategic={showStrategic} />
    </header>
  );
}

/**
 * Consistent vertical rhythm for the stack of sections below a strategic header,
 * so pages stop repeating `marginTop: 26` on every `<section>`.
 */
export function StrategicStack({
  children,
  gap,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div className="ps-stack" style={gap != null ? { gap } : undefined}>
      {children}
    </div>
  );
}
