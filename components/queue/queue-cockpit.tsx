"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ButtonLink, cn } from "@/components/ui-v2";
import type {
  QueueDeferReason,
  QueueDescriptor,
  QueueItem,
  QueueKey,
  QueueResolution,
  QueueTone,
} from "@/lib/queue/types";

import { ArrowRightIcon, CalendarIcon, typeGlyph } from "./icons";
import { QueueCard } from "./queue-card";
import { QueueDrawer } from "./queue-drawer";

/**
 * QueueCockpit — the Mission Control operating surface (Queue Engine §1). A
 * three-pane cockpit: the active queue's loops (grouped Now / Later) on the
 * left, the focused loop in the center with its recommended move + Resolve /
 * Delegate / Discuss / Defer dock, and connected context on the right. Switch
 * lanes across the top. It leads with the next move — never a table.
 */

export type CockpitLane = {
  key: QueueKey;
  descriptor: QueueDescriptor;
  items: QueueItem[];
};

const TONE_DOT: Record<QueueTone, string> = {
  danger: "bg-danger-700",
  warning: "bg-warning-700",
  info: "bg-info-700",
  brand: "bg-brand-600",
  success: "bg-success-700",
  neutral: "bg-line",
};

function isNow(item: QueueItem, now: Date): boolean {
  if (item.signals.overdue || item.signals.blocking) return true;
  if (item.severity === "critical" || item.severity === "high") return true;
  if (item.dueISO) {
    const due = new Date(item.dueISO).getTime();
    if (!Number.isNaN(due) && due <= now.getTime() + 3 * 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

function QueueListRow({
  item,
  active,
  onSelect,
}: {
  item: QueueItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[10px] border-l-2 px-3 py-2.5 text-left transition-colors",
        active
          ? "border-l-brand-600 bg-brand-50"
          : "border-l-transparent hover:border-l-line hover:bg-surface-soft"
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[item.tone])}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-[13.5px] font-semibold", active ? "text-brand-800" : "text-ink")}>
          {item.title}
        </span>
        <span className="truncate text-[11.5px] text-ink-muted">
          {item.relatedInitiative?.title ?? item.relatedMeeting?.title ?? item.typeLabel} · {item.statusLabel}
        </span>
      </span>
      <ArrowRightIcon
        className={cn(
          "size-4 shrink-0 text-brand-600 transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
        )}
      />
    </button>
  );
}

function ContextRail({ item, queueKey }: { item: QueueItem; queueKey: QueueKey }) {
  return (
    <aside className="flex flex-col gap-3" aria-label="Connected context">
      {item.relatedMeeting ? (
        <section className="rounded-[12px] border border-line-soft bg-surface p-4 shadow-card">
          <p className="m-0 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            <CalendarIcon className="size-4" /> Related meeting
          </p>
          <Link
            href={`/actions/meetings/${item.relatedMeeting.id}`}
            className="mt-1.5 block text-[14px] font-bold text-brand-700 hover:underline"
          >
            {item.relatedMeeting.title}
          </Link>
        </section>
      ) : null}

      <section className="rounded-[12px] border border-line-soft bg-surface p-4 shadow-card">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          Owner &amp; accountability
        </p>
        <p className="m-0 mt-1.5 text-[14px] font-bold text-ink">
          {item.ownerName ?? "Needs an owner"}
        </p>
        <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{item.statusLabel}</p>
      </section>

      <section className="rounded-[12px] border border-line-soft bg-surface p-4 shadow-card">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          Why it&apos;s here
        </p>
        <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-ink">{item.why}</p>
        {item.ageLabel ? (
          <p className="m-0 mt-2 text-[11.5px] font-semibold text-ink-muted">{item.ageLabel}</p>
        ) : null}
      </section>

      <ButtonLink
        href={`/work/queue?queue=${queueKey}`}
        variant="secondary"
        size="sm"
        className="justify-center"
      >
        Run this queue one-by-one →
      </ButtonLink>
    </aside>
  );
}

export function QueueCockpit({
  lanes,
  defaultKey,
  now: nowISO,
}: {
  lanes: CockpitLane[];
  defaultKey?: QueueKey;
  /** ISO timestamp from the server, so Now/Later is deterministic on hydrate. */
  now: string;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowISO), [nowISO]);

  const nonEmpty = lanes.filter((l) => l.items.length > 0);
  const initialKey =
    defaultKey && lanes.some((l) => l.key === defaultKey)
      ? defaultKey
      : (nonEmpty[0]?.key ?? lanes[0]?.key);

  const [activeKey, setActiveKey] = useState<QueueKey>(initialKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deferred, setDeferred] = useState<Set<string>>(new Set());
  const [drawerItem, setDrawerItem] = useState<QueueItem | null>(null);

  const activeLane = lanes.find((l) => l.key === activeKey) ?? lanes[0];
  const visibleItems = activeLane.items.filter((i) => !deferred.has(i.id));

  const selected =
    visibleItems.find((i) => i.id === selectedId) ?? visibleItems[0] ?? null;

  const nowItems = visibleItems.filter((i) => isNow(i, now));
  const laterItems = visibleItems.filter((i) => !isNow(i, now));

  function handleAction(resolution: QueueResolution, item: QueueItem, reason?: QueueDeferReason) {
    if (resolution === "defer") {
      setDeferred((prev) => new Set(prev).add(item.id));
      setSelectedId(null);
      setDrawerItem(null);
      void reason;
      return;
    }
    const action =
      item.primaryAction.resolution === resolution
        ? item.primaryAction
        : item.secondaryActions.find((a) => a.resolution === resolution);
    if (action) router.push(action.href);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lane switcher */}
      <div
        role="tablist"
        aria-label="Queues"
        className="flex flex-wrap gap-1.5 rounded-[12px] border border-line-soft bg-surface p-1.5 shadow-card"
      >
        {lanes.map((lane) => {
          const count = lane.items.filter((i) => !deferred.has(i.id)).length;
          const active = lane.key === activeKey;
          return (
            <button
              key={lane.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveKey(lane.key);
                setSelectedId(null);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                active ? "bg-brand-600 text-white shadow-card" : "text-ink-muted hover:bg-brand-50 hover:text-ink"
              )}
            >
              {lane.descriptor.label}
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                  active ? "bg-white/20 text-white" : "bg-brand-50 text-brand-700"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(240px,300px)]">
          {/* Item list */}
          <div className="flex flex-col rounded-[14px] border border-line-soft bg-surface p-3 shadow-card lg:max-h-[640px] lg:overflow-y-auto">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="m-0 text-[13px] font-bold text-ink">Your queue</p>
              <span className="text-[11.5px] text-ink-muted">{visibleItems.length} open</span>
            </div>
            {nowItems.length > 0 ? (
              <div className="mb-1">
                <p className="m-0 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
                  <span className="size-1.5 rounded-full bg-brand-600" aria-hidden /> Now · {nowItems.length}
                </p>
                <div className="flex flex-col">
                  {nowItems.map((item) => (
                    <QueueListRow
                      key={item.id}
                      item={item}
                      active={selected.id === item.id}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {laterItems.length > 0 ? (
              <div>
                <p className="m-0 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  <span className="size-1.5 rounded-full bg-line" aria-hidden /> Later · {laterItems.length}
                </p>
                <div className="flex flex-col">
                  {laterItems.map((item) => (
                    <QueueListRow
                      key={item.id}
                      item={item}
                      active={selected.id === item.id}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Focused card */}
          <QueueCard
            key={selected.id}
            item={selected}
            featured
            onAction={handleAction}
            onOpenDrawer={setDrawerItem}
          />

          {/* Context rail */}
          <div className="hidden xl:block">
            <ContextRail item={selected} queueKey={activeKey} />
          </div>
        </div>
      ) : (
        <div className="rounded-[14px] border border-dashed border-line bg-surface-soft px-6 py-12 text-center">
          <p className="m-0 text-[15px] font-bold text-ink">
            {activeLane.descriptor.label} is clear
          </p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">{activeLane.descriptor.tagline}</p>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-ink-muted">
            <span aria-hidden>{typeGlyph("action")}</span> Pick another queue above.
          </div>
        </div>
      )}

      <QueueDrawer item={drawerItem} onClose={() => setDrawerItem(null)} onAction={handleAction} />
    </div>
  );
}
