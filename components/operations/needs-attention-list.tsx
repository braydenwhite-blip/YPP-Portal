"use client";

import {
  groupAttentionItems,
  ATTENTION_KIND_LABELS,
  type AttentionItem,
} from "@/lib/operations/attention";
import { Pill, type PillTone } from "@/components/people-strategy/pills";

import { EntityLink } from "./entity-link";

/**
 * Data 360 — the Needs Attention queue, grouped by what is operationally wrong
 * (Urgent → Missing an owner → Missing a next step → Stalled → Upcoming risk →
 * Data incomplete). Every card states WHAT is wrong, WHY it matters, and the
 * SUGGESTED next move; clicking opens the entity's 360 panel in place when one
 * exists, else navigates to the surface where the fix happens.
 */

const SEVERITY_TONE: Record<AttentionItem["severity"], PillTone> = {
  critical: "overdue",
  warning: "warning",
  watch: "info",
  neutral: "neutral",
};

const SEVERITY_EDGE: Record<AttentionItem["severity"], string> = {
  critical: "var(--error-color, #991b1b)",
  warning: "var(--warning-color, #b45309)",
  watch: "var(--ypp-purple-500, #8b3fe8)",
  neutral: "var(--border, #e5e7eb)",
};

const SEVERITY_LABEL: Record<AttentionItem["severity"], string> = {
  critical: "Critical",
  warning: "Warning",
  watch: "Watch",
  neutral: "FYI",
};

function AttentionCard({ item }: { item: AttentionItem }) {
  return (
    <EntityLink
      type={item.entityType ?? "action"}
      id={item.entityType ? item.entityId : null}
      href={item.href}
      className="card ps-action-card cc-focusable"
      style={{
        display: "block",
        padding: "12px 14px",
        color: "inherit",
        borderLeft: `3px solid ${SEVERITY_EDGE[item.severity]}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 13.5, minWidth: 0, lineHeight: 1.4 }}>
          {item.title}
        </strong>
        <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
          <Pill tone="neutral">{ATTENTION_KIND_LABELS[item.kind]}</Pill>
          <Pill tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Pill>
        </span>
      </div>
      <p
        style={{
          margin: "5px 0 0",
          fontSize: 12.5,
          color: "var(--text-secondary)",
          lineHeight: 1.45,
        }}
      >
        {item.why}
      </p>
      {item.suggestedStep ? (
        <p
          style={{
            margin: "5px 0 0",
            fontSize: 12.5,
            color: "var(--text-secondary)",
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: "var(--ypp-ink, inherit)" }}>Suggested: </strong>
          {item.suggestedStep}
        </p>
      ) : null}
      {item.ageLabel || item.relatedLabel ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 7,
            fontSize: 11.5,
            color: "var(--muted)",
          }}
        >
          {item.relatedLabel ? <Pill tone="info">{item.relatedLabel}</Pill> : null}
          {item.ageLabel ? <span>{item.ageLabel}</span> : null}
        </div>
      ) : null}
    </EntityLink>
  );
}

export function NeedsAttentionQueue({
  items,
  empty,
}: {
  items: AttentionItem[];
  empty: React.ReactNode;
}) {
  if (items.length === 0) return <>{empty}</>;
  const groups = groupAttentionItems(items);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {groups.map((group) => (
        <section key={group.category}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: "var(--ypp-ink, #1a0533)",
              }}
            >
              {group.label}
              <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                {" "}
                · {group.items.length}
              </span>
            </h3>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{group.hint}</span>
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {group.items.map((item) => (
              <li key={item.id}>
                <AttentionCard item={item} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
