import Link from "next/link";
import type {
  SimplifiedKanbanCard,
  SimplifiedKanbanColumn,
} from "@/lib/mentorship-kanban-actions";
import { formatEnum } from "@/lib/format-utils";
import { PeopleAvatar } from "@/components/people-strategy/people-suite";
import { MentorTagDropdown } from "./mentor-tag-dropdown";

interface MentorPriorityListProps {
  columns: SimplifiedKanbanColumn[];
  inactive: SimplifiedKanbanCard[];
  total: number;
}

type Group = {
  key: "NEEDS_YOU_NOW" | "IN_PROGRESS" | "SETTLED";
  label: string;
  helper: string;
  cards: SimplifiedKanbanCard[];
  /** Whether CTAs should be visually prominent in this group. */
  prominent: boolean;
};

const URGENT_REASON: Record<string, string> = {
  KICKOFF_PENDING: "Kickoff pending",
  REFLECTION_SUBMITTED: "Waiting on you",
  CHANGES_REQUESTED: "Awaiting your revisions",
};

/**
 * Whether a mentee card is waiting on the mentor right now — a kickoff to
 * run, a reflection to review, or a follow-up the mentor flagged. Shared with
 * the command strip so the "Needs you now" count and group always match.
 */
export function mentorCardNeedsAttention(card: SimplifiedKanbanCard): boolean {
  return (
    card.kickoffPending ||
    card.cycleStage === "REFLECTION_SUBMITTED" ||
    card.cycleStage === "CHANGES_REQUESTED" ||
    card.mentorTag === "FOLLOW_UP_NEEDED"
  );
}

/**
 * Replaces the 5-column horizontal kanban with a prioritized single
 * vertical list. Kanbans imply that mentors *move* mentees through a
 * workflow — but mentees self-advance by submitting reflections. The
 * kanban therefore consumed 5x the horizontal space of an equivalent
 * priority-sorted list while wobbling between cycle-state columns and
 * tag-state columns.
 *
 * The same kanban data flows in unchanged; consumers reshape it into
 * three groups (Needs you now / In progress / Settled) plus the
 * existing collapsed Inactive/paused disclosure.
 */
export function MentorPriorityList({
  columns,
  inactive,
  total,
}: MentorPriorityListProps) {
  if (total === 0) {
    // Caller renders the editorial empty state in this case.
    return null;
  }

  const allCards = columns.flatMap((c) => c.cards);
  const groups = groupByPriority(allCards);

  const needsNow = groups.find((g) => g.key === "NEEDS_YOU_NOW")!;
  const isInboxZero = needsNow.cards.length === 0;

  return (
    <div style={{ display: "grid", gap: 32 }}>
      {isInboxZero && <InboxZeroHero total={total - inactive.length} />}

      {groups.map((group) =>
        group.cards.length === 0 ? null : (
          <MentorGroup key={group.key} group={group} />
        )
      )}

      {inactive.length > 0 && (
        <details
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "16px 20px",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted)",
              listStyle: "revert",
            }}
          >
            Inactive / paused ({inactive.length})
          </summary>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "16px 0 0",
              display: "grid",
              gap: 10,
            }}
          >
            {inactive.map((card) => (
              <MentorRow key={card.mentorshipId} card={card} prominent={false} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function MentorGroup({ group }: { group: Group }) {
  return (
    <section aria-labelledby={`mentor-group-${group.key}`}>
      <header style={{ marginBottom: 14 }}>
        <h3
          id={`mentor-group-${group.key}`}
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {group.label}
          <span
            aria-hidden
            style={{ color: "var(--border)", margin: "0 8px" }}
          >
            ·
          </span>
          <span style={{ letterSpacing: 0, color: "var(--muted)" }}>
            {group.cards.length}
          </span>
        </h3>
        {group.helper && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            {group.helper}
          </p>
        )}
      </header>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 10,
        }}
      >
        {group.cards.map((card) => (
          <MentorRow
            key={card.mentorshipId}
            card={card}
            prominent={group.prominent}
          />
        ))}
      </ul>
    </section>
  );
}

function MentorRow({
  card,
  prominent,
}: {
  card: SimplifiedKanbanCard;
  prominent: boolean;
}) {
  const reason = reasonForCard(card);
  const isMuted = card.cta.disabled;

  return (
    <li
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: 16,
        rowGap: 8,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0, display: "flex", gap: 12, alignItems: "center" }}>
        <PeopleAvatar name={card.menteeName} />
        <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/mentorship/people/${card.menteeId}`}
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            {card.menteeName}
          </Link>
          {card.menteePrimaryRole && (
            <span
              style={{
                fontSize: 11,
                color: "var(--muted)",
              }}
            >
              {formatEnum(card.menteePrimaryRole)}
            </span>
          )}
        </div>
        {reason && (
          <div
            style={{
              fontSize: 12,
              color: prominent ? "#92400e" : "var(--muted)",
              fontWeight: prominent ? 600 : 500,
            }}
          >
            {reason}
          </div>
        )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <MentorTagDropdown
          mentorshipId={card.mentorshipId}
          currentTag={card.mentorTag}
        />
        {isMuted ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              fontStyle: "italic",
            }}
          >
            {card.cta.label}
          </span>
        ) : (
          <Link
            href={card.cta.href!}
            className={`button ${
              prominent && card.cta.variant === "primary"
                ? "primary"
                : "secondary"
            } small`}
            style={{ whiteSpace: "nowrap" }}
          >
            {card.cta.label} →
          </Link>
        )}
      </div>
    </li>
  );
}

function InboxZeroHero({ total }: { total: number }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "28px 30px",
      }}
    >
        <h2
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, -apple-system, sans-serif",
            fontSize: "clamp(20px, 2.6vw, 26px)",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--ypp-purple-800)",
            margin: 0,
          }}
        >
        You&apos;re caught up.
      </h2>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 14,
          color: "var(--muted)",
          lineHeight: 1.55,
        }}
      >
        {total > 0
          ? `${total} mentee${total === 1 ? "" : "s"} in progress — nothing waiting on you right now.`
          : "Nothing waiting on you right now."}
      </p>
    </section>
  );
}

function groupByPriority(cards: SimplifiedKanbanCard[]): Group[] {
  const needsNow: SimplifiedKanbanCard[] = [];
  const inProgress: SimplifiedKanbanCard[] = [];
  const settled: SimplifiedKanbanCard[] = [];

  for (const card of cards) {
    if (mentorCardNeedsAttention(card)) {
      needsNow.push(card);
    } else if (
      card.cycleStage === "KICKOFF_PENDING" ||
      card.cycleStage === "REFLECTION_DUE"
    ) {
      inProgress.push(card);
    } else {
      settled.push(card);
    }
  }

  // Sort "Needs you now": kickoff-pending first, then ready-for-review, then follow-up.
  const needsPriority: Record<string, number> = {
    kickoff: 0,
    review: 1,
    followup: 2,
  };
  needsNow.sort((a, b) => priorityValue(a) - priorityValue(b));
  function priorityValue(card: SimplifiedKanbanCard): number {
    if (card.kickoffPending) return needsPriority.kickoff;
    if (
      card.cycleStage === "REFLECTION_SUBMITTED" ||
      card.cycleStage === "CHANGES_REQUESTED"
    )
      return needsPriority.review;
    return needsPriority.followup;
  }

  return [
    {
      key: "NEEDS_YOU_NOW",
      label: "Needs you now",
      helper: needsNow.length
        ? "Mentees waiting on a kickoff, your review, or a follow-up."
        : "",
      cards: needsNow,
      prominent: true,
    },
    {
      key: "IN_PROGRESS",
      label: "In progress",
      helper: "Mentee owns the next move — you'll see them here until they submit.",
      cards: inProgress,
      prominent: false,
    },
    {
      key: "SETTLED",
      label: "Settled this cycle",
      helper: "Feedback completed or marked outstanding.",
      cards: settled,
      prominent: false,
    },
  ];
}

function reasonForCard(card: SimplifiedKanbanCard): string | null {
  if (card.kickoffPending) return URGENT_REASON.KICKOFF_PENDING;
  if (card.mentorTag === "FOLLOW_UP_NEEDED") return "Follow-up flagged";
  if (card.mentorTag === "OUTSTANDING_PERFORMANCE")
    return "Marked outstanding";
  const stageReason = URGENT_REASON[card.cycleStage];
  if (stageReason) return stageReason;
  if (card.cycleStage === "REFLECTION_DUE")
    return "Waiting on their reflection";
  if (
    card.cycleStage === "REVIEW_SUBMITTED" ||
    card.cycleStage === "APPROVED"
  )
    return "Feedback completed";
  return null;
}
