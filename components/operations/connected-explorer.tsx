"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ExplorerCard, ExplorerInitiative } from "@/lib/operations/data-360-queries";
import { Pill, type PillTone } from "@/components/people-strategy/pills";

import { useEntity360 } from "./entity-360-context";
import { EntityLink } from "./entity-link";

/**
 * Data 360 — the connected data explorer. Every entity the operating data
 * touches (classes, partners, people, mentorships, applications) plus the
 * strategic initiatives, as relationship cards: what's connected, what's at
 * risk, and what happens next. Clicking a card opens its 360 panel in place.
 */

const HEALTH_TONE: Record<ExplorerCard["healthLevel"], PillTone> = {
  healthy: "success",
  attention: "info",
  at_risk: "warning",
  critical: "overdue",
};

type TypeFilter = "all" | string;

export function ConnectedExplorer({
  entities,
  initiatives,
}: {
  entities: ExplorerCard[];
  initiatives: ExplorerInitiative[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const typeLabels = useMemo(() => {
    const labels = new Set<string>(entities.map((e) => e.typeLabel));
    if (initiatives.length > 0) labels.add("Initiative");
    return ["all", ...[...labels].sort()];
  }, [entities, initiatives]);

  const q = query.trim().toLowerCase();
  const visibleEntities = entities.filter(
    (e) =>
      (typeFilter === "all" || e.typeLabel === typeFilter) &&
      (!q || e.label.toLowerCase().includes(q))
  );
  const visibleInitiatives = initiatives.filter(
    (s) =>
      (typeFilter === "all" || typeFilter === "Initiative") &&
      (!q || s.title.toLowerCase().includes(q))
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search connected classes, partners, people, initiatives…"
          aria-label="Search connected data"
          style={{
            flex: "1 1 260px",
            minWidth: 200,
            padding: "8px 12px",
            fontSize: 13,
            border: "1px solid var(--border, rgba(107,33,200,0.15))",
            borderRadius: 10,
            background: "var(--surface, #fff)",
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {typeLabels.map((label) => (
            <button
              key={label}
              type="button"
              className="ps-tab"
              aria-current={typeFilter === label ? "page" : undefined}
              style={{ cursor: "pointer", border: "none", font: "inherit" }}
              onClick={() => setTypeFilter(label)}
            >
              {label === "all" ? "All" : label}
            </button>
          ))}
        </div>
      </div>

      {visibleEntities.length === 0 && visibleInitiatives.length === 0 ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
          {entities.length === 0 && initiatives.length === 0
            ? "Link actions and meetings to classes, partners, and people, and their connection cards will build themselves here."
            : "Nothing matches that search."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}
        >
          {visibleInitiatives.map((s) => (
            <InitiativeCard key={s.id} initiative={s} />
          ))}
          {visibleEntities.map((e) => (
            <EntityCard key={e.refKey} entity={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardCounts({ parts }: { parts: Array<string | null> }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      {parts.filter(Boolean).map((part) => (
        <span key={part as string}>{part}</span>
      ))}
    </div>
  );
}

function EntityCard({ entity }: { entity: ExplorerCard }) {
  const drawer = useEntity360();
  const openable = entity.entityType != null;
  const body = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <strong style={{ fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>
          {entity.label}
        </strong>
        <Pill tone={HEALTH_TONE[entity.healthLevel]}>{entity.healthLabel}</Pill>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
        {entity.typeLabel} · {entity.areaLabel}
      </div>
      <div style={{ marginTop: 8 }}>
        <CardCounts
          parts={[
            `${entity.openActions} open action${entity.openActions === 1 ? "" : "s"}`,
            entity.overdueActions > 0 ? `${entity.overdueActions} overdue` : null,
            entity.meetingCount > 0
              ? `${entity.meetingCount} meeting${entity.meetingCount === 1 ? "" : "s"}`
              : null,
            entity.recentDecisions > 0
              ? `${entity.recentDecisions} recent decision${entity.recentDecisions === 1 ? "" : "s"}`
              : null,
          ]}
        />
      </div>
      {entity.risk ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--warning-color, #b45309)" }}>
          Risk: {entity.risk}
        </p>
      ) : null}
      {entity.nextStep ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--ypp-ink, inherit)" }}>Next: </strong>
          {entity.nextStep}
        </p>
      ) : null}
    </>
  );
  const cardStyle: React.CSSProperties = {
    display: "block",
    padding: "12px 14px",
    textDecoration: "none",
    color: "inherit",
  };
  if (openable) {
    return (
      <Link
        href={entity.href ?? "/operations/data-360"}
        className="card ps-action-card cc-focusable"
        style={cardStyle}
        onClick={(e) => {
          if (drawer && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            drawer.openEntity(entity.entityType as NonNullable<ExplorerCard["entityType"]>, entity.id);
          }
        }}
      >
        {body}
      </Link>
    );
  }
  if (entity.href) {
    return (
      <Link href={entity.href} className="card ps-action-card cc-focusable" style={cardStyle}>
        {body}
      </Link>
    );
  }
  return (
    <div className="card" style={cardStyle}>
      {body}
    </div>
  );
}

function InitiativeCard({ initiative }: { initiative: ExplorerInitiative }) {
  return (
    <EntityLink
      type="initiative"
      id={initiative.id}
      href={initiative.href}
      className="card ps-action-card cc-focusable"
      style={{ display: "block", padding: "12px 14px", color: "inherit" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <strong style={{ fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>
          {initiative.title}
        </strong>
        <Pill tone={initiative.healthTone}>{initiative.healthLabel}</Pill>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
        Initiative · {initiative.areaLabel}
        {initiative.owner ? ` · ${initiative.owner}` : ""}
      </div>
      <div style={{ marginTop: 8 }}>
        <CardCounts
          parts={[
            `${initiative.progressPercent}% complete`,
            `${initiative.openActions} open action${initiative.openActions === 1 ? "" : "s"}`,
            initiative.meetingCount > 0
              ? `${initiative.meetingCount} meeting${initiative.meetingCount === 1 ? "" : "s"}`
              : null,
          ]}
        />
      </div>
      {initiative.risk ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--warning-color, #b45309)" }}>
          Risk: {initiative.risk}
        </p>
      ) : null}
      {initiative.nextStep ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--ypp-ink, inherit)" }}>Next: </strong>
          {initiative.nextStep}
        </p>
      ) : null}
    </EntityLink>
  );
}
