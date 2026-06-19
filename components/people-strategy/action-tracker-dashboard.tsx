import Link from "next/link";
import type { ReactNode } from "react";

import type {
  ActionDepartmentOption,
  ActionItemWithRelations,
  ActionPickerUser,
} from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  attentionReason,
  buildActionOperatingBoard,
} from "@/lib/people-strategy/action-operating-board";
import { ActionPulseStrip } from "@/components/people-strategy/action-pulse-strip";
import { ActionQuickCreate } from "@/components/people-strategy/action-quick-create";
import { ActionRow } from "@/components/people-strategy/action-row";
import { EmptyStateV2, UrlSyncedSearchInput } from "@/components/ui-v2";

type UserOption = ActionPickerUser;

export function buildActionsHref(params: {
  who?: string;
  q?: string;
  initiative?: string;
  create?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params.who && params.who !== "me") qs.set("who", params.who);
  if (params.q) qs.set("q", params.q);
  if (params.initiative) qs.set("initiative", params.initiative);
  if (params.create) qs.set("create", "1");
  const s = qs.toString();
  return s ? `/actions?${s}` : "/actions";
}

/** Filter actions where this person is lead, executing, or input. */
export function filterActionsByPerson(
  items: ActionItemWithRelations[],
  userId: string
): ActionItemWithRelations[] {
  return items.filter(
    (item) =>
      item.leadId === userId ||
      item.assignments.some((a) => a.user.id === userId)
  );
}

function WhoTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  if (active) {
    return (
      <span className="ps-tab" aria-current="page">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="ps-tab">
      {children}
    </Link>
  );
}

/** One operating-board section: a quiet header + a stack of simplified rows. */
function BoardSection({
  title,
  hint,
  items,
  now,
  reasons,
}: {
  title: string;
  hint?: string;
  items: ActionItemWithRelations[];
  now: Date;
  reasons?: Map<string, string | null>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="m-0 text-[13px] font-bold tracking-[0.01em] text-ink">{title}</h2>
        <span className="text-[12px] text-ink-muted">
          {items.length}
          {hint ? ` · ${hint}` : ""}
        </span>
      </div>
      {items.map((item) => (
        <ActionRow key={item.id} item={item} now={now} reason={reasons?.get(item.id)} />
      ))}
    </section>
  );
}

export function ActionTrackerDashboard({
  items,
  now,
  officer,
  canCreate,
  assignableUsers,
  departments,
  currentUserId,
  who,
  q,
  initiativeId,
  defaultOpenCreate = false,
  initiativeLink,
  showAttentionBoard = true,
  showQuickCreate = true,
}: {
  items: ActionItemWithRelations[];
  now: Date;
  officer: boolean;
  canCreate: boolean;
  assignableUsers: UserOption[];
  departments: ActionDepartmentOption[];
  currentUserId: string;
  viewer: ActionViewer;
  who: string;
  q: string;
  initiativeId?: string;
  defaultOpenCreate?: boolean;
  initiativeLink?: { id: string; goalCategory?: string };
  /**
   * When false, the built-in row-based "Needs attention" section is suppressed
   * because the page renders the richer explainable Action Attention panel
   * above the board (so attention items show once, in triage form). Mine / Team
   * then list ALL open work rather than hiding the flagged rows.
   */
  showAttentionBoard?: boolean;
  /** When false, the inline create form is omitted (e.g. rendered above browse on /actions). */
  showQuickCreate?: boolean;
}) {
  const listHref = buildActionsHref({ who, q, initiative: initiativeId });

  const board = buildActionOperatingBoard(items, currentUserId, now);
  const attentionIds = new Set(board.needsAttention.map((i) => i.id));
  const reasons = new Map(
    board.needsAttention.map((i) => [i.id, attentionReason(i, now)] as const)
  );
  // When the row-based section is shown, keep each open action in one place: a
  // row in "Needs attention" is not repeated under Mine / Team. When it is
  // suppressed (page panel takes over), Mine / Team carry the full open list.
  const mine = showAttentionBoard
    ? board.mine.filter((i) => !attentionIds.has(i.id))
    : board.mine;
  const team = showAttentionBoard
    ? board.team.filter((i) => !attentionIds.has(i.id))
    : board.team;

  const hasAnything =
    (showAttentionBoard && board.needsAttention.length > 0) ||
    mine.length > 0 ||
    team.length > 0 ||
    board.recentlyCompleted.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {showQuickCreate && canCreate && assignableUsers.length > 0 ? (
        <ActionQuickCreate
          users={assignableUsers}
          departments={departments}
          currentUserId={currentUserId}
          redirectTo={listHref}
          initiativeLink={initiativeLink}
          defaultOpen={defaultOpenCreate}
        />
      ) : null}

      {officer ? (
        <nav aria-label="Whose actions" className="ps-workspace-nav">
          <div className="ps-tabs m-0">
            <WhoTab
              href={buildActionsHref({ who: "me", q, initiative: initiativeId })}
              active={who === "me"}
            >
              My actions
            </WhoTab>
            <WhoTab
              href={buildActionsHref({ who: "all", q, initiative: initiativeId })}
              active={who === "all"}
            >
              Everyone
            </WhoTab>
          </div>
        </nav>
      ) : null}

      <ActionPulseStrip items={items} now={now} />

      <UrlSyncedSearchInput
        placeholder="Search actions…"
        wrapClassName="w-full"
        aria-label="Search actions"
      />

      {!hasAnything ? (
        <EmptyStateV2
          icon="✓"
          title={q ? "No matches" : "All clear"}
          body={
            q
              ? "Try another search."
              : canCreate
                ? "Nothing needs your attention. Use Add action above to create one."
                : "Nothing assigned to you yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {showAttentionBoard ? (
            <BoardSection
              title="Needs attention"
              hint="handle these first"
              items={board.needsAttention}
              now={now}
              reasons={reasons}
            />
          ) : null}
          <BoardSection title="My actions" items={mine} now={now} />
          {who === "all" ? (
            <BoardSection title="Team actions" hint="owned by others" items={team} now={now} />
          ) : null}
          <BoardSection
            title="Recently completed"
            hint="last 7 days"
            items={board.recentlyCompleted}
            now={now}
          />
        </div>
      )}
    </div>
  );
}
