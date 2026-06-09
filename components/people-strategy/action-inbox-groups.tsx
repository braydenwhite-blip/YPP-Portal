import Link from "next/link";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  deriveActionInboxGroups,
  deriveActionUrgency,
  type ActionInboxGroupKey,
} from "@/lib/people-strategy/action-intel";
import { deriveActionSourceLabel } from "@/lib/people-strategy/action-source";

/**
 * Action System 4.0 — the OPERATIONAL INBOX. Turns a flat action list into
 * ranked triage lenses (needs attention, blocked, unowned, due soon, stale,
 * fastest wins) via the pure {@link deriveActionInboxGroups}. Server component:
 * it derives + renders, no client state. Each row carries an honest source label
 * and a specific next step, never a generic "View".
 */

/** Filter presets the existing /actions/all list already understands, so a
 *  group header can deep-link into the full filtered view where one maps. */
const GROUP_PRESET: Partial<Record<ActionInboxGroupKey, string>> = {
  blocked: "blocked",
  unowned: "unassigned",
  due_soon: "due_soon",
};

const URGENCY_TONE: Record<string, string> = {
  overdue: "var(--danger, #b42318)",
  due_today: "var(--warning, #9a6700)",
  due_soon: "var(--warning, #9a6700)",
  scheduled: "var(--muted)",
  settled: "var(--success, #1a7f37)",
};

function InboxRow({ item, now }: { item: ActionItemWithRelations; now: Date }) {
  const urgency = deriveActionUrgency(item, now);
  const owner = item.lead?.name ?? item.lead?.email ?? "Unowned";
  const sourceLabel = deriveActionSourceLabel(item);
  return (
    <li style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", padding: "4px 0" }}>
      <span style={{ minWidth: 0 }}>
        <Link href={`/actions/${item.id}`} style={{ fontWeight: 600 }}>
          {item.title}
        </Link>
        <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
          {owner} · {sourceLabel}
        </span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: URGENCY_TONE[urgency.level], whiteSpace: "nowrap" }}>
        {urgency.label}
      </span>
    </li>
  );
}

export function ActionInboxGroups({
  items,
  now = new Date(),
  limitPerGroup = 4,
}: {
  items: ActionItemWithRelations[];
  now?: Date;
  limitPerGroup?: number;
}) {
  const groups = deriveActionInboxGroups(items, now);
  if (groups.length === 0) {
    return (
      <section className="card" style={{ marginTop: 16, padding: 16 }}>
        <h2 className="ps-section-title" style={{ margin: 0 }}>
          Operational inbox
        </h2>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
          Nothing needs triage — no overdue, blocked, unowned, or stale work. Clean board.
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h2 className="ps-section-title" style={{ margin: "0 0 4px" }}>
        Operational inbox
      </h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
        Triage lenses — handle the top of each before scrolling the full list.
      </p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {groups.map((group) => {
          const preset = GROUP_PRESET[group.key];
          return (
            <div key={group.key} className="card" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{group.label}</strong>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{group.items.length}</span>
              </div>
              <p style={{ margin: "2px 0 8px", fontSize: 12, color: "var(--muted)" }}>{group.description}</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {group.items.slice(0, limitPerGroup).map((item) => (
                  <InboxRow key={item.id} item={item} now={now} />
                ))}
              </ul>
              {group.items.length > limitPerGroup && preset ? (
                <Link href={`/actions/all?preset=${preset}`} style={{ fontSize: 12, fontWeight: 600 }}>
                  View all {group.items.length} →
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
