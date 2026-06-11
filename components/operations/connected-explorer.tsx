"use client";

import { useMemo, useState } from "react";

import type { ExplorerCard, ExplorerInitiative } from "@/lib/operations/data-360-queries";
import { recencyLabel } from "@/lib/operations/signals";
import { Pill, type PillTone } from "@/components/people-strategy/pills";

import { EntityLink } from "./entity-link";

/**
 * Data 360 — the connected data explorer. Every entity the operating data
 * touches (classes, partners, people, mentorships, applications) plus the
 * strategic initiatives, as relationship cards: who owns it, what's connected,
 * what's at risk, what happens next, and when it last moved. Clicking a card
 * opens its 360 panel in place. Filters cover both type AND condition ("At
 * risk", "Missing next step") so the explorer works as a practical
 * relationship map, not just a list.
 */

const HEALTH_TONE: Record<ExplorerCard["healthLevel"], PillTone> = {
  healthy: "success",
  attention: "info",
  at_risk: "warning",
  critical: "overdue",
};

const CONDITION_FILTERS = ["at_risk", "missing_next_step"] as const;
type ConditionFilter = (typeof CONDITION_FILTERS)[number];

const CONDITION_LABELS: Record<ConditionFilter, string> = {
  at_risk: "At risk",
  missing_next_step: "Missing next step",
};

type Filter = "all" | ConditionFilter | string;

function entityMatchesCondition(card: ExplorerCard, condition: ConditionFilter): boolean {
  if (condition === "at_risk") {
    return card.healthLevel === "at_risk" || card.healthLevel === "critical";
  }
  return card.nextStep == null && card.openActions > 0;
}

function initiativeMatchesCondition(
  s: ExplorerInitiative,
  condition: ConditionFilter
): boolean {
  if (condition === "at_risk") {
    return s.healthTone === "warning" || s.healthTone === "overdue";
  }
  return s.nextStep == null && s.openActions > 0;
}

export function ConnectedExplorer({
  entities,
  initiatives,
}: {
  entities: ExplorerCard[];
  initiatives: ExplorerInitiative[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const typeLabels = useMemo(() => {
    const labels = new Set<string>(entities.map((e) => e.typeLabel));
    if (initiatives.length > 0) labels.add("Initiative");
    return [...labels].sort();
  }, [entities, initiatives]);

  const q = query.trim().toLowerCase();
  const isCondition = (CONDITION_FILTERS as readonly string[]).includes(filter);

  const visibleEntities = entities.filter((e) => {
    if (q && !e.label.toLowerCase().includes(q)) return false;
    if (filter === "all") return true;
    if (isCondition) return entityMatchesCondition(e, filter as ConditionFilter);
    return e.typeLabel === filter;
  });
  const visibleInitiatives = initiatives.filter((s) => {
    if (q && !s.title.toLowerCase().includes(q)) return false;
    if (filter === "all") return true;
    if (isCondition) return initiativeMatchesCondition(s, filter as ConditionFilter);
    return filter === "Initiative";
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter connected data…"
          aria-label="Filter connected data"
          style={{
            flex: "1 1 200px",
            minWidth: 160,
            padding: "8px 12px",
            fontSize: 13,
            border: "1px solid var(--border, rgba(107,33,200,0.15))",
            borderRadius: 10,
            background: "var(--surface, #fff)",
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...typeLabels, ...CONDITION_FILTERS].map((value) => (
            <button
              key={value}
              type="button"
              className="ps-tab"
              aria-current={filter === value ? "page" : undefined}
              style={{ cursor: "pointer", border: "none", font: "inherit" }}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "All"
                : CONDITION_LABELS[value as ConditionFilter] ?? value}
            </button>
          ))}
        </div>
      </div>

      {visibleEntities.length === 0 && visibleInitiatives.length === 0 ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
          {entities.length === 0 && initiatives.length === 0
            ? "Link actions and meetings to classes, partners, and people, and their connection cards will build themselves here."
            : "Nothing matches that filter — which usually means things are in good shape."}
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

function CardFooter({
  risk,
  nextStep,
}: {
  risk: string | null;
  nextStep: string | null;
}) {
  return (
    <>
      {risk ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--warning-color, #b45309)" }}>
          Risk: {risk}
        </p>
      ) : null}
      {nextStep ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--ypp-ink, inherit)" }}>Next: </strong>
          {nextStep}
        </p>
      ) : null}
    </>
  );
}

function EntityCard({ entity }: { entity: ExplorerCard }) {
  return (
    <EntityLink
      type={entity.entityType ?? "action"}
      id={entity.entityType ? entity.id : null}
      href={entity.href ?? "/operations/data-360"}
      className="card ps-action-card cc-focusable"
      style={{ display: "block", padding: "12px 14px", color: "inherit" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <strong style={{ fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>
          {entity.label}
        </strong>
        <Pill tone={HEALTH_TONE[entity.healthLevel]}>{entity.healthLabel}</Pill>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
        {[entity.typeLabel, entity.areaLabel, entity.owner].filter(Boolean).join(" · ")}
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
            entity.lastActivityISO
              ? `last activity ${recencyLabel(entity.lastActivityISO)}`
              : null,
          ]}
        />
      </div>
      <CardFooter risk={entity.risk} nextStep={entity.nextStep} />
    </EntityLink>
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
        {["Initiative", initiative.areaLabel, initiative.owner].filter(Boolean).join(" · ")}
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
      <CardFooter risk={initiative.risk} nextStep={initiative.nextStep} />
    </EntityLink>
  );
}
