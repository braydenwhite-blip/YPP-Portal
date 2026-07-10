import Link from "next/link";
import type { LeadershipMenteeView } from "@/lib/leadership-context";

interface MenteesOverviewProps {
  mentees: LeadershipMenteeView[];
}

/**
 * A tight, typographic list of the instructors a mentor develops.
 * One row per mentee, role inline, kickoff warning surfaced only
 * when relevant. No avatars, no distribution chart, no footnote.
 */
export function MenteesOverview({ mentees }: MenteesOverviewProps) {
  if (mentees.length === 0) return null;

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          You mentor {mentees.length} instructor
          {mentees.length === 1 ? "" : "s"}
        </h3>
        <Link
          href="/mentorship/mentees"
          style={{
            fontSize: 12,
            color: "var(--accent, #6b21c8)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open mentor view →
        </Link>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        {mentees.map((mentee, idx) => (
          <li
            key={mentee.id}
            style={{
              padding: "12px 16px",
              borderBottom:
                idx === mentees.length - 1 ? "none" : "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <Link
                href={`/people/${mentee.id}`}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  textDecoration: "none",
                }}
              >
                {mentee.name}
              </Link>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  marginLeft: 8,
                }}
              >
                {mentee.roleLabel}
                {mentee.chapterName ? ` · ${mentee.chapterName}` : ""}
              </span>
            </div>
            {!mentee.kickoffCompletedAt && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#92400e",
                  flex: "0 0 auto",
                }}
                title="Kickoff meeting not yet held"
              >
                Kickoff pending
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
