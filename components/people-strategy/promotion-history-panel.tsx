import type { PromotionHistoryEntry } from "@/lib/org/promotion-queries";

/**
 * Promotion history (Phase 8 surface). Read-only record of every applied role
 * change, newest first — the proposal's preserved promotion history. Admin/
 * officer-gated by the caller.
 */
export function PromotionHistoryPanel({
  personName,
  entries,
}: {
  personName: string;
  entries: PromotionHistoryEntry[];
}) {
  if (entries.length === 0) return null;

  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <section className="card" style={{ padding: "16px 18px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Promotion history</h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
        Every role change applied to {personName}, preserved in full.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((e) => (
          <li key={e.id} style={{ borderLeft: "3px solid var(--ps-border, #e5e7eb)", paddingLeft: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {e.previousTitle ?? "—"} → {e.newTitle ?? "—"}
              {!e.setupComplete ? (
                <span style={{ color: "var(--danger, #dc2626)", fontWeight: 400 }}> · setup pending</span>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Effective {fmt(e.effectiveDate)}
              {e.actorName ? ` · by ${e.actorName}` : ""}
            </div>
            {e.committeesAdded.length > 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                + {e.committeesAdded.join(", ")}
              </div>
            ) : null}
            {e.reason ? (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{e.reason}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
