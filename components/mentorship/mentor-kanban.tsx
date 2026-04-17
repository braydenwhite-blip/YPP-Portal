import { MentorKanbanCard } from "@/components/mentorship/mentor-kanban-card";
import type { KanbanColumn } from "@/lib/mentorship-kanban-actions";

type Props = {
  active: KanbanColumn[];
  inactive: KanbanColumn;
  total: number;
};

export function MentorKanban({ active, inactive, total }: Props) {
  if (total === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 24 }}>
        <p style={{ color: "var(--muted)" }}>
          You have no active mentees yet. Mentees appear here once matched by your program admin.
        </p>
      </div>
    );
  }

  const activeCount = active.reduce((s, c) => s + c.cards.length, 0);
  const allApproved =
    activeCount > 0 &&
    active.filter((c) => c.key === "APPROVED").reduce((s, c) => s + c.cards.length, 0) === activeCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {allApproved && (
        <div
          className="card"
          style={{
            background: "#dcfce7",
            borderLeft: "4px solid #166534",
            padding: "0.75rem 1rem",
          }}
        >
          <strong style={{ color: "#166534" }}>Inbox zero for this cycle.</strong>{" "}
          <span style={{ color: "#166534" }}>
            Every active mentee has an approved review — nice work.
          </span>
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
        {active.map((col) => (
          <div
            key={col.key}
            style={{
              minWidth: 260,
              maxWidth: 280,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: "1 0 260px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.4rem 0.6rem",
                background: "var(--surface-alt, #f1f5f9)",
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--border, #e2e8f0)",
              }}
            >
              <strong style={{ fontSize: "0.85rem" }}>{col.label}</strong>
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                {col.cards.length}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 40,
              }}
            >
              {col.cards.length === 0 ? (
                <div
                  className="muted"
                  style={{
                    fontSize: "0.75rem",
                    textAlign: "center",
                    padding: "0.75rem 0.4rem",
                    fontStyle: "italic",
                  }}
                >
                  —
                </div>
              ) : (
                col.cards.map((c) => <MentorKanbanCard key={c.mentorshipId} card={c} />)
              )}
            </div>
          </div>
        ))}
      </div>

      {inactive.cards.length > 0 && (
        <details className="card" style={{ padding: "0.75rem 1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Inactive ({inactive.cards.length})
          </summary>
          <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {inactive.cards.map((c) => (
              <MentorKanbanCard key={c.mentorshipId} card={c} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
