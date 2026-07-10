import Link from "next/link";
import { DeadlineChip } from "@/components/mentorship/deadline-chip";
import type { SimplifiedKanbanCard as KanbanCard } from "@/lib/mentorship-kanban-actions";
import { formatEnum } from "@/lib/format-utils";

type Props = {
  card: KanbanCard;
};

export function MentorKanbanCard({ card }: Props) {
  const { menteeId, menteeName, menteePrimaryRole, cta, softDeadline } = card;
  const variantClass =
    cta.variant === "primary" ? "primary" : cta.variant === "secondary" ? "secondary" : "secondary";
  return (
    <div
      className="card"
      style={{
        padding: "0.75rem 0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderLeft: "3px solid var(--color-primary, #2563eb)",
      }}
    >
      <Link
        href={`/people/${menteeId}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <strong style={{ fontSize: "0.95rem", display: "block" }}>{menteeName}</strong>
      </Link>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {menteePrimaryRole && (
          <span className="pill" style={{ fontSize: "0.7rem" }}>
            {formatEnum(menteePrimaryRole)}
          </span>
        )}
      </div>
      {softDeadline && <DeadlineChip softDeadline={softDeadline} />}
      <div style={{ marginTop: 4 }}>
        {cta.disabled || !cta.href ? (
          <span
            className="muted"
            style={{ fontSize: "0.75rem", fontStyle: "italic" }}
          >
            {cta.label}
          </span>
        ) : (
          <Link
            href={cta.href}
            className={`button ${variantClass} small`}
            style={{ textDecoration: "none", fontSize: "0.8rem" }}
          >
            {cta.label} →
          </Link>
        )}
      </div>
    </div>
  );
}
