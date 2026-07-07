import Link from "next/link";
import {
  LeadershipStageId,
  MENTORSHIP_PATTERN,
} from "@/lib/leadership-pathway";
import type { LeadershipMentorView } from "@/lib/leadership-context";

interface SupportLineProps {
  mentor: LeadershipMentorView | null;
  stageId: LeadershipStageId | null;
}

function formatLastTogether(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * The "who supports you" line — one warm sentence below focus areas.
 *
 * For paired users: shows mentor name + role label + last-connected
 * warmth. Renders as a single line, NOT a card — the role hero owns
 * the visual weight, this is supporting context.
 *
 * For unpaired users: pulls from MENTORSHIP_PATTERN[stageId] for an
 * organic description of how mentorship flows at this stage (e.g.,
 * "Instructors are mentored by Senior Instructors, Lead Instructors,
 * or Chapter Presidents."). No CTA noise — identity, not action.
 */
export function SupportLine({ mentor, stageId }: SupportLineProps) {
  if (mentor) {
    const last = formatLastTogether(mentor.lastSessionAt);
    const kickoffPending = !mentor.kickoffCompletedAt;

    return (
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--muted)",
          lineHeight: 1.6,
          maxWidth: "64ch",
        }}
      >
        Coached by{" "}
        <Link
          href="/mentorship?view=me"
          style={{
            color: "var(--text)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {mentor.name}
        </Link>
        {mentor.roleLabel ? (
          <>
            <span aria-hidden> · </span>
            <span>{mentor.roleLabel}</span>
          </>
        ) : null}
        {kickoffPending ? (
          <>
            <span aria-hidden> · </span>
            <span style={{ color: "#92400e", fontWeight: 600 }}>
              Kickoff pending
            </span>
          </>
        ) : last ? (
          <>
            <span aria-hidden> · </span>
            <span>Last together {last}</span>
          </>
        ) : null}
      </p>
    );
  }

  const fallback = stageId ? MENTORSHIP_PATTERN[stageId] : null;
  if (!fallback) return null;

  return (
    <p
      style={{
        margin: 0,
        fontSize: 13,
        color: "var(--muted)",
        lineHeight: 1.6,
        maxWidth: "64ch",
      }}
    >
      {fallback}
    </p>
  );
}
