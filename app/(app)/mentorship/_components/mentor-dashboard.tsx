import Link from "next/link";
import type {
  SimplifiedKanbanColumn,
  SimplifiedKanbanCard,
} from "@/lib/mentorship-kanban-actions";
import { formatEnum } from "@/lib/format-utils";
import { MentorTagDropdown } from "./mentor-tag-dropdown";

type Props = {
  columns: SimplifiedKanbanColumn[];
  inactive: SimplifiedKanbanCard[];
  total: number;
};

const RATING_COLORS: Record<string, string> = {
  BEHIND_SCHEDULE: "#ef4444",
  GETTING_STARTED: "#f59e0b",
  ACHIEVED: "#22c55e",
  ABOVE_AND_BEYOND: "#a855f7",
};

const RATING_ABBREV: Record<string, string> = {
  BEHIND_SCHEDULE: "R",
  GETTING_STARTED: "Y",
  ACHIEVED: "G",
  ABOVE_AND_BEYOND: "P",
};

function RatingDots({ ratings }: { ratings: string[] }) {
  if (ratings.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
      {ratings.map((r, i) => (
        <span
          key={i}
          title={r.replace(/_/g, " ")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: RATING_COLORS[r] ?? "#94a3b8",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          {RATING_ABBREV[r] ?? "?"}
        </span>
      ))}
    </div>
  );
}

function KanbanCard({ card }: { card: SimplifiedKanbanCard }) {
  const isMuted = card.cta.disabled;
  return (
    <div
      className="card"
      style={{
        padding: "0.75rem 0.9rem",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        borderLeft: card.mentorTag === "OUTSTANDING_PERFORMANCE"
          ? "3px solid #a855f7"
          : card.mentorTag === "FOLLOW_UP_NEEDED"
          ? "3px solid #ef4444"
          : "3px solid var(--color-primary, #6b21c8)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <Link
          href={`/mentorship/mentees/${card.menteeId}`}
          style={{ textDecoration: "none", color: "inherit", flex: 1 }}
        >
          <strong style={{ fontSize: "0.9rem" }}>{card.menteeName}</strong>
        </Link>
        <MentorTagDropdown mentorshipId={card.mentorshipId} currentTag={card.mentorTag} />
      </div>

      {card.menteePrimaryRole && (
        <span className="pill" style={{ fontSize: "0.68rem", width: "fit-content" }}>
          {formatEnum(card.menteePrimaryRole)}
        </span>
      )}

      {card.kickoffPending && (
        <span
          style={{
            fontSize: "0.7rem",
            background: "#fef3c7",
            color: "#92400e",
            borderRadius: 4,
            padding: "2px 6px",
            fontWeight: 600,
            width: "fit-content",
          }}
        >
          Kickoff needed
        </span>
      )}

      <RatingDots ratings={card.latestRatings} />

      <div style={{ marginTop: 2 }}>
        {isMuted ? (
          <span style={{ fontSize: "0.73rem", color: "var(--muted)", fontStyle: "italic" }}>
            {card.cta.label}
          </span>
        ) : (
          <Link
            href={card.cta.href!}
            className={`button ${card.cta.variant === "primary" ? "primary" : "secondary"} small`}
            style={{ fontSize: "0.78rem", textDecoration: "none" }}
          >
            {card.cta.label} →
          </Link>
        )}
      </div>
    </div>
  );
}

function Column({ col }: { col: SimplifiedKanbanColumn }) {
  return (
    <div style={{ minWidth: 240, maxWidth: 280, flex: "1 0 240px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.4rem 0.7rem",
          background: "var(--surface-alt, #f1f5f9)",
          borderRadius: "var(--radius-md, 8px)",
          borderLeft: `3px solid ${col.accent}`,
        }}
      >
        <strong style={{ fontSize: "0.82rem" }}>{col.label}</strong>
        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{col.cards.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 40 }}>
        {col.cards.length === 0 ? (
          <div style={{ fontSize: "0.73rem", color: "var(--muted)", fontStyle: "italic", textAlign: "center", padding: "0.75rem 0.4rem" }}>
            —
          </div>
        ) : (
          col.cards.map((c) => <KanbanCard key={c.mentorshipId} card={c} />)
        )}
      </div>
    </div>
  );
}

export function MentorDashboard({ columns, inactive, total }: Props) {
  if (total === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>No active mentees yet</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Mentees appear here once matched by your program admin.
        </p>
      </div>
    );
  }

  const allDone =
    columns.find((c) => c.key === "FEEDBACK_COMPLETED")?.cards.length === total - inactive.length &&
    total > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {allDone && (
        <div
          className="card"
          style={{
            background: "#dcfce7",
            borderLeft: "4px solid #166534",
            padding: "0.75rem 1rem",
          }}
        >
          <strong style={{ color: "#166534" }}>Inbox zero.</strong>{" "}
          <span style={{ color: "#166534" }}>Every active mentee has completed feedback this cycle.</span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 12,
          alignItems: "flex-start",
        }}
      >
        {columns.map((col) => (
          <Column key={col.key} col={col} />
        ))}
      </div>

      {inactive.length > 0 && (
        <details className="card" style={{ padding: "0.75rem 1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
            Inactive / Paused ({inactive.length})
          </summary>
          <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {inactive.map((c) => (
              <KanbanCard key={c.mentorshipId} card={c} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
