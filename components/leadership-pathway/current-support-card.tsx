import Link from "next/link";
import type { LeadershipMentorView } from "@/lib/leadership-context";

interface CurrentSupportCardProps {
  mentor: LeadershipMentorView | null;
}

/**
 * "Your support right now" card for the Leadership Pathway page. The pathway is
 * the long-term map; this card connects it to the concrete support that moves
 * the user through it — their mentor and a clear way into the mentorship home.
 *
 * It deliberately stays compact: it surfaces who supports you + one CTA, and
 * leaves the full mentor card, goals, and reflection to /my-mentor rather than
 * duplicating the whole mentee dashboard here.
 */
export function CurrentSupportCard({ mentor }: CurrentSupportCardProps) {
  if (mentor) {
    const kickoffPending = !mentor.kickoffCompletedAt;
    return (
      <section
        className="card"
        aria-label="Your mentorship support"
        style={{ borderLeft: "4px solid var(--color-primary, #7c3aed)", display: "grid", gap: 10 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)" }}>
              Your support right now
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.95rem" }}>
              <strong>{mentor.name}</strong>
              {mentor.roleLabel ? (
                <span className="muted"> · {mentor.roleLabel}</span>
              ) : null}
            </p>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem", lineHeight: 1.5, maxWidth: "56ch" }}>
              {kickoffPending
                ? "Your mentor helps you move through this pathway — start with your kickoff meeting."
                : "Your mentor helps you move through this pathway with monthly check-ins and goals."}
            </p>
          </div>
          <Link href="/my-mentor" className="button small">
            View My Mentorship →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="card"
      aria-label="Your mentorship support"
      style={{ display: "grid", gap: 8 }}
    >
      <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)" }}>
        Your support right now
      </p>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.55, maxWidth: "56ch" }}>
        When you&apos;re paired with a mentor, they&apos;ll appear here — your mentor is the
        support that helps you move through this pathway.
      </p>
      <Link href="/my-mentor" className="button secondary small" style={{ justifySelf: "start" }}>
        Go to My Mentorship →
      </Link>
    </section>
  );
}

export default CurrentSupportCard;
