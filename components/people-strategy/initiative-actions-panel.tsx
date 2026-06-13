import Link from "next/link";

import { ActionCard } from "@/components/people-strategy/action-card";
import { ActionQuickCreate } from "@/components/people-strategy/action-quick-create";
import type {
  ActionDepartmentOption,
  ActionItemWithRelations,
  ActionPickerUser,
} from "@/lib/people-strategy/action-queries";
import { initiativePrimaryGoalCategory } from "@/lib/people-strategy/strategic-recommendations";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

/**
 * The work under one initiative — the plan's action list, inline.
 */
export function InitiativeActionsPanel({
  initiative,
  actions,
  now,
  canCreate,
  assignableUsers,
  departments,
  currentUserId,
}: {
  initiative: StrategicInitiativeDef;
  actions: ActionItemWithRelations[];
  now: Date;
  canCreate: boolean;
  assignableUsers: ActionPickerUser[];
  departments: ActionDepartmentOption[];
  currentUserId: string;
}) {
  const trackerHref = `/actions?initiative=${encodeURIComponent(initiative.id)}&who=all`;
  const openCount = actions.length;

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 className="ps-section-title" style={{ margin: 0 }}>
            Actions
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            The work that moves this initiative forward — {openCount} open.
          </p>
        </div>
        <Link href={trackerHref} className="button outline small">
          Open in tracker
        </Link>
      </div>

      {canCreate && assignableUsers.length > 0 ? (
        <ActionQuickCreate
          users={assignableUsers}
          departments={departments}
          currentUserId={currentUserId}
          redirectTo={`/operations/initiatives/${initiative.id}`}
          initiativeLink={{
            id: initiative.id,
            goalCategory: initiativePrimaryGoalCategory(initiative),
          }}
        />
      ) : null}

      {openCount === 0 ? (
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            No open actions yet. Add one above — it will stay linked to this initiative.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {actions.map((item) => (
            <ActionCard key={item.id} item={item} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}
