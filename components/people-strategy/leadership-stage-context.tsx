import type { LeadershipStage } from "@/lib/leadership-pathway";

/**
 * People Strategy — leadership-pathway stage shown as CONTEXT on a person's
 * leadership profile, alongside their linked actions. The Action Tracker links
 * leadership-pathway work to the person (USER) rather than to an inferred stage
 * with no stable id (see `lib/people-strategy/constants.ts`); this surfaces
 * where that person sits on the pathway so leadership reads execution and growth
 * together. Renders nothing when the person isn't on a leadership track.
 */
export function LeadershipStageContext({
  stage,
  nextStage = null,
}: {
  stage: LeadershipStage | null;
  nextStage?: LeadershipStage | null;
}) {
  if (!stage) return null;
  return (
    <section
      className="card"
      style={{ padding: "14px 16px", borderLeft: `3px solid ${stage.color.accent}` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
          Leadership pathway
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: 999,
            background: stage.color.bg,
            color: stage.color.text,
            border: `1px solid ${stage.color.border}`,
          }}
        >
          {stage.label}
        </span>
        {nextStage ? (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            → next: {nextStage.label}
          </span>
        ) : null}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
        {stage.tagline}.
      </p>
    </section>
  );
}

export default LeadershipStageContext;
