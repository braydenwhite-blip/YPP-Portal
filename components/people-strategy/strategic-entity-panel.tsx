import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type { StrategicEntityContext } from "@/lib/people-strategy/strategic-entity-context";

import { Pill } from "./pills";
import { EntityTouchpoints } from "./touchpoint-timeline";

/**
 * Compact strategic embed for an entity page (3.5, Phase G).
 *
 * Shows how a partner / class / instructor / mentorship / person ladders into
 * the strategic system: the projects and initiatives its work serves, a one-line
 * activity summary, and its recent touchpoints. Renders NOTHING when the entity
 * has no strategic connection, so non-strategic pages stay clean (their
 * operational panels already cover day-to-day work).
 */
export function StrategicEntityPanel({
  context,
  title = "Strategic context",
}: {
  context: StrategicEntityContext;
  title?: string;
}) {
  if (!context.isStrategic) return null;

  const summaryBits: string[] = [];
  if (context.openActionCount > 0) {
    summaryBits.push(`${context.openActionCount} open action${context.openActionCount === 1 ? "" : "s"}`);
  }
  if (context.overdueActionCount > 0) summaryBits.push(`${context.overdueActionCount} overdue`);
  if (context.nextFollowUpISO) {
    summaryBits.push(`next ${formatMonthDay(new Date(context.nextFollowUpISO))}`);
  }

  return (
    <section className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2 className="ps-section-title" style={{ margin: 0 }}>
          {title}
        </h2>
        {summaryBits.length > 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{summaryBits.join(" · ")}</span>
        ) : null}
      </div>

      {context.projects.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
            Strategic projects
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {context.projects.map((p) => (
              <Link
                key={p.id}
                href={p.href}
                className="card cc-focusable"
                style={{ display: "block", padding: "8px 12px", textDecoration: "none", color: "inherit" }}
              >
                <strong style={{ fontSize: 13 }}>{p.title}</strong>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}> · {p.initiativeTitle}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {context.initiatives.length > 0 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Initiatives:</span>
          {context.initiatives.map((i) => (
            <Link key={i.id} href={i.href} style={{ textDecoration: "none" }}>
              <Pill tone="purple">{i.title}</Pill>
            </Link>
          ))}
        </div>
      ) : null}

      {!context.timeline.isEmpty ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
            Recent activity
          </div>
          <EntityTouchpoints
            timeline={context.timeline}
            limit={4}
            emptyHint="No recent touchpoints on this work yet."
          />
        </div>
      ) : null}
    </section>
  );
}
