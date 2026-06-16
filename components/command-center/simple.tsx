"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn, StatusBadge, type StatusTone } from "@/components/ui-v2";

import { CalmCollapse, CalmOnly } from "./command-mode";
import { CcIcon, type CcIconName } from "./icons";
import { Avatar } from "./primitives";

/**
 * The simple kit — a small set of calm, reusable building blocks for the
 * reduction pass. Every operating surface should be expressible as: a header, a
 * primary focus card, a short list, and a quiet action strip. Plain language,
 * lots of whitespace, few badges, one obvious next move.
 */

// --- primary focus card -----------------------------------------------------

/** The one big "what should I do right now?" card. Soft, calm, one CTA. */
export function PrimaryFocusCard({
  eyebrow = "Your next action",
  title,
  reason,
  icon = "target",
  tone = "brand",
  ctaLabel = "Start now",
  ctaHref,
}: {
  eyebrow?: string;
  title: string;
  reason?: string;
  icon?: CcIconName;
  tone?: "brand" | "success";
  ctaLabel?: string;
  ctaHref: string;
}) {
  const accent =
    tone === "success"
      ? { wrap: "from-success-100/40", chip: "bg-success-100 text-success-700", eyebrow: "text-success-700" }
      : { wrap: "from-brand-50/70", chip: "bg-brand-100 text-brand-700", eyebrow: "text-brand-700" };
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border border-line-soft bg-gradient-to-br via-surface to-surface/90 p-5 shadow-card backdrop-blur sm:flex-row sm:items-center sm:gap-5 sm:p-6",
        accent.wrap
      )}
    >
      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-[16px]", accent.chip)}>
        <CcIcon name={icon} size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em]", accent.eyebrow)}>{eyebrow}</p>
        <p className="m-0 text-[21px] font-bold leading-snug tracking-[-0.01em] text-ink">{title}</p>
        {reason ? <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-muted">{reason}</p> : null}
      </div>
      <Link
        href={ctaHref}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-card transition-colors hover:bg-brand-700"
      >
        {ctaLabel} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

// --- simple list card + rows ------------------------------------------------

/** A clean clickable row: who · what · related · status — and a chevron. */
export function SimpleRow({
  href,
  name,
  what,
  related,
  status,
  meta,
  icon,
}: {
  href: string;
  /** Primary subject (person or item). An avatar is drawn from it unless `icon` is given. */
  name: string;
  /** One line of detail — what they owe / what it is. */
  what?: string;
  /** A related entity, shown after `what` separated by a dot. */
  related?: string | null;
  /** Right-side status pill. */
  status?: { label: string; tone: StatusTone } | null;
  /** Right-side sub-label under the status (e.g. "2d overdue"). */
  meta?: string | null;
  /** Use a glyph instead of an avatar. */
  icon?: CcIconName;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[12px] px-3 py-3 transition-colors hover:bg-surface-soft"
    >
      {icon ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
          <CcIcon name={icon} size={16} />
        </span>
      ) : (
        <Avatar name={name} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{name}</span>
        {what || related ? (
          <span className="block truncate text-[12.5px] text-ink-muted">
            {[what, related].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
        {meta ? <span className="text-[11.5px] text-ink-muted">{meta}</span> : null}
      </span>
      <span aria-hidden className="ml-1 shrink-0 text-ink-muted transition-colors group-hover:text-brand-600">
        <CcIcon name="arrowRight" size={15} />
      </span>
    </Link>
  );
}

/** A single calm card that holds a short list of rows. */
export function SimpleListCard({
  title,
  action,
  children,
  empty,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[18px] border border-line-soft bg-surface/80 p-2 shadow-card backdrop-blur">
      {title ? (
        <header className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
          <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">{title}</h3>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="flex flex-col divide-y divide-line-soft/70">{children}</div>
      {empty ? <div className="px-3 py-2">{empty}</div> : null}
    </section>
  );
}

// --- quiet action strip -----------------------------------------------------

export type SimpleAction = { label: string; href: string; icon?: CcIconName; primary?: boolean };

/** A non-fixed row of quiet actions, shown below the main content. */
export function SimpleActionStrip({ actions }: { actions: SimpleAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-line-soft bg-surface/70 p-2 shadow-card backdrop-blur">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
            action.primary
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "text-ink-muted hover:bg-surface-soft hover:text-ink"
          )}
        >
          {action.icon ? <CcIcon name={action.icon} size={14} className={action.primary ? undefined : "text-brand-600"} /> : null}
          {action.label}
        </Link>
      ))}
    </div>
  );
}

// --- simple surface (the calm/executive page arrangement) -------------------

/**
 * The shared shape every simplified operating page takes. One capped column:
 *
 *   header → focus card → (calm summary) → quiet action strip → dense detail
 *
 * The focus card and strip show in both modes. The calm summary (a short list)
 * shows only in Calm — Executive supersedes it with the full detail. The dense
 * detail (existing tables, filters, panels) is passed as `children` and demoted
 * behind a collapsed "Browse all" in Calm; Executive expands it inline. Nothing
 * is deleted — it is moved out of the calm default and one click away.
 */
export function SimpleSurface({
  header,
  focus,
  calm,
  actions,
  browseLabel = "Browse all",
  browseHint,
  children,
  maxWidth = 880,
}: {
  /** Plain page header (title + one sentence + the mode pill). */
  header?: ReactNode;
  /** The one lead card. Shown in both modes. */
  focus?: ReactNode;
  /** Short calm summary (a few rows). Shown only in Calm mode. */
  calm?: ReactNode;
  /** Quiet CTAs. Shown in both modes. */
  actions?: SimpleAction[];
  /** Disclosure label for the demoted dense detail. */
  browseLabel?: string;
  browseHint?: string;
  /** The existing dense surface — collapsed in Calm, inline in Executive. */
  children?: ReactNode;
  /** Comfortable reading width for the column. */
  maxWidth?: number;
}) {
  return (
    <div className="mx-auto flex w-full flex-col gap-5 pb-10" style={{ maxWidth }}>
      {header}
      {focus}
      {calm ? <CalmOnly>{calm}</CalmOnly> : null}
      {actions && actions.length > 0 ? <SimpleActionStrip actions={actions} /> : null}
      {children ? (
        <CalmCollapse label={browseLabel} hint={browseHint}>
          {children}
        </CalmCollapse>
      ) : null}
    </div>
  );
}

// --- calm empty state -------------------------------------------------------

export function EmptySimpleState({ icon = "check", children }: { icon?: CcIconName; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-line-soft bg-surface-soft/50 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-success-100 text-success-700">
        <CcIcon name={icon} size={20} />
      </span>
      <p className="m-0 max-w-sm text-[13.5px] text-ink-muted">{children}</p>
    </div>
  );
}
