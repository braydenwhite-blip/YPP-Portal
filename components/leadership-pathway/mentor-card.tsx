import {
  LEADERSHIP_STAGES,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

export interface MentorCardData {
  name: string;
  email: string;
  phone: string | null;
  roleLabel: string;
  stageId: LeadershipStageId | null;
  chapterName: string | null;
  mentorshipId: string;
  trackName: string | null;
  kickoffCompletedAt: string | null;
  lastSessionAt: string | null;
}

interface MentorCardProps {
  mentor: MentorCardData;
  menteeStageId: LeadershipStageId | null;
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.max(0, Math.round((Date.now() - then) / 86400000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/**
 * A calm, typographic mentor card. No avatar bubble, no paragraph
 * blurb — just name, role, the line of contact a mentee actually
 * uses, and a tiny "last connected" chip when relevant.
 */
export function MentorCard({ mentor }: MentorCardProps) {
  const stage = mentor.stageId ? LEADERSHIP_STAGES[mentor.stageId] : null;
  const accent = stage?.color.accent ?? "var(--muted)";
  const last = formatRelative(mentor.lastSessionAt);
  const kickoffPending = !mentor.kickoffCompletedAt;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderLeft: `3px solid ${accent}`,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeftWidth: 3,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        Your mentor
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginTop: 4,
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.005em",
          }}
        >
          {mentor.name}
        </h3>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {mentor.roleLabel}
        </span>
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: "var(--muted)",
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
        }}
      >
        <a
          href={`mailto:${mentor.email}`}
          style={{
            color: "var(--text)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          {mentor.email}
        </a>
        {mentor.phone && (
          <>
            <span aria-hidden>·</span>
            <a
              href={`tel:${mentor.phone}`}
              style={{
                color: "var(--text)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {mentor.phone}
            </a>
          </>
        )}
        {mentor.chapterName && (
          <>
            <span aria-hidden>·</span>
            <span>{mentor.chapterName}</span>
          </>
        )}
      </div>

      {(last || kickoffPending) && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: kickoffPending ? "#92400e" : "var(--muted)",
            fontWeight: kickoffPending ? 600 : 500,
          }}
        >
          {kickoffPending ? "Kickoff not yet held" : `Last together ${last}`}
        </div>
      )}
    </div>
  );
}
