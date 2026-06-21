import Link from "next/link";

import { ButtonLink } from "@/components/ui-v2";
import { addDays, startOfDay } from "@/lib/leadership-action-center/dates";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { effectiveDeadline, isActionOverdue, sortByDeadline } from "@/lib/people-strategy/my-actions-selectors";
import {
  ActionStatusBadge,
  InitialsAvatar,
  MeetingSourceChip,
  dueLabel,
} from "@/components/people-strategy/action-presentation";

/**
 * All Actions — the leadership operations tracker, built to the YPP Portal
 * redesign mockup. Operational lanes (owner gaps, overdue, blockers, due soon)
 * are derived from the loaded items and selected via `?lane=`, so the chips are
 * real navigation, not decoration. Pure render over `items` (already access-
 * filtered to what the officer may see).
 */

const DEPT_COLORS = ["#6b21c8", "#0e9f6e", "#d9a300", "#2563eb", "#db2777", "#0891b2", "#e5484d"];

function deptColor(name: string | null | undefined): string {
  const seed = name ?? "—";
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DEPT_COLORS[h % DEPT_COLORS.length];
}

function hasExecutor(item: ActionItemWithRelations): boolean {
  return item.assignments.some((a) => a.role === "EXECUTING");
}

type LaneKey =
  | "all"
  | "noowner"
  | "overdue"
  | "blocked"
  | "duesoon"
  | "inprogress"
  | "notstarted"
  | "done";

const LANE_META: Record<LaneKey, { label: string; dot: string; sub: string }> = {
  all: { label: "All open", dot: "#6b21c8", sub: "Every open item across the team." },
  noowner: { label: "No owner", dot: "#b45309", sub: "Open work with nobody executing — assign an owner." },
  overdue: { label: "Overdue", dot: "#e5484d", sub: "Past deadline and still open — handle first." },
  blocked: { label: "Blocked", dot: "#e5484d", sub: "Waiting on a dependency or decision." },
  duesoon: { label: "Due soon", dot: "#d9a300", sub: "Due within the next 7 days." },
  inprogress: { label: "In progress", dot: "#2563eb", sub: "Actively underway." },
  notstarted: { label: "Not started", dot: "#9a9ab0", sub: "Queued but not begun." },
  done: { label: "Done", dot: "#0e9f6e", sub: "Recently completed." },
};

const LANE_ORDER: LaneKey[] = [
  "all",
  "noowner",
  "overdue",
  "blocked",
  "duesoon",
  "inprogress",
  "notstarted",
  "done",
];

function laneFilter(items: ActionItemWithRelations[], lane: LaneKey, now: Date): ActionItemWithRelations[] {
  const open = (i: ActionItemWithRelations) => i.status !== "COMPLETE" && i.status !== "DROPPED";
  const weekEnd = startOfDay(addDays(now, 7)).getTime();
  switch (lane) {
    case "noowner":
      return items.filter((i) => open(i) && !hasExecutor(i));
    case "overdue":
      return items.filter((i) => isActionOverdue(i, now));
    case "blocked":
      return items.filter((i) => i.status === "BLOCKED");
    case "duesoon":
      return items.filter(
        (i) =>
          open(i) &&
          !isActionOverdue(i, now) &&
          startOfDay(effectiveDeadline(i)).getTime() <= weekEnd
      );
    case "inprogress":
      return items.filter((i) => i.status === "IN_PROGRESS");
    case "notstarted":
      return items.filter((i) => i.status === "NOT_STARTED");
    case "done":
      return items.filter((i) => i.status === "COMPLETE");
    case "all":
    default:
      return items.filter(open);
  }
}

function LaneRow({ item, now }: { item: ActionItemWithRelations; now: Date }) {
  const due = dueLabel(item, now);
  const rail = deptColor(item.department?.name);
  const ownerless = !hasExecutor(item) && item.status !== "COMPLETE";
  const blocked = item.status === "BLOCKED";

  return (
    <Link
      href={`/actions/${item.id}`}
      className="flex gap-3.5 rounded-[12px] border bg-surface p-4 no-underline shadow-card transition-colors hover:border-brand-300"
      style={{ borderColor: "var(--color-line-card)", borderLeft: `3px solid ${rail}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-start gap-3">
          <p className="m-0 flex-1 text-[14px] font-semibold leading-snug text-ink">{item.title}</p>
          <span
            className="shrink-0 whitespace-nowrap text-[12.5px] font-semibold"
            style={{ color: due.danger ? "#e5484d" : "#9a9ab0" }}
          >
            {due.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionStatusBadge item={item} now={now} />
          {item.department ? (
            <span className="rounded-md bg-[#f4f4f8] px-2 py-1 text-[11px] font-semibold text-[#8a8aa0]">
              {item.department.name}
            </span>
          ) : null}
          <MeetingSourceChip item={item} />
          <span className="ml-auto flex items-center gap-2.5">
            {ownerless ? (
              <span className="rounded-md bg-[#fdf2e3] px-2 py-1 text-[11.5px] font-bold text-[#b45309]">
                No owner
              </span>
            ) : item.lead ? (
              <span className="flex items-center gap-1.5">
                <InitialsAvatar name={item.lead.name ?? item.lead.email ?? "?"} size={20} />
                <span className="text-[12px] text-ink-muted">{item.lead.name ?? item.lead.email}</span>
              </span>
            ) : null}
            <span className="flex items-center gap-1 text-[12px] text-[#b4b4c6]">💬 {item.comments.length}</span>
          </span>
        </div>
        {blocked ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#fdecea] px-2.5 py-1.5">
            <span className="text-[11px]">⛔</span>
            <span className="text-[11.5px] font-semibold leading-snug text-[#b91c1c]">
              Blocked — {item.description ?? "needs a decision or dependency cleared."}
            </span>
          </div>
        ) : item.description ? (
          <p className="m-0 mt-1.5 line-clamp-1 text-[12px] leading-snug text-ink-muted">
            <span className="font-bold text-[#5c5c74]">Next:</span> {item.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function AllActionsBoard({
  items,
  now,
  activeLane,
  createHref,
}: {
  items: ActionItemWithRelations[];
  now: Date;
  /** Raw `?lane=` value; validated against the known lanes (falls back to "all"). */
  activeLane?: string;
  createHref: string;
}) {
  const counts = Object.fromEntries(
    LANE_ORDER.map((lane) => [lane, laneFilter(items, lane, now).length])
  ) as Record<LaneKey, number>;

  const lane: LaneKey = (LANE_ORDER as readonly string[]).includes(activeLane ?? "")
    ? (activeLane as LaneKey)
    : "all";
  const rows = sortByDeadline(laneFilter(items, lane, now));
  const meta = LANE_META[lane];

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-10">
      <div className="mb-1 flex items-end justify-between gap-4">
        <h1 className="m-0 font-sans text-[25px] font-extrabold tracking-[-0.02em] text-ink">All Actions</h1>
        <div className="flex gap-2">
          <ButtonLink href="/actions/all" variant="secondary" size="sm">
            ⤓ Export / full table
          </ButtonLink>
          <ButtonLink href={createHref} variant="primary" size="sm">
            ＋ New Action
          </ButtonLink>
        </div>
      </div>
      <p className="m-0 mb-4 text-[13.5px] text-ink-muted">
        The leadership operations tracker. Work the lanes below — owner gaps, overdue, and blockers
        first.
      </p>

      {/* operational lane chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {LANE_ORDER.map((key) => {
          const m = LANE_META[key];
          const active = key === lane;
          return (
            <Link
              key={key}
              href={`/actions?who=all&lane=${key}`}
              className="inline-flex h-9 items-center gap-2 rounded-[9px] border px-3.5 text-[13px] font-semibold no-underline transition-colors"
              style={{
                background: active ? "#f3ecff" : "#fff",
                borderColor: active ? "#e4d8f7" : "#e7e7ef",
                color: active ? "#5a1da8" : "#5c5c74",
              }}
            >
              <span className="size-[7px] rounded-full" style={{ background: m.dot }} />
              {m.label}
              <span
                className="min-w-[18px] rounded-full px-2 py-px text-center text-[11.5px] font-bold"
                style={{
                  background: active ? "#e4d8f7" : "#f4f4f8",
                  color: active ? "#5a1da8" : "#8a8aa0",
                }}
              >
                {counts[key]}
              </span>
            </Link>
          );
        })}
      </div>

      {/* active lane heading */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="size-[9px] rounded-full" style={{ background: meta.dot }} />
        <span className="text-[14px] font-bold text-ink">{meta.label}</span>
        <span className="text-[12.5px] text-ink-muted">{meta.sub}</span>
      </div>

      {/* rows */}
      {rows.length > 0 ? (
        <div className="flex flex-col gap-3">
          {rows.map((item) => (
            <LaneRow key={item.id} item={item} now={now} />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-dashed border-[#dcdce6] bg-surface p-9 text-center">
          <div className="mb-2 text-[26px]">✓</div>
          <p className="m-0 mb-1 text-[14.5px] font-bold text-ink">Nothing in this lane</p>
          <p className="m-0 mx-auto max-w-sm text-[12.5px] leading-relaxed text-ink-muted">
            {lane === "all"
              ? "No open actions across the team right now."
              : `No ${meta.label.toLowerCase()} items — nice work keeping this lane clear.`}
          </p>
        </div>
      )}
    </div>
  );
}
