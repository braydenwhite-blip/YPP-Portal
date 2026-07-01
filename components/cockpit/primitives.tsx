"use client";

// Shared guided-cockpit primitives for the Advising and Instructor-Pairing
// operating rooms. Built entirely on ui-v2 (Tailwind) so both cockpits feel
// like one premium product: a hero, a plain-English briefing strip, decision
// lanes, and spotlight cards with one obvious primary action.

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  Button,
  CardV2,
  EmptyStateV2,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import { useEntity360 } from "@/components/operations/entity-360-context";
import type { Entity360Type } from "@/lib/operations/entity-360";

const RAIL_VAR: Record<StatusTone, string> = {
  neutral: "var(--color-line)",
  info: "var(--color-info-700)",
  success: "var(--color-success-700)",
  warning: "var(--color-warning-700)",
  danger: "var(--color-danger-700)",
  brand: "var(--color-brand-600)",
};

export function CockpitHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-brand-600">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-sans text-[26px] font-extrabold leading-tight text-ink">
          {title}
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-muted">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type BriefingChipData = {
  key: string;
  label: string;
  count: number;
  tone: StatusTone;
  laneId: string | null;
};

/**
 * Scroll a deep-linked lane into view once, after mount. Used when a surface
 * links to `…?lane=<laneId>` (Data 360, Needs Attention, Chapter Impact
 * Meetings) so the cockpit opens focused on the right lane rather than at the
 * top. No-op when `laneId` is null or its anchor isn't on the page.
 */
export function useScrollToLaneOnMount(laneId: string | null): void {
  useEffect(() => {
    if (!laneId) return;
    const el = document.getElementById(`lane-${laneId}`);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [laneId]);
}

export function BriefingStrip({ chips }: { chips: BriefingChipData[] }) {
  function jump(laneId: string | null) {
    if (!laneId) return;
    const el = document.getElementById(`lane-${laneId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      {chips.map((chip) => {
        const muted = chip.count === 0;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => jump(chip.laneId)}
            disabled={!chip.laneId || muted}
            className={cn(
              "group flex items-center gap-2 rounded-[10px] border bg-surface px-3 py-2 text-left transition-colors",
              chip.laneId && !muted
                ? "cursor-pointer border-line-soft hover:border-brand-400 hover:bg-brand-50"
                : "cursor-default border-line-soft",
            )}
          >
            <span
              className={cn(
                "min-w-[1.6rem] rounded-[7px] px-1.5 py-0.5 text-center text-[15px] font-extrabold tabular-nums",
                muted ? "text-ink-muted" : "text-ink",
              )}
              style={muted ? undefined : { color: RAIL_VAR[chip.tone] }}
            >
              {chip.count}
            </span>
            <span className="text-[12.5px] font-medium leading-tight text-ink-muted">
              {chip.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CockpitLane({
  laneId,
  label,
  blurb,
  count,
  children,
  highlighted = false,
}: {
  laneId: string;
  label: string;
  blurb: string;
  count: number;
  children: ReactNode;
  /** When true, the lane is visually focused (a deep-link landed on it). */
  highlighted?: boolean;
}) {
  return (
    <section
      id={`lane-${laneId}`}
      className={cn(
        "scroll-mt-20 rounded-[14px] transition-shadow",
        highlighted &&
          "bg-brand-50/50 p-3 shadow-[0_0_0_2px_var(--color-brand-400)] sm:p-4",
      )}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-sans text-[15px] font-bold text-ink">{label}</h2>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-brand-700">
            {count}
          </span>
          {highlighted ? (
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-white">
              Focused
            </span>
          ) : null}
        </div>
        <p className="hidden text-[12px] text-ink-muted sm:block">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

export function LaneEmpty({ title, body }: { title: string; body: string }) {
  return (
    <CardV2 padding="md" className="border-dashed">
      <EmptyStateV2 icon="✓" title={title} body={body} tone="neutral" />
    </CardV2>
  );
}

export function SpotlightCard({
  accentTone,
  statusLabel,
  statusTone,
  title,
  subtitle,
  why,
  context,
  metaLine,
  nextAction,
  actions,
}: {
  accentTone: StatusTone;
  statusLabel: string;
  statusTone: StatusTone;
  title: string;
  subtitle?: string | null;
  why: string;
  context?: string | null;
  metaLine?: string | null;
  nextAction: string;
  actions: ReactNode;
}) {
  return (
    <CardV2 padding="none" className="overflow-hidden">
      <div className="flex">
        <div className="w-1 shrink-0" style={{ background: RAIL_VAR[accentTone] }} aria-hidden />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-sans text-[15px] font-bold text-ink">{title}</h3>
              {subtitle ? (
                <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{subtitle}</p>
              ) : null}
            </div>
            <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          </div>

          <p className="mt-2 text-[13px] leading-snug text-ink">{why}</p>

          {(context || metaLine) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
              {context ? <span className="truncate">{context}</span> : null}
              {context && metaLine ? <span aria-hidden>·</span> : null}
              {metaLine ? <span className="truncate">{metaLine}</span> : null}
            </div>
          )}

          <div className="mt-3 rounded-[8px] bg-surface-soft px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              Next step
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-ink">{nextAction}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
    </CardV2>
  );
}

/** Lane container that swaps to a teaching empty-state when there are no cards. */
export function LaneCards({
  cards,
  emptyTitle,
  emptyBody,
}: {
  cards: ReactNode[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (cards.length === 0) return <LaneEmpty title={emptyTitle} body={emptyBody} />;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards}</div>;
}

const FULL_PAGE_FALLBACK: Partial<Record<Entity360Type, (id: string) => string>> = {
  person: (id) => `/people/${id}`,
  class: (id) => `/admin/classes/${id}`,
  partner: (id) => `/admin/partners/${id}`,
};

/** Opens the universal Entity 360 drawer, falling back to the full page. */
export function Open360Button({
  type,
  id,
  label,
  variant = "ghost",
  size = "sm",
}: {
  type: Entity360Type;
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const api = useEntity360();
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        if (api) api.openEntity(type, id);
        else {
          const href = FULL_PAGE_FALLBACK[type]?.(id);
          if (href) router.push(href);
        }
      }}
    >
      {label}
    </Button>
  );
}
