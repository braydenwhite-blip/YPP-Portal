import Link from "next/link";

/**
 * Compact mentee caseload for mentors who don't get the org-wide People roster.
 */
export function MentorCaseloadStrip({
  mentees,
}: {
  mentees: { id: string; name: string }[];
}) {
  if (mentees.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-[18px] font-bold tracking-[-0.3px] text-ink">
            Your mentees
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            Open a workspace, or go to your mentor console for the full coaching view.
          </p>
        </div>
        <Link
          href="/mentorship?view=mentor"
          className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
        >
          Mentor console →
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {mentees.map((m) => (
          <li key={m.id}>
            <Link
              href={`/mentorship/people/${m.id}`}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-4 py-3 text-ink no-underline transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="text-[14px] font-semibold">{m.name}</span>
              <span className="text-[12.5px] font-semibold text-brand-700">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
