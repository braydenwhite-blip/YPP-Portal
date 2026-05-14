import Link from "next/link";
import { LEADERSHIP_STAGES, LeadershipStageId } from "@/lib/leadership-pathway";

interface RoleStripProps {
  stageId: LeadershipStageId | null;
  nextStageId: LeadershipStageId | null;
  mentorName: string | null;
  mentorRoleLabel: string | null;
  /** Optional ID used to deep-link the "view mentor" affordance. */
  showMentorLink?: boolean;
}

/**
 * One-line role chip used on profile, personalization, and the G&R
 * page. Replaces the prior stack of full cards on those surfaces.
 *
 *   Instructor → Senior Instructor   ·   Mentored by Sarah Lin   ·   Pathway →
 */
export function RoleStrip({
  stageId,
  nextStageId,
  mentorName,
  mentorRoleLabel,
  showMentorLink = true,
}: RoleStripProps) {
  if (!stageId) return null;
  const stage = LEADERSHIP_STAGES[stageId];
  const nextStage = nextStageId ? LEADERSHIP_STAGES[nextStageId] : null;

  return (
    <div
      style={{
        padding: "10px 14px",
        borderLeft: `3px solid ${stage.color.accent}`,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeftWidth: 3,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Role
        </span>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>
          {stage.label}
        </span>
        {nextStage && (
          <span style={{ color: "var(--muted)" }}>
            <span aria-hidden> → </span>
            {nextStage.label}
          </span>
        )}
      </div>

      {mentorName && (
        <div
          style={{
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span aria-hidden>·</span>
          <span>
            Mentored by{" "}
            <span style={{ color: "var(--text)", fontWeight: 500 }}>
              {mentorName}
            </span>
            {mentorRoleLabel && (
              <span style={{ color: "var(--muted)" }}>
                {" "}
                ({mentorRoleLabel})
              </span>
            )}
          </span>
        </div>
      )}

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        {showMentorLink && mentorName && (
          <Link
            href="/my-mentor"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            My mentor →
          </Link>
        )}
        <Link
          href="/leadership-pathway"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: stage.color.text,
            textDecoration: "none",
          }}
        >
          Pathway →
        </Link>
      </div>
    </div>
  );
}
