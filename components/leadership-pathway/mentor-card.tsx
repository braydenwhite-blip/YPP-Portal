import Link from "next/link";
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
  /** Mentor data resolved via lib/leadership-context. */
  mentor: MentorCardData;
  /** The mentee's own stage — controls the mentorship-pattern explainer. */
  menteeStageId: LeadershipStageId | null;
}

function formatRelativeDays(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.max(0, Math.round((Date.now() - then) / 86400000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/**
 * The warm, prestige-forward card for "this is your mentor."
 * Shows mentor name, their role/stage, how to reach them, when you
 * last connected, and an inline explanation of the YPP mentorship
 * pattern at this level (so the relationship feels deliberate, not
 * arbitrary).
 */
export function MentorCard({ mentor, menteeStageId }: MentorCardProps) {
  const stage = mentor.stageId ? LEADERSHIP_STAGES[mentor.stageId] : null;
  const tone = stage?.color ?? {
    bg: "var(--surface)",
    border: "var(--border)",
    text: "var(--text)",
    accent: "var(--accent)",
  };

  const lastContactLabel = formatRelativeDays(mentor.lastSessionAt);
  const kickoffPending = !mentor.kickoffCompletedAt;

  const patternBlurb = menteeStageId
    ? mentorshipBlurbFor(menteeStageId)
    : "Your mentor is here to help you grow at YPP — meet regularly, share what's working, and ask for help where you need it.";

  return (
    <div
      className="card"
      style={{
        padding: 18,
        background: tone.bg,
        border: `1.5px solid ${tone.border}`,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: tone.accent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
            flex: "0 0 auto",
          }}
        >
          {initials(mentor.name)}
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: tone.text,
              opacity: 0.8,
            }}
          >
            Your mentor
          </div>
          <h3
            style={{
              margin: "2px 0 4px",
              fontSize: 20,
              fontWeight: 700,
              color: tone.text,
              wordBreak: "break-word",
            }}
          >
            {mentor.name}
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              fontSize: 13,
              color: "var(--text)",
            }}
          >
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.7)",
                border: `1px solid ${tone.border}`,
                color: tone.text,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {mentor.roleLabel}
            </span>
            {mentor.chapterName && (
              <span style={{ color: "var(--muted)" }}>·</span>
            )}
            {mentor.chapterName && (
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                {mentor.chapterName}
              </span>
            )}
            {mentor.trackName && (
              <>
                <span style={{ color: "var(--muted)" }}>·</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {mentor.trackName} track
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <Link
            href="/mentorship"
            className="button small"
            style={{
              background: tone.accent,
              color: "#fff",
              border: "none",
              textDecoration: "none",
            }}
          >
            Open mentorship →
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.6)",
          border: "1px solid rgba(0,0,0,0.04)",
          borderRadius: 8,
        }}
      >
        <ContactLine label="Email" value={mentor.email} href={`mailto:${mentor.email}`} />
        <ContactLine
          label="Phone"
          value={mentor.phone}
          href={mentor.phone ? `tel:${mentor.phone}` : null}
        />
        <ContactLine
          label="Last connected"
          value={
            kickoffPending
              ? "Kickoff not yet held"
              : lastContactLabel
                ? `Together ${lastContactLabel}`
                : "No session logged yet"
          }
          highlight={
            kickoffPending
              ? "warm"
              : lastContactLabel == null
                ? "warm"
                : null
          }
        />
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text)",
          opacity: 0.92,
        }}
      >
        {patternBlurb}
      </p>
    </div>
  );
}

function ContactLine({
  label,
  value,
  href = null,
  highlight = null,
}: {
  label: string;
  value: string | null;
  href?: string | null;
  highlight?: "warm" | null;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      {value ? (
        href ? (
          <a
            href={href}
            style={{
              fontSize: 13,
              color: highlight === "warm" ? "#92400e" : "var(--text)",
              textDecoration: "none",
              wordBreak: "break-word",
              fontWeight: highlight === "warm" ? 600 : 500,
            }}
          >
            {value}
          </a>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: highlight === "warm" ? "#92400e" : "var(--text)",
              fontWeight: highlight === "warm" ? 600 : 500,
              wordBreak: "break-word",
            }}
          >
            {value}
          </div>
        )
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
          Not provided
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mentorshipBlurbFor(stageId: LeadershipStageId): string {
  switch (stageId) {
    case "WORKSHOP_INSTRUCTOR":
      return "As a workshop instructor, you're paired with someone experienced who'll help you get oriented and decide what's next at YPP.";
    case "INSTRUCTOR":
      return "Instructors are mentored by Senior Instructors, Lead Instructors, or Chapter Presidents. Your mentor is here to coach your teaching, family relationships, and growth toward the Senior Instructor role.";
    case "SENIOR_INSTRUCTOR":
      return "Senior Instructors are mentored by Lead Instructors or Chapter Presidents. Your mentor focuses on your leadership impact and your path toward becoming a Lead Instructor.";
    case "LEAD_INSTRUCTOR":
      return "Lead Instructors are mentored by the global leadership team. The conversation here is about how you're shaping YPP and developing the next generation of leaders.";
    case "ORGANIZATIONAL_LEADERSHIP":
      return "Across the global leadership team, mentorship runs peer-to-peer — focused on strategy, stewardship, and growing the next set of leaders.";
  }
}
