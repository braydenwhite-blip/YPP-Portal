import Link from "next/link";

import type { ClassCommandCenter, ClassCommandRow } from "@/lib/classes/command-center";
import type { ClassSignalTone } from "@/lib/class-next-action";
import type { NeedsActionItem } from "@/lib/class-next-action";
import { cn, EmptyStateV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { EntityLink } from "@/components/operations/entity-link";

/**
 * The Classes command center — a calm operating surface, not a database.
 *
 * Three altitudes, top to bottom: factual "This term" counts, the short
 * "Needs action" queue (the system telling leadership what to do next), and a
 * readable class list where every row carries one primary action. Tapping a
 * class title opens the Class 360 drawer in place; tapping the action button
 * jumps straight to the fix.
 */

const TONE: Record<ClassSignalTone, StatusTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  neutral: "neutral",
  success: "success",
};

const DOT_BY_TONE: Record<StatusTone, string> = {
  success: "bg-success-500",
  danger: "bg-danger-500",
  warning: "bg-warning-500",
  info: "bg-info-500",
  brand: "bg-brand-600",
  neutral: "bg-brand-200",
};

export function ClassCommandCenter({ data }: { data: ClassCommandCenter }) {
  return (
    <div className="flex flex-col gap-5">
      <ThisTermStrip counts={data.counts} />
      <NeedsActionSection items={data.needsAction} />
      <ClassList rows={data.rows} />
    </div>
  );
}

// --- "This term" strip --------------------------------------------------------------

function ThisTermStrip({ counts }: { counts: ClassCommandCenter["counts"] }) {
  const tiles: Array<{ label: string; value: number; tone?: ClassSignalTone }> = [
    { label: "Active", value: counts.active },
    { label: "Upcoming", value: counts.upcoming },
    { label: "Need instructor", value: counts.missingInstructor, tone: "danger" },
    { label: "Need schedule", value: counts.missingSchedule, tone: "danger" },
    { label: "Open actions", value: counts.openActions, tone: "warning" },
    { label: "With partners", value: counts.partnerConnected },
    { label: "Recently done", value: counts.recentlyCompleted },
  ];
  return (
    <section aria-label="This term">
      <h2 className="m-0 mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        This term
      </h2>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((tile) => {
          const lit = tile.value > 0 && tile.tone;
          return (
            <div
              key={tile.label}
              className={cn(
                "rounded-[10px] border px-2.5 py-2",
                lit
                  ? tile.tone === "danger"
                    ? "border-danger-200 bg-danger-50"
                    : "border-warning-200 bg-warning-50"
                  : "border-line-soft bg-surface-soft"
              )}
            >
              <div
                className={cn(
                  "text-[18px] font-bold leading-none tabular-nums",
                  lit
                    ? tile.tone === "danger"
                      ? "text-danger-700"
                      : "text-warning-700"
                    : tile.value > 0
                      ? "text-ink"
                      : "text-ink-muted/60"
                )}
              >
                {tile.value}
              </div>
              <div className="mt-1 text-[11px] font-medium leading-tight text-ink-muted">
                {tile.label}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- "Needs action" section ---------------------------------------------------------

function NeedsActionSection({ items }: { items: NeedsActionItem[] }) {
  if (items.length === 0) {
    return (
      <section
        aria-label="Needs action"
        className="rounded-[12px] border border-success-200 bg-success-50/60 px-4 py-3"
      >
        <p className="m-0 text-[13px] font-semibold text-success-700">
          Nothing needs attention
        </p>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          Every running class has an instructor, a schedule, a roster, and no overdue actions.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Needs action" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h2 className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          Needs action
        </h2>
        <span className="rounded-full bg-danger-100 px-2 py-0.5 text-[11px] font-bold text-danger-700">
          {items.length}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {items.map((item) => {
          const tone = TONE[item.action.tone];
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-[12px] border border-line-soft bg-surface px-3.5 py-3"
            >
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT_BY_TONE[tone])} />
              <div className="min-w-0 flex-1">
                <EntityLink
                  type="class"
                  id={item.id}
                  className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-ink hover:text-brand-800"
                >
                  {item.title}
                </EntityLink>
                <p className="m-0 mt-0.5 truncate text-[12.5px] text-ink-muted">
                  {item.reason}
                  {item.context ? <span className="text-ink-muted/70"> · {item.context}</span> : null}
                </p>
              </div>
              <ActionButton href={item.href} label={item.action.label} tone={tone} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- class list ---------------------------------------------------------------------

function ClassList({ rows }: { rows: ClassCommandRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyStateV2
        tone="neutral"
        title="No live classes"
        body="Published and in-progress classes will show up here."
      />
    );
  }
  return (
    <section aria-label="Classes" className="flex flex-col gap-2">
      <h2 className="m-0 px-1 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        All classes
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.map((row) => (
          <li key={row.id}>
            <ClassRow row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClassRow({ row }: { row: ClassCommandRow }) {
  const statusTone = TONE[row.statusLabel.tone];
  const meta = [row.programLabel, row.instructorLabel, row.scheduleLabel, row.studentsLabel]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="group flex items-center gap-3 rounded-[12px] border border-transparent bg-surface px-3.5 py-3 transition-all duration-200 hover:border-line-soft hover:bg-surface-soft hover:shadow-card">
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", DOT_BY_TONE[statusTone])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <EntityLink
            type="class"
            id={row.id}
            className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink group-hover:text-brand-800"
          >
            {row.title}
          </EntityLink>
          <StatusBadge tone={statusTone} className="hidden sm:inline-flex">
            {row.statusLabel.label}
          </StatusBadge>
        </div>
        <p className="m-0 mt-0.5 truncate text-[12.5px] text-ink-muted">{meta}</p>
      </div>
      <ActionButton href={row.href} label={row.nextAction.label} tone={statusTone} />
    </div>
  );
}

// --- shared action button -----------------------------------------------------------

function ActionButton({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: StatusTone;
}) {
  const urgent = tone === "danger" || tone === "warning";
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold no-underline transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
        urgent
          ? "bg-brand-600 text-white hover:bg-brand-700"
          : "bg-brand-50 text-brand-700 hover:bg-brand-100"
      )}
    >
      {label}
    </Link>
  );
}
