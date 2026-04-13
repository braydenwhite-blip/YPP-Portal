import type { AwardProjection } from "@/lib/award-projection";

type Props = {
  projection: AwardProjection;
  menteeName?: string | null;
};

function tierLabel(tier: string | null): string {
  if (!tier) return "No tier yet";
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

export function AwardsSummaryPanel({ projection, menteeName }: Props) {
  const {
    cyclePoints,
    basePoints,
    bonusPoints,
    runningTotal,
    projectedTotal,
    currentTier,
    projectedTier,
    willCrossTierThreshold,
    nextThreshold,
    requiresBoardApproval,
  } = projection;

  const displayName = menteeName ?? "this mentee";

  const progressPct =
    nextThreshold && nextThreshold.min > 0
      ? Math.min(100, Math.round((projectedTotal / nextThreshold.min) * 100))
      : 100;

  return (
    <section
      className="card"
      style={{
        padding: "1rem 1.1rem",
        marginBottom: 16,
        borderLeft: "4px solid #f59e0b",
        background: "linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)",
      }}
      aria-label="Awards summary — what approval will trigger"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>On approval</div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
            Read-only preview of what approving this review will award.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>+{cyclePoints}</div>
          <div className="muted" style={{ fontSize: "0.75rem" }}>
            {basePoints} base + {bonusPoints} bonus
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Running total
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{runningTotal} pts</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
            After approval
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{projectedTotal} pts</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Current tier
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{tierLabel(currentTier)}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Projected tier
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{tierLabel(projectedTier)}</div>
        </div>
      </div>

      {nextThreshold && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 4 }}>
            <span>Progress to {tierLabel(nextThreshold.tier)}</span>
            <span className="muted">
              {projectedTotal} / {nextThreshold.min} ({nextThreshold.pointsAway} to go)
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "#fef3c7",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #f59e0b, #d97706)",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      )}

      {willCrossTierThreshold && projectedTier && (
        <div
          style={{
            marginTop: 12,
            padding: "0.6rem 0.8rem",
            background: "#fef3c7",
            borderRadius: 6,
            fontSize: "0.85rem",
            color: "#92400e",
          }}
        >
          <strong>Tier change:</strong> Approving this review will {currentTier ? "promote" : "qualify"}{" "}
          {displayName} to <strong>{tierLabel(projectedTier)}</strong>.
          {requiresBoardApproval && (
            <> This tier requires board approval before the award is finalized.</>
          )}
        </div>
      )}
    </section>
  );
}
