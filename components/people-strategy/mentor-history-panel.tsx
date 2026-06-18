import type { MentorshipHistoryEntry } from "@/lib/mentorship-reassign-actions";

/**
 * Mentor assignment history (Phase 4 surface). Read-only timeline of who has
 * mentored this person — current first — preserving the full trail across any
 * number of transfers. Admin/officer-gated by the caller.
 */
export function MentorHistoryPanel({
  personName,
  entries,
}: {
  personName: string;
  entries: MentorshipHistoryEntry[];
}) {
  if (entries.length === 0) return null;

  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <section className="card" style={{ padding: "16px 18px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
        Mentor history
      </h2>
      <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
        Every mentor {personName} has had, preserved across reassignments.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((e) => {
          const current = e.endedAt === null;
          return (
            <li
              key={e.id}
              style={{
                borderLeft: `3px solid ${current ? "var(--ps-accent, #2563eb)" : "var(--ps-border, #e5e7eb)"}`,
                paddingLeft: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {e.mentorName}
                {e.focusArea ? (
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                    {" "}· {e.focusArea === "INSTRUCTION" ? "Instruction" : "Leadership"}
                  </span>
                ) : null}
                {e.isTemporary ? (
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}> · temporary</span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {fmt(e.startedAt)} — {current ? "present" : fmt(e.endedAt as Date)}
                {current ? " · current" : ""}
              </div>
              {e.reason ? (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{e.reason}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
