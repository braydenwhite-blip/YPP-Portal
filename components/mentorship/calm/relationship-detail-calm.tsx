import {
  PrimaryFocusCard,
  SimpleListCard,
} from "@/components/command-center/simple";
import { StatusBadge, type StatusTone } from "@/components/ui-v2";

/**
 * Calm relationship detail — the shared summary both the mentor workspace and
 * the admin relationship record lead with in Calm mode. It answers "what is
 * this relationship and what's the one next move?" in a single glance: a status
 * pill, the next-step focus card, the active goals, and the open commitments.
 * The full record (sessions, reviews, forms, ops context) stays one toggle away
 * in Executive mode, so this component never re-implements any of it.
 */

export type CalmDetailFocus = {
  eyebrow: string;
  title: string;
  reason?: string;
  ctaLabel: string;
  ctaHref: string;
  tone?: "brand" | "success";
};

export type CalmDetailFact = {
  id: string;
  title: string;
  meta?: string | null;
  status?: { label: string; tone: StatusTone } | null;
};

function CalmFactRow({ fact }: { fact: CalmDetailFact }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{fact.title}</span>
        {fact.meta ? (
          <span className="block truncate text-[12.5px] text-ink-muted">{fact.meta}</span>
        ) : null}
      </span>
      {fact.status ? (
        <StatusBadge tone={fact.status.tone}>{fact.status.label}</StatusBadge>
      ) : null}
    </div>
  );
}

export function RelationshipDetailCalm({
  status,
  contextLine,
  focus,
  goals,
  goalsEmpty = "No active goals on file yet.",
  commitments,
  commitmentsEmpty = "No open commitments right now.",
  recentSession,
}: {
  status: { label: string; tone: StatusTone };
  contextLine?: string | null;
  focus: CalmDetailFocus;
  goals: CalmDetailFact[];
  goalsEmpty?: string;
  commitments: CalmDetailFact[];
  commitmentsEmpty?: string;
  /** Latest completed session — title + a friendly when-label. Mentee-safe. */
  recentSession?: { title: string; whenLabel: string } | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        {contextLine ? (
          <span className="text-[13px] text-ink-muted">{contextLine}</span>
        ) : null}
      </div>

      {recentSession ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Last session: <span className="font-semibold text-ink">{recentSession.title}</span> ·{" "}
          {recentSession.whenLabel}
        </p>
      ) : null}

      <PrimaryFocusCard
        eyebrow={focus.eyebrow}
        title={focus.title}
        reason={focus.reason}
        tone={focus.tone === "success" ? "success" : "brand"}
        ctaLabel={focus.ctaLabel}
        ctaHref={focus.ctaHref}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SimpleListCard
          title="Active goals"
          empty={
            goals.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-muted">{goalsEmpty}</p>
            ) : undefined
          }
        >
          {goals.map((goal) => (
            <CalmFactRow key={goal.id} fact={goal} />
          ))}
        </SimpleListCard>

        <SimpleListCard
          title="Open commitments"
          empty={
            commitments.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-muted">{commitmentsEmpty}</p>
            ) : undefined
          }
        >
          {commitments.map((commitment) => (
            <CalmFactRow key={commitment.id} fact={commitment} />
          ))}
        </SimpleListCard>
      </div>
    </div>
  );
}
