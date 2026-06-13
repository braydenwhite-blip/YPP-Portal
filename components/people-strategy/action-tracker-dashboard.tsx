import Link from "next/link";
import type { ReactNode } from "react";

import type {
  ActionDepartmentOption,
  ActionItemWithRelations,
  ActionPickerUser,
} from "@/lib/people-strategy/action-queries";
import { canDeleteAction, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { getUserTitle } from "@/lib/user-title";
import { ActionQuickCreate } from "@/components/people-strategy/action-quick-create";
import { ActionTrackerList } from "@/components/people-strategy/action-tracker-list";
import { StatCard } from "@/components/people-strategy/stat-card";
import { isActionOverdue, effectiveDeadline } from "@/lib/people-strategy/my-actions-selectors";

type UserOption = ActionPickerUser;

function buildActionsHref(params: { who?: string; q?: string; initiative?: string }) {
  const qs = new URLSearchParams();
  if (params.who && params.who !== "all") qs.set("who", params.who);
  if (params.q) qs.set("q", params.q);
  if (params.initiative) qs.set("initiative", params.initiative);
  const s = qs.toString();
  return s ? `/actions?${s}` : "/actions";
}

function userLabel(u: UserOption): string {
  const title = getUserTitle(u);
  if (u.name) return `${u.name} · ${title}`;
  return `${u.email} · ${title}`;
}

function actionAccessShape(item: ActionItemWithRelations) {
  return {
    leadId: item.leadId,
    createdById: item.createdById,
    visibility: item.visibility,
    assignments: item.assignments.map((assignment) => ({
      userId: assignment.user.id,
      role: assignment.role,
    })),
  };
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

export function ActionTrackerDashboard({
  items,
  now,
  officer,
  canCreate,
  assignableUsers,
  departments,
  currentUserId,
  viewer,
  who,
  q,
  initiativeId,
  initiativeLink,
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
  initiativeLink?: { id: string; goalCategory?: string };
}) {
  const deletableIds = items
    .filter(
      (item) =>
        item.status !== "DROPPED" && canDeleteAction(viewer, actionAccessShape(item))
    )
    .map((item) => item.id);
  const overdueCount = items.filter((item) => isActionOverdue(item, now)).length;
  const dueThisWeek = items.filter((item) => {
    const due = effectiveDeadline(item);
    if (!due || isActionOverdue(item, now)) return false;
    const days = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }).length;

  return (
    <>
      {/* Overview strip — matches other Action Tracker / admin report pages */}
      <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
        <StatCard label="Open" value={items.length} icon="list" tone="accent" />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon="alert"
          tone={overdueCount > 0 ? "danger" : "default"}
        />
        <StatCard label="Due this week" value={dueThisWeek} icon="calendar" />
      </div>

      {canCreate && assignableUsers.length > 0 ? (
        <ActionQuickCreate
          users={assignableUsers}
          departments={departments}
          currentUserId={currentUserId}
          redirectTo={buildActionsHref({ who, q, initiative: initiativeId })}
          initiativeLink={initiativeLink}
        />
      ) : null}

      {officer ? (
        <nav aria-label="Filter by person" className="ps-tabs" style={{ marginTop: 18 }}>
          <WhoTab href={buildActionsHref({ who: "all", q, initiative: initiativeId })} active={who === "all"}>
            Everyone
          </WhoTab>
          <WhoTab href={buildActionsHref({ who: "me", q, initiative: initiativeId })} active={who === "me"}>
            Me
          </WhoTab>
        </nav>
      ) : null}

      <form method="get" className="ps-filter-bar">
        {initiativeId ? <input type="hidden" name="initiative" value={initiativeId} /> : null}
        {officer ? (
          <select
            id="who-person"
            name="who"
            className="ps-filter"
            defaultValue={who}
            aria-label="Filter by person"
          >
            <option value="all">All people</option>
            <option value="me">Me only</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {userLabel(u)}
              </option>
            ))}
          </select>
        ) : null}
        <div className="ps-filter-search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search actions…"
            className="ps-filter"
            aria-label="Search actions"
          />
          <button type="submit" className="button outline small">
            Search
          </button>
        </div>
      </form>

      <section style={{ marginTop: 20 }}>
        <h2 className="ps-section-title">
          {items.length} {items.length === 1 ? "action" : "actions"}
        </h2>

        {items.length === 0 ? (
          <div className="card" style={{ marginTop: 10, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ps-ink-soft, var(--muted))" }}>
              {q
                ? "No actions match your search."
                : canCreate
                  ? initiativeId
                    ? "Nothing for this initiative yet — use Add action above."
                    : "Nothing here yet — use Add action above to create one."
                  : "Nothing assigned to you yet."}
            </p>
          </div>
        ) : (
          <ActionTrackerList items={items} nowISO={now.toISOString()} deletableIds={deletableIds} />
        )}
      </section>
    </>
  );
}
