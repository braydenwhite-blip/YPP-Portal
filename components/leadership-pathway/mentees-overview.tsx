import Link from "next/link";
import type { LeadershipMenteeView } from "@/lib/leadership-context";
import { LEADERSHIP_STAGES } from "@/lib/leadership-pathway";

interface MenteesOverviewProps {
  mentees: LeadershipMenteeView[];
}

/**
 * Calm, dignified "instructors I mentor" panel. Surfaced on Profile
 * and Leadership Pathway pages — gives a mentor visibility into the
 * leaders they're developing without the kanban overhead of /mentorship.
 */
export function MenteesOverview({ mentees }: MenteesOverviewProps) {
  if (mentees.length === 0) return null;

  return (
    <section
      style={{
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h2
          className="section-title"
          style={{ margin: 0, fontSize: 16 }}
        >
          Instructors I mentor
        </h2>
        <Link
          href="/mentorship/mentees"
          className="button small secondary"
          style={{ fontSize: 12 }}
        >
          Open mentor view →
        </Link>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--muted)",
          lineHeight: 1.5,
        }}
      >
        You&apos;re part of someone&apos;s growth story. Stay in touch, share what
        you&apos;re seeing, and recommend them when they&apos;re ready for what&apos;s next.
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 8,
          gridTemplateColumns:
            "repeat(auto-fill, minmax(260px, 1fr))",
        }}
      >
        {mentees.map((mentee) => {
          const stage = mentee.stage;
          const tone = stage?.color ?? {
            bg: "var(--surface)",
            border: "var(--border)",
            text: "var(--text)",
            accent: "var(--muted)",
          };
          return (
            <li
              key={mentee.id}
              style={{
                padding: "12px 14px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 12,
                minWidth: 0,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: tone.bg,
                  border: `1.5px solid ${tone.border}`,
                  color: tone.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  flex: "0 0 auto",
                }}
              >
                {initials(mentee.name)}
              </div>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={mentee.name}
                >
                  {mentee.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {mentee.roleLabel}
                  {mentee.chapterName ? ` · ${mentee.chapterName}` : ""}
                </div>
              </div>
              {!mentee.kickoffCompletedAt && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#fef3c7",
                    color: "#92400e",
                    fontSize: 11,
                    fontWeight: 600,
                    flex: "0 0 auto",
                  }}
                  title="Kickoff meeting not yet held"
                >
                  Kickoff
                </span>
              )}
              <Link
                href={`/mentorship/mentees/${mentee.id}`}
                className="button small secondary"
                style={{ flex: "0 0 auto", fontSize: 12 }}
              >
                Open
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footnote: this is what the system uses the data for — calm transparency. */}
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "var(--muted)",
          fontStyle: "italic",
        }}
      >
        Stage labels reflect each instructor&apos;s current role at YPP based on their
        mentorship and committee responsibilities.
      </p>

      {/* Distribution mini-bar */}
      <StageDistribution mentees={mentees} />
    </section>
  );
}

function StageDistribution({ mentees }: { mentees: LeadershipMenteeView[] }) {
  const counts = mentees.reduce<Record<string, number>>((acc, m) => {
    const key = m.stage?.id ?? "UNKNOWN";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const order = [
    "WORKSHOP_INSTRUCTOR",
    "INSTRUCTOR",
    "SENIOR_INSTRUCTOR",
    "LEAD_INSTRUCTOR",
    "ORGANIZATIONAL_LEADERSHIP",
  ] as const;
  const present = order.filter((id) => counts[id] && counts[id] > 0);
  if (present.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        fontSize: 11,
        color: "var(--muted)",
      }}
    >
      {present.map((id) => {
        const stage = LEADERSHIP_STAGES[id];
        return (
          <span
            key={id}
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: stage.color.bg,
              border: `1px solid ${stage.color.border}`,
              color: stage.color.text,
              fontWeight: 600,
            }}
          >
            {counts[id]} {stage.label}
          </span>
        );
      })}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
