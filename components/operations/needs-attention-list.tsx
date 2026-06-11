"use client";

import Link from "next/link";

import type { AttentionItem } from "@/lib/operations/attention";
import { ATTENTION_KIND_LABELS } from "@/lib/operations/attention";
import { Pill, type PillTone } from "@/components/people-strategy/pills";

import { useEntity360 } from "./entity-360-context";

/**
 * Data 360 — the Needs Attention queue. Every card states WHAT is wrong and
 * WHY it matters in plain language; clicking opens the entity's 360 panel in
 * place when one exists, else navigates to the surface where the fix happens.
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

function AttentionCard({ item, index }: { item: AttentionItem; index: number }) {
  const drawer = useEntity360();
  const inner = (
    <>
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
          <span
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              marginRight: 8,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {index + 1}
          </span>
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
    </>
  );
  const cardStyle: React.CSSProperties = {
    display: "block",
    padding: "12px 14px",
    textDecoration: "none",
    color: "inherit",
    borderLeft: `3px solid ${SEVERITY_EDGE[item.severity]}`,
  };
  return (
    <Link
      href={item.href}
      className="card ps-action-card cc-focusable"
      style={cardStyle}
      onClick={(e) => {
        if (
          drawer &&
          item.entityType &&
          item.entityId &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          drawer.openEntity(item.entityType, item.entityId);
        }
      }}
    >
      {inner}
    </Link>
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
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {items.map((item, i) => (
        <li key={item.id}>
          <AttentionCard item={item} index={i} />
        </li>
      ))}
    </ol>
  );
}
