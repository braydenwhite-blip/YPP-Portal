import type { ReactNode } from "react";

import { cn } from "./cn";
import { PageHeaderV2 } from "./page-header";
import { StatusBadge, type StatusTone } from "./status-badge";
import { ViewSwitcher, type SwitcherView } from "./view-switcher";

/**
 * The tracker family (Design System 2.0). One shape for every "list of work I
 * triage" surface — actions, meetings, applications, requests — so trackers
 * stop reading like admin databases.
 *
 * Doctrine: docs/ypp-global-intuitiveness-design-system.md §5.
 *   TrackerShell  → the page chassis (title → start-here → views → filters → list)
 *   TrackerRow    → one scannable row (title · status · meta · next step · 1 action)
 *   TrackerPreview→ the standard item preview body (drops into PreviewPanel/DrawerShell)
 */

/**
 * Canonical tracker page chassis. Renders the doctrine's order and spacing so a
 * leader who learns one tracker has learned them all. `start` (the recommended
 * next step) is optional — board-style surfaces omit it.
 */
export function TrackerShell({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel,
  primaryAction,
  secondaryAction,
  metrics,
  start,
  views,
  viewsAside,
  filters,
  count,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** The one primary CTA. */
  primaryAction?: ReactNode;
  /** At most one quieter secondary CTA. */
  secondaryAction?: ReactNode;
  /** 3–5 summary cards (usually a MetricStrip) — sits under the title. */
  metrics?: ReactNode;
  /** Recommended next step (usually a TrackerStartCard). */
  start?: ReactNode;
  /** View switcher entries. */
  views?: SwitcherView[];
  /** Right-aligned companion to the switcher (usually a search input). */
  viewsAside?: ReactNode;
  /** Collapsed deep filters (usually an AdvancedFilters). */
  filters?: ReactNode;
  /** Quiet result-count line ("12 items · matching 'camp'"). */
  count?: ReactNode;
  /** The list / table / cards. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[1440px] flex-col gap-6", className)}>
      <PageHeaderV2
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        backLabel={backLabel}
        actions={
          primaryAction || secondaryAction ? (
            <>
              {primaryAction}
              {secondaryAction}
            </>
          ) : undefined
        }
      >
        {metrics}
      </PageHeaderV2>

      {start}

      {views || viewsAside || filters ? (
        <div className="flex flex-col gap-3">
          {views || viewsAside ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {views ? (
                <ViewSwitcher views={views} aria-label={`${title} views`} />
              ) : (
                <span />
              )}
              {viewsAside}
            </div>
          ) : null}
          {filters}
        </div>
      ) : null}

      {count ? (
        <p className="m-0 text-[12.5px] text-ink-muted">{count}</p>
      ) : null}

      {children}
    </div>
  );
}

/**
 * One scannable tracker row. Essentials only — leading entity/title, a status
 * badge with its reason, an owner/due meta line, the recommended next step, and
 * at most one trailing action. Secondary metadata belongs in the preview, not
 * here. Renders an <li>; wrap rows in <ul className="flex flex-col gap-2">.
 */
export function TrackerRow({
  title,
  href,
  leading,
  status,
  meta,
  nextStep,
  action,
  className,
}: {
  title: ReactNode;
  /** Where the title links (preview/detail). Keep `action` separate to avoid nested links. */
  href?: string;
  /** Optional leading element (EntityChip, avatar). */
  leading?: ReactNode;
  status?: { label: ReactNode; tone: StatusTone; title?: string };
  /** Owner · due · source — one quiet line. */
  meta?: ReactNode;
  /** The recommended next move, emphasized. */
  nextStep?: ReactNode;
  /** A single trailing action (link/button). */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "rounded-[8px] border border-line-soft px-3.5 py-2.5 transition-colors",
        href ? "hover:border-brand-400" : "",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {leading}
          {href ? (
            <a
              href={href}
              className="truncate text-[13.5px] font-semibold text-ink hover:underline"
            >
              {title}
            </a>
          ) : (
            <span className="truncate text-[13.5px] font-semibold text-ink">{title}</span>
          )}
          {status ? (
            <StatusBadge tone={status.tone} title={status.title}>
              {status.label}
            </StatusBadge>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {meta ? <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{meta}</p> : null}
      {nextStep ? (
        <p className="m-0 mt-1 text-[12.5px] font-medium text-ink">{nextStep}</p>
      ) : null}
    </li>
  );
}

/**
 * Standard tracker-item preview body: title + status, a small concrete facts
 * grid, the recommended next step, and quick actions. Drops into a PreviewPanel
 * or DrawerShell — it owns the content, not the chrome. This is the calm
 * "preview before full page" altitude (doctrine §14).
 */
export function TrackerPreview({
  title,
  status,
  facts,
  nextStep,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  status?: { label: ReactNode; tone: StatusTone; title?: string };
  /** Concrete facts only — omit empties, never render "—" rows (§19). */
  facts?: { label: string; value: ReactNode }[];
  nextStep?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 text-[16px] font-bold leading-tight text-ink">{title}</h3>
        {status ? (
          <StatusBadge tone={status.tone} title={status.title}>
            {status.label}
          </StatusBadge>
        ) : null}
      </div>

      {facts && facts.length > 0 ? (
        <dl className="m-0 grid grid-cols-2 gap-3">
          {facts.map((fact) => (
            <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                {fact.label}
              </dt>
              <dd className="m-0 text-[13.5px] font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {nextStep ? (
        <div className="rounded-[10px] border border-brand-200 bg-brand-50/55 px-3.5 py-2.5">
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-brand-700">
            Next step
          </p>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink">{nextStep}</p>
        </div>
      ) : null}

      {children}

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
