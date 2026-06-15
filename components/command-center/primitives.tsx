import Link from "next/link";
import type { ReactNode } from "react";

import { cn, EmptyStateV2, StatusBadge } from "@/components/ui-v2";
import {
  type CcChange,
  dueLabel,
  initialsFromName,
  operationalState,
  type OperationalTone,
} from "@/lib/command-center/shared";
import type { QueueItem } from "@/lib/queue/types";

import { CcIcon, type CcIconName } from "./icons";

/**
 * Shared, calm building blocks for the Command Center operating surfaces. Glassy
 * but not gimmicky: soft brand-tinted surfaces, clear hierarchy, few objects.
 * Everything composes Queue Engine view-models — no record walls.
 */

// --- tone palettes ----------------------------------------------------------

const TILE_TONE: Record<OperationalTone, { wrap: string; chip: string; value: string }> = {
  brand: { wrap: "border-brand-200/60 bg-brand-50/60", chip: "bg-brand-100 text-brand-700", value: "text-brand-700" },
  danger: { wrap: "border-danger-700/20 bg-danger-100/40", chip: "bg-danger-100 text-danger-700", value: "text-danger-700" },
  warning: { wrap: "border-warning-700/20 bg-warning-100/40", chip: "bg-warning-100 text-warning-700", value: "text-warning-700" },
  info: { wrap: "border-info-700/20 bg-info-100/40", chip: "bg-info-100 text-info-700", value: "text-info-700" },
  success: { wrap: "border-success-700/20 bg-success-100/40", chip: "bg-success-100 text-success-700", value: "text-success-700" },
  neutral: { wrap: "border-line-soft bg-surface/70", chip: "bg-brand-50 text-brand-700", value: "text-ink" },
};

// --- avatar -----------------------------------------------------------------

export function Avatar({
  name,
  size = "md",
  tone = "brand",
}: {
  name: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "brand" | "neutral";
}) {
  const sizeClass =
    size === "lg" ? "size-9 text-[13px]" : size === "sm" ? "size-6 text-[10px]" : "size-7 text-[11px]";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-line-soft text-ink-muted",
        sizeClass
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}

// --- header stat chip -------------------------------------------------------

export function StatChip({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: OperationalTone;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface/80 px-3 py-1 text-[12.5px] shadow-card backdrop-blur">
      <span className={cn("text-[14px] font-bold", TILE_TONE[tone].value)}>{value}</span>
      <span className="text-ink-muted">{label}</span>
    </span>
  );
}

// --- summary metric tile ----------------------------------------------------

export function SummaryTile({
  icon,
  value,
  label,
  tone = "neutral",
  active = false,
  href,
}: {
  icon: CcIconName;
  value: number | string;
  label: string;
  tone?: OperationalTone;
  active?: boolean;
  href?: string;
}) {
  const palette = TILE_TONE[tone];
  const body = (
    <>
      <span className={cn("flex size-8 items-center justify-center rounded-[10px]", palette.chip)}>
        <CcIcon name={icon} size={17} />
      </span>
      <span className="flex flex-col">
        <span className={cn("text-[22px] font-bold leading-none", palette.value)}>{value}</span>
        <span className="mt-1 text-[12.5px] font-medium text-ink-muted">{label}</span>
      </span>
    </>
  );
  const className = cn(
    "flex items-center gap-3 rounded-[14px] border px-4 py-3 shadow-card backdrop-blur transition-all duration-200",
    palette.wrap,
    active && "ring-2 ring-brand-400/50",
    href && "hover:-translate-y-0.5 hover:shadow-overlay motion-reduce:hover:translate-y-0"
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export function SummaryTileRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5", className)}>
      {children}
    </div>
  );
}

// --- mission / brief card ---------------------------------------------------

export function MissionBriefCard({
  icon = "target",
  eyebrow,
  headline,
  sub,
  action,
  tone = "brand",
}: {
  icon?: CcIconName;
  eyebrow: string;
  headline: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  tone?: "brand" | "neutral";
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/70 via-surface to-surface/90 p-5 shadow-card backdrop-blur sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-[16px]",
          tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-line-soft text-ink-muted"
        )}
      >
        <CcIcon name={icon} size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-700">{eyebrow}</p>
        <p className="m-0 text-[19px] font-bold leading-snug tracking-[-0.01em] text-ink sm:text-[21px]">
          {headline}
        </p>
        {sub ? <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{sub}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </section>
  );
}

// --- panel card -------------------------------------------------------------

export function PanelCard({
  icon,
  title,
  action,
  children,
  className,
  padded = true,
}: {
  icon?: CcIconName;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-[16px] border border-line-soft bg-surface/80 shadow-card backdrop-blur",
        className
      )}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 px-4 pt-4">
          <h3 className="m-0 flex items-center gap-2 text-[15px] font-bold text-ink">
            {icon ? (
              <span className="flex size-7 items-center justify-center rounded-[9px] bg-brand-50 text-brand-700">
                <CcIcon name={icon} size={16} />
              </span>
            ) : null}
            {title}
          </h3>
          {action ? <div className="shrink-0 text-[12.5px] font-semibold text-brand-700">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn(padded ? "p-4" : "")}>{children}</div>
    </section>
  );
}

// --- operational item row ---------------------------------------------------

export function OperationalBadge({ item }: { item: QueueItem }) {
  const state = operationalState(item);
  return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>;
}

function itemSubtitle(item: QueueItem): string {
  const owner = item.ownerName ? item.ownerName : "No owner";
  const related = item.relatedInitiative?.title ?? item.relatedMeeting?.title ?? item.relatedPerson?.label ?? null;
  return related ? `${owner} · ${related}` : `${owner} · ${item.typeLabel}`;
}

export function ItemRow({
  item,
  now,
  showAvatar = true,
  trailing,
}: {
  item: QueueItem;
  now: Date;
  showAvatar?: boolean;
  trailing?: ReactNode;
}) {
  const due = dueLabel(item.dueISO, now);
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 rounded-[12px] border border-transparent px-3 py-2.5 transition-colors hover:border-line-soft hover:bg-surface-soft"
    >
      {showAvatar ? <Avatar name={item.ownerName} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink">{item.title}</span>
        <span className="block truncate text-[12px] text-ink-muted">{itemSubtitle(item)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {trailing ?? <OperationalBadge item={item} />}
        {due ? <span className="text-[11px] text-ink-muted">{due}</span> : null}
      </span>
    </Link>
  );
}

// --- titled lane list -------------------------------------------------------

export function LaneList({
  items,
  now,
  emptyHint,
  max,
}: {
  items: QueueItem[];
  now: Date;
  emptyHint?: string;
  max?: number;
}) {
  const shown = typeof max === "number" ? items.slice(0, max) : items;
  if (shown.length === 0) {
    return <EmptyHint>{emptyHint ?? "Nothing here right now."}</EmptyHint>;
  }
  return (
    <div className="flex flex-col gap-1">
      {shown.map((item) => (
        <ItemRow key={item.id} item={item} now={now} />
      ))}
    </div>
  );
}

// --- empty hint -------------------------------------------------------------

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-[12px] border border-dashed border-line-soft bg-surface-soft/60 px-4 py-5 text-center text-[13px] text-ink-muted">
      {children}
    </p>
  );
}

// --- waiting-on panel (reused on Today / Decide / Delegate) -----------------

export function WaitingOnRows({ items, now, max = 3 }: { items: QueueItem[]; now: Date; max?: number }) {
  if (items.length === 0) {
    return <EmptyHint>No one is blocking active work. Momentum is clear.</EmptyHint>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {items.slice(0, max).map((item) => {
        const person = item.relatedPerson?.label ?? item.ownerName ?? "Unassigned";
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-surface-soft"
            >
              <Avatar name={person} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{person}</span>
                <span className="block truncate text-[12px] text-ink-muted">{item.title}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-warning-700">
                {item.ageLabel ?? "Waiting"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// --- recent changes timeline ------------------------------------------------

const CHANGE_TONE: Record<OperationalTone, string> = {
  brand: "bg-brand-100 text-brand-700",
  danger: "bg-danger-100 text-danger-700",
  warning: "bg-warning-100 text-warning-700",
  info: "bg-info-100 text-info-700",
  success: "bg-success-100 text-success-700",
  neutral: "bg-brand-50 text-brand-700",
};

export function ChangeRow({ change }: { change: CcChange }) {
  const inner = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[9px]",
          CHANGE_TONE[change.tone]
        )}
      >
        <CcIcon name={change.icon as CcIconName} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug text-ink">{change.title}</span>
        <span className="block text-[11.5px] text-ink-muted">
          {[change.detail, change.whenLabel].filter(Boolean).join(" · ")}
        </span>
      </span>
    </>
  );
  if (change.href) {
    return (
      <Link href={change.href} className="flex items-start gap-2.5 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-surface-soft">
        {inner}
      </Link>
    );
  }
  return <div className="flex items-start gap-2.5 px-1.5 py-1.5">{inner}</div>;
}

export function ChangeList({ changes, emptyHint }: { changes: CcChange[]; emptyHint?: string }) {
  if (changes.length === 0) {
    return <EmptyHint>{emptyHint ?? "No recent changes to review."}</EmptyHint>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {changes.map((change) => (
        <ChangeRow key={change.id} change={change} />
      ))}
    </div>
  );
}

// --- view-all link ----------------------------------------------------------

export function ViewAllLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline">
      {children}
      <CcIcon name="arrowRight" size={13} />
    </Link>
  );
}
