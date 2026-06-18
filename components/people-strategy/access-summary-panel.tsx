import type { AccessFact } from "@/lib/org/access-explainer";

/**
 * "Why This Person Has Access" — admin-only profile section (Phase 2 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md). Presentational only; the caller
 * gathers facts via `getPersonAccessSummary` and gates visibility.
 */
export function AccessSummaryPanel({
  personName,
  facts,
}: {
  personName: string;
  facts: AccessFact[];
}) {
  if (facts.length === 0) return null;

  const grants = facts.filter((f) => f.kind === "grant");
  const limits = facts.filter((f) => f.kind === "limit");

  return (
    <section className="card" style={{ padding: "16px 18px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
        Why this person has access
      </h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
        Access for {personName} explained in plain language — calculated from their
        title, internal level, relationships, and assignments.
      </p>

      {grants.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {grants.map((fact, i) => (
            <li key={`grant-${i}`} style={{ fontSize: 14 }}>
              {fact.statement}
            </li>
          ))}
        </ul>
      ) : null}

      {limits.length > 0 ? (
        <ul
          style={{
            margin: "12px 0 0",
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {limits.map((fact, i) => (
            <li key={`limit-${i}`} style={{ fontSize: 14, color: "var(--muted)" }}>
              {fact.statement}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
