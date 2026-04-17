import Link from "next/link";
import type { MentorshipCycleStage } from "@prisma/client";
import { DeadlineChip } from "@/components/mentorship/deadline-chip";
import { getCycleStageCTA, stageLabel } from "@/lib/mentorship-cycle-cta";

type Props = {
  menteeId: string;
  mentorshipId: string;
  cycleStage: MentorshipCycleStage;
  reviewId?: string | null;
  trackName?: string | null;
  softDeadline?: Date | null;
  completedAt?: Date | null;
  cycleLabel?: string | null;
};

export function CycleStatusBlock({
  menteeId,
  mentorshipId,
  cycleStage,
  reviewId,
  trackName,
  softDeadline,
  completedAt,
  cycleLabel,
}: Props) {
  const cta = getCycleStageCTA({ stage: cycleStage, menteeId, mentorshipId, reviewId });
  const variantClass =
    cta.variant === "primary" ? "primary" : cta.variant === "secondary" ? "secondary" : "secondary";
  return (
    <section
      className="card"
      style={{
        padding: "1rem 1.1rem",
        marginBottom: "1rem",
        borderLeft: "4px solid var(--color-primary, #2563eb)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                padding: "0.2rem 0.6rem",
                borderRadius: 999,
                background: "#e0e7ff",
                color: "#3730a3",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {stageLabel(cycleStage)}
            </span>
            {trackName && <span className="muted" style={{ fontSize: "0.8rem" }}>{trackName}</span>}
            {cycleLabel && <span className="muted" style={{ fontSize: "0.8rem" }}>{cycleLabel}</span>}
          </div>
          {softDeadline && (
            <DeadlineChip softDeadline={softDeadline} completedAt={completedAt ?? null} />
          )}
        </div>
        <div>
          {cta.disabled || !cta.href ? (
            <span className="muted" style={{ fontSize: "0.85rem", fontStyle: "italic" }}>{cta.label}</span>
          ) : (
            <Link href={cta.href} className={`button ${variantClass} small`}>
              {cta.label} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
