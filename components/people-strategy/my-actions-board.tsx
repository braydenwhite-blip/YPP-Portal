import Link from "next/link";

import { StatCardV2, StatusBadge, type StatCardAccent, type StatusTone } from "@/components/ui-v2";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  effectiveDeadline,
  isActionOverdue,
  selectExecuting,
  selectNeedsInput,
  selectUpcoming,
  summarizeMyActions,
} from "@/lib/people-strategy/my-actions-selectors";

/**
 * My Actions — the personal "what to do now" hero, built to the YPP Portal
 * redesign mockup. Composes ui-v2 primitives (StatCardV2, StatusBadge) and the
 * shared `my-actions-selectors`, so the counts and lanes match the rest of the
 * tracker and there is no one-off query logic to drift. Pure render over the
 * already-loaded, access-filtered `items`.
 */

// Lane accent palette — small, named, mockup-faithful (mirrors the StatCardV2
// ACCENT pattern). Structure/typography use the shared @theme tokens.
const RAIL: Record<string, string> = {
  OVERDUE: "#e5484d",
  BLOCKED: "#e5484d",
  IN_PROGRESS: "#6b21c8",
  NOT_STARTED: "#c9c9d6",
  COMPLETE: "#0e9f6e",
  DROPPED: "#c9c9d6",
};

const STATUS_TONE: Record<string, StatusTone> = {
  OVERDUE: "danger",
  BLOCKED: "danger",
  IN_PROGRESS: "info",
  NOT_STARTED: "neutral",
  COMPLETE: "success",
  DROPPED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  COMPLETE: "Done",
  DROPPED: "Dropped",
};

const AVATAR_COLORS = ["#6b21c8", "#0e9f6e", "#d9a300", "#2563eb", "#db2777", "#0891b2"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function InitialsAvatar({ name, size = 21 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: avatarColor(name) }}
    >
      {initialsOf(name)}
    </span>
  );
}

function dueLabel(item: ActionItemWithRelations, now: Date): { label: string; danger: boolean } {
  if (isActionOverdue(item, now)) return { label: "Overdue", danger: true };
  return { label: formatMonthDay(effectiveDeadline(item)), danger: false };
}

function isExecutingByMe(item: ActionItemWithRelations, userId: string): boolean {
  return item.assignments.some((a) => a.role === "EXECUTING" && a.user.id === userId);
}

// --- lane shell -------------------------------------------------------------

function Lane({
  dot,
  title,
  count,
  tinted,
  children,
}: {
  dot: string;
  title: string;
  count?: string;
  /** Amber "waiting on your input" treatment. */
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-[14px] border bg-surface shadow-card"
      style={tinted ? { borderColor: "#f0e6c8" } : { borderColor: "var(--color-line-card)" }}
    >
      <div
        className="flex items-center gap-2.5 border-b px-[18px] py-3.5"
        style={
          tinted
            ? { background: "#fdf8ec", borderColor: "#f3ecd4" }
            : { borderColor: "#f1f1f6" }
        }
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
        <h3
          className="m-0 text-[12.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: tinted ? "#7a5d00" : "#3a3a52" }}
        >
          {title}
        </h3>
        {count ? (
          <span className="ml-auto text-[12px]" style={{ color: tinted ? "#b09640" : "#9a9ab0" }}>
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// --- one action card --------------------------------------------------------

function ActionCard({
  item,
  userId,
  now,
  showExecutors = false,
}: {
  item: ActionItemWithRelations;
  userId: string;
  now: Date;
  /** Delegated lane: show the executor avatars instead of the single owner. */
  showExecutors?: boolean;
}) {
  const status = effectiveStatus(item, now);
  const due = dueLabel(item, now);
  const rail = RAIL[status] ?? "#c9c9d6";
  const lead = item.lead;
  const executors = item.assignments.filter((a) => a.role === "EXECUTING").map((a) => a.user);

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "#f4f4f8", borderLeft: `3px solid ${rail}` }}>
      <Link href={`/actions/${item.id}`} className="block px-[18px] pb-3 pt-3.5 no-underline">
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <p className="m-0 text-[14px] font-semibold leading-snug text-ink">{item.title}</p>
          <span
            className="shrink-0 whitespace-nowrap text-[12.5px] font-semibold"
            style={{ color: due.danger ? "#e5484d" : "#9a9ab0" }}
          >
            {due.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={STATUS_TONE[status] ?? "neutral"}>
            {STATUS_LABEL[status] ?? status}
          </StatusBadge>

          {item.officerMeeting ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
              <span className="size-1.5 rounded-full bg-brand-600" />
              {item.officerMeeting.title}
            </span>
          ) : null}

          <span className="ml-auto flex items-center gap-3">
            {showExecutors && executors.length > 0 ? (
              <span className="flex items-center">
                <span className="mr-1.5 text-[12px] text-ink-muted">Executing</span>
                <span className="flex">
                  {executors.slice(0, 3).map((u) => (
                    <span key={u.id} className="-ml-1 rounded-full ring-2 ring-white first:ml-0">
                      <InitialsAvatar name={u.name ?? u.email ?? "?"} />
                    </span>
                  ))}
                </span>
              </span>
            ) : lead ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] text-ink-muted">Owner</span>
                <InitialsAvatar name={lead.name ?? lead.email ?? "?"} />
                <span className="text-[12.5px] font-semibold text-ink-muted">
                  {lead.name ?? lead.email}
                </span>
              </span>
            ) : null}
            <span className="flex items-center gap-1 text-[12px] text-ink-muted">
              💬 {item.comments.length}
            </span>
          </span>
        </div>

        {item.description ? (
          <p className="m-0 mt-2 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">
            <span className="font-bold text-[#5c5c74]">Next:</span> {item.description}
          </p>
        ) : null}
      </Link>

      {item.officerMeeting ? (
        <Link
          href={`/actions/meetings/${item.officerMeeting.id}`}
          className="mx-[18px] mb-3 flex items-center gap-2 rounded-[9px] border px-2.5 py-2 no-underline"
          style={{ background: "#f3ecff", borderColor: "#e4d8f7" }}
        >
          <span className="flex size-5 items-center justify-center rounded-md bg-brand-600 text-[10px] text-white">
            ⬡
          </span>
          <span className="text-[11.5px] font-bold text-brand-700">
            On the agenda · {item.officerMeeting.title}
          </span>
          <span className="ml-auto whitespace-nowrap text-[11.5px] font-semibold text-brand-700">
            Open meeting →
          </span>
        </Link>
      ) : null}
    </div>
  );
}

function EmptyLane({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-[18px] py-6 text-center">
      <p className="m-0 text-[13px] font-semibold text-ink">{title}</p>
      <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{hint}</p>
    </div>
  );
}

// --- the board --------------------------------------------------------------

export function MyActionsBoard({
  items,
  userId,
  now,
  userName,
  userTitle,
}: {
  items: ActionItemWithRelations[];
  userId: string;
  now: Date;
  userName: string;
  userTitle: string;
}) {
  const summary = summarizeMyActions(items, userId, now);
  const isOpen = (i: ActionItemWithRelations) => i.status !== "COMPLETE" && i.status !== "DROPPED";

  const executing = selectExecuting(items, userId).filter(isOpen);
  const delegated = items
    .filter((i) => i.leadId === userId && !isExecutingByMe(i, userId) && isOpen(i))
    .sort((a, b) => effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime());
  const needsInput = selectNeedsInput(items, userId).filter(isOpen);
  const completed = items
    .filter((i) => i.status === "COMPLETE")
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, 3);
  const deadlines = selectUpcoming(items).slice(0, 6);

  const execOnAgenda = executing.filter((i) => i.officerMeeting).length;
  const nextItem = deadlines[0];

  const cards: Array<{
    label: string;
    value: string | number;
    detail: string;
    accent: StatCardAccent;
    href: string;
  }> = [
    {
      label: "Overdue",
      value: summary.overdue,
      detail: summary.overdue ? "Needs immediate attention" : "All clear",
      accent: "danger",
      href: "/work/queue?queue=my",
    },
    {
      label: "In progress",
      value: summary.inProgress,
      detail: summary.inProgress ? "Underway" : "None active",
      accent: "warning",
      href: "/actions?who=me",
    },
    {
      label: "Executing",
      value: summary.executing,
      detail: "You are doing the work",
      accent: "brand",
      href: "/actions?who=me",
    },
    {
      label: "Needs your input",
      value: summary.needsInput,
      detail: summary.needsInput ? "Awaiting your feedback" : "Nothing waiting",
      accent: "teal",
      href: "/actions?who=me",
    },
    {
      label: "Next deadline",
      value: summary.nextDeadline ? formatMonthDay(summary.nextDeadline) : "—",
      detail: nextItem ? nextItem.title : "Nothing scheduled",
      accent: summary.nextDeadline && summary.overdue ? "danger" : "neutral",
      href: nextItem ? `/actions/${nextItem.id}` : "/actions?who=me",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-10">
      {/* heading */}
      <p className="m-0 mb-1 text-[12px] text-ink-muted">
        {userName} · {userTitle}
      </p>
      <div className="mb-1.5 flex items-end justify-between gap-4">
        <h1 className="m-0 font-sans text-[25px] font-extrabold tracking-[-0.02em] text-ink">
          My Actions
        </h1>
        <span className="text-[12px] text-ink-muted">
          Last updated <strong className="text-[#6b6b85]">{formatMonthDay(now)}</strong>
        </span>
      </div>
      <p className="m-0 mb-[18px] max-w-2xl text-[13.5px] text-ink-muted">
        Everything assigned to you — what to do now, what you&apos;ve delegated, and what&apos;s
        waiting on you.
      </p>

      {/* stat-filter cards */}
      <div className="mb-[22px] grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <StatCardV2
            key={c.label}
            label={c.label}
            value={c.value}
            detail={c.detail}
            accent={c.accent}
            href={c.href}
          />
        ))}
      </div>

      {/* two-column board */}
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT */}
        <div className="flex flex-col gap-[18px]">
          <Lane dot="#0e9f6e" title="You are executing" count={`${executing.length} items`}>
            {execOnAgenda > 0 ? (
              <div className="px-[18px] pt-3">
                <Link
                  href="/actions/meetings"
                  className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 no-underline"
                  style={{ background: "#f3ecff", borderColor: "#e4d8f7" }}
                >
                  <span className="flex size-6 items-center justify-center rounded-[7px] bg-brand-600 text-[12px] text-white">
                    ⬡
                  </span>
                  <span className="text-[12.5px] leading-snug text-[#3a3a52]">
                    <strong className="font-bold text-brand-700">{execOnAgenda} of these</strong> are
                    on the next officer meeting agenda
                  </span>
                  <span className="ml-auto whitespace-nowrap text-[12px] font-bold text-brand-700">
                    Officer Meetings →
                  </span>
                </Link>
              </div>
            ) : null}
            {executing.length > 0 ? (
              executing.map((item) => (
                <ActionCard key={item.id} item={item} userId={userId} now={now} />
              ))
            ) : (
              <EmptyLane
                title="Nothing to execute right now"
                hint="You're all caught up on work you personally deliver."
              />
            )}
          </Lane>

          <Lane dot="#6b21c8" title="You own — delegated to others" count={`${delegated.length} items`}>
            {delegated.length > 0 ? (
              delegated.map((item) => (
                <ActionCard key={item.id} item={item} userId={userId} now={now} showExecutors />
              ))
            ) : (
              <EmptyLane
                title="Nothing delegated"
                hint="Items you own but assign to others appear here."
              />
            )}
          </Lane>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-[18px]">
          <Lane dot="#d9a300" title="Waiting on your input" count={`${needsInput.length} item`} tinted>
            {needsInput.length > 0 ? (
              needsInput.map((item) => (
                <div key={item.id} className="px-[18px] py-4">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <p className="m-0 text-[14px] font-semibold leading-snug text-ink">{item.title}</p>
                    <span className="shrink-0 text-[12.5px] font-semibold text-ink-muted">
                      {dueLabel(item, now).label}
                    </span>
                  </div>
                  <p className="m-0 mb-3 text-[12.5px] text-[#8a7320]">
                    {item.lead ? `${item.lead.name ?? item.lead.email} has requested your input.` : "Your input is requested."}
                  </p>
                  <Link
                    href={`/actions/${item.id}`}
                    className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] px-4 text-[12.5px] font-bold text-white no-underline"
                    style={{ background: "#d9a300" }}
                  >
                    Give input →
                  </Link>
                </div>
              ))
            ) : (
              <div className="px-[18px] py-4 text-[12.5px] leading-relaxed text-ink-muted">
                Nobody is waiting on your input right now. Requests from other leads show up here.
              </div>
            )}
          </Lane>

          {completed.length > 0 ? (
            <Lane dot="#0e9f6e" title="Recently completed">
              {completed.map((item) => (
                <Link
                  key={item.id}
                  href={`/actions/${item.id}`}
                  className="flex items-center gap-2.5 border-b px-[18px] py-3 no-underline last:border-b-0"
                  style={{ borderColor: "#f4f4f8" }}
                >
                  <span className="shrink-0 text-[#0e9f6e]">✓</span>
                  <span className="flex-1 text-[13px] font-semibold text-ink-muted">{item.title}</span>
                  {item.completedAt ? (
                    <span className="text-[11.5px] text-ink-muted">{formatMonthDay(item.completedAt)}</span>
                  ) : null}
                </Link>
              ))}
            </Lane>
          ) : null}

          <Lane dot="#6b21c8" title="Your upcoming deadlines">
            {deadlines.length > 0 ? (
              deadlines.map((item) => {
                const overdue = isActionOverdue(item, now);
                const d = effectiveDeadline(item);
                return (
                  <Link
                    key={item.id}
                    href={`/actions/${item.id}`}
                    className="flex items-center gap-3.5 border-b px-[18px] py-3 no-underline last:border-b-0"
                    style={{ borderColor: "#f4f4f8", background: overdue ? "#fdf3f2" : undefined }}
                  >
                    <span className="w-[34px] shrink-0 text-center">
                      <span
                        className="block text-[17px] font-bold leading-none"
                        style={{ color: overdue ? "#e5484d" : "#3a3a52" }}
                      >
                        {d.getDate()}
                      </span>
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                        {d.toLocaleString("en-US", { month: "short" })}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {item.title}
                      </span>
                      <span
                        className="block text-[11.5px]"
                        style={{ color: overdue ? "#e5484d" : "#9a9ab0" }}
                      >
                        {overdue ? "Overdue" : "Due"} · {STATUS_LABEL[effectiveStatus(item, now)] ?? ""}
                      </span>
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="px-[18px] py-4 text-[12.5px] text-ink-muted">No upcoming deadlines.</div>
            )}
          </Lane>
        </div>
      </div>
    </div>
  );
}
