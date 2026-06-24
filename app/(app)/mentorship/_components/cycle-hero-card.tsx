import Link from "next/link";
import type { NextAction } from "@/lib/instructor-mentee-next-action";

interface CycleHeroCardProps {
  action: NextAction;
  /** Raw cycleStage enum value (string) — used for the chip label. */
  cycleStage: string | null;
  mentor: {
    name: string | null;
    email: string;
    roleLabel?: string | null;
  } | null;
  /** Stage-tone accent color — gives continuity with the leadership pathway hero. */
  accentColor?: string;
}

const CYCLE_STAGE_LABEL: Record<string, string> = {
  KICKOFF_PENDING: "Kickoff pending",
  REFLECTION_DUE: "Reflection due",
  REFLECTION_SUBMITTED: "Reflection submitted",
  REVIEW_SUBMITTED: "With chair for approval",
  APPROVED: "Review available",
  CHANGES_REQUESTED: "Changes requested",
  PAUSED: "Paused",
  COMPLETE: "Cycle complete",
};

const URGENT_STAGES = new Set([
  "REFLECTION_DUE",
  "KICKOFF_PENDING",
  "CHANGES_REQUESTED",
]);

/**
 * The ONE primary action surfaced first on the mentee tab.
 *
 * Replaces the trio of top cards in the legacy MenteeDashboard
 * (next-action / mentor / reflection-status) with a single
 * deliberate hero. Playfair 24px primary action, one detail line,
 * one CTA, a tiny mentor block on the right, and a bottom-edge
 * stage-tone accent for continuity with the leadership pathway hero.
 */
export function CycleHeroCard({
  action,
  cycleStage,
  mentor,
  accentColor,
}: CycleHeroCardProps) {
  const stageLabel = cycleStage ? CYCLE_STAGE_LABEL[cycleStage] : null;
  const isUrgent = cycleStage ? URGENT_STAGES.has(cycleStage) : false;

  return (
    <section
      aria-labelledby="cycle-hero-title"
      style={{
        position: "relative",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "28px 30px 30px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: 28,
        rowGap: 18,
        alignItems: "start",
      }}
    >
      {accentColor && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 4,
            background: accentColor,
          }}
        />
      )}

      <div style={{ minWidth: 0 }}>
        {stageLabel && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: isUrgent ? "#92400e" : "var(--muted)",
              background: isUrgent ? "#fef3c7" : "var(--ypp-purple-50)",
            }}
          >
            {stageLabel}
          </span>
        )}

        <h2
          id="cycle-hero-title"
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, -apple-system, sans-serif",
            fontSize: "clamp(20px, 2.6vw, 26px)",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--ypp-purple-800)",
            margin: "12px 0 0",
            lineHeight: 1.2,
          }}
        >
          {action.label}
        </h2>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--muted)",
            maxWidth: "60ch",
          }}
        >
          {action.detail}
        </p>

        {action.href && (
          <div style={{ marginTop: 20 }}>
            <Link
              href={action.href}
              className="button primary small"
              style={{ whiteSpace: "nowrap" }}
            >
              Take action →
            </Link>
          </div>
        )}
      </div>

      {mentor && (
        <aside
          aria-label="Your mentor"
          style={{
            display: "grid",
            gap: 4,
            paddingLeft: 24,
            borderLeft: "1px solid var(--border-light, var(--border))",
            minWidth: 180,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Your mentor
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
              wordBreak: "break-word",
            }}
          >
            {mentor.name ?? mentor.email}
          </div>
          {mentor.roleLabel && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {mentor.roleLabel}
            </div>
          )}
          <a
            href={`mailto:${mentor.email}`}
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "var(--accent)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Send email →
          </a>
        </aside>
      )}
    </section>
  );
}
