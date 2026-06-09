import Link from "next/link";

import type { StrategicWorkContext } from "@/lib/people-strategy/strategic-context";

import { Pill } from "./pills";

/**
 * YPP Execution OS — STRATEGIC CONTEXT section (3.0, Phase F/G).
 *
 * A small, high-value embed for an action / meeting detail page: "this is part of
 * initiative X and project Y." Renders nothing when the work isn't strategic, so
 * non-strategic pages stay clean. Pure presentational server component.
 */
export function StrategicContextSection({
  context,
  kind = "action",
}: {
  context: StrategicWorkContext;
  kind?: "action" | "meeting";
}) {
  if (!context.isStrategic) return null;
  const noun = kind === "meeting" ? "meeting" : "action";

  return (
    <section className="card" style={{ padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h2 className="ps-section-title" style={{ margin: 0 }}>
          Strategic context
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Why this {noun} matters</span>
      </div>

      {context.primaryInitiative ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          This {noun} ladders up to{" "}
          <Link href={context.primaryInitiative.href} style={{ color: "var(--ypp-purple, #6b21c8)", fontWeight: 600 }}>
            {context.primaryInitiative.title}
          </Link>
          {context.primaryInitiative.reasons.length > 0 ? ` — matched on ${context.primaryInitiative.reasons[0]}.` : "."}
        </p>
      ) : null}

      {context.initiatives.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 12 }}>Related initiatives</strong>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {context.initiatives.map((i) => (
              <Link key={i.id} href={i.href} style={{ textDecoration: "none" }}>
                <Pill tone="purple">{i.title}</Pill>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {context.projects.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 12 }}>Related projects</strong>
          <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {context.projects.map((p) => (
              <li key={p.id} className="card" style={{ padding: "8px 12px", fontSize: 13 }}>
                <Link href={p.href} style={{ fontWeight: 600, color: "inherit" }}>
                  {p.title}
                </Link>
                <span style={{ color: "var(--text-secondary)" }}> · {p.initiativeTitle}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
          No specific project owns this {noun} yet — it rolls up at the initiative level.
        </p>
      )}
    </section>
  );
}
