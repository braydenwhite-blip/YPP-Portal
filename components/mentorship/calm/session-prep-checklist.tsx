import Link from "next/link";

import { CcIcon } from "@/components/command-center/icons";

/**
 * A calm, come-prepared checklist for the upcoming session (Calm Mentorship,
 * Phase 5). Not persisted — it's a gentle prompt so a mentee (or mentor) walks
 * in ready, with a direct link to the goals & review the session is building
 * toward. Defaults cover the common prep; callers can override the items.
 */

const DEFAULT_ITEMS = [
  "Skim your latest reflection and active goals",
  "Note one win and one thing you're stuck on",
  "Confirm the time and meeting link",
  "Bring one question for your mentor",
];

export function SessionPrepChecklist({
  items = DEFAULT_ITEMS,
  reviewHref,
  reviewLabel = "Open your goals & review",
}: {
  items?: string[];
  reviewHref?: string;
  reviewLabel?: string;
}) {
  return (
    <section className="flex flex-col rounded-[18px] border border-line-soft bg-surface/80 p-4 shadow-card backdrop-blur">
      <h3 className="m-0 mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        Come prepared
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-ink">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <CcIcon name="check" size={11} />
            </span>
            {item}
          </li>
        ))}
      </ul>
      {reviewHref ? (
        <Link
          href={reviewHref}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
        >
          {reviewLabel} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </section>
  );
}
