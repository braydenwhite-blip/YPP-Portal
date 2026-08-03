import Link from "next/link";

import {
  listMyPendingCollaboratorFeedback,
  type OutstandingCollaboratorRequest,
} from "@/lib/mentorship/collaborator-feedback-actions";

/**
 * Inbox strip: people who asked you for colleague feedback.
 * Shown on People surfaces so recipients can tap each person and write.
 */
export async function PendingFeedbackRequestsCard({
  personHrefBase,
}: {
  /** When set, rewrite `/people/:id` links (e.g. mentorship roster). */
  personHrefBase?: string;
}) {
  const pending = await listMyPendingCollaboratorFeedback();
  if (pending.length === 0) return null;

  return (
    <PendingFeedbackRequestsList
      pending={pending}
      personHrefBase={personHrefBase}
    />
  );
}

export function PendingFeedbackRequestsList({
  pending,
  personHrefBase,
}: {
  pending: OutstandingCollaboratorRequest[];
  personHrefBase?: string;
}) {
  if (pending.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[14px] border border-brand-200 bg-brand-50/50 shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
      <div className="border-b border-brand-100 px-5 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold text-ink">
          Feedback requested from you
        </h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          Tap a person to write notes for their mentor.
        </p>
      </div>
      <ul className="m-0 list-none divide-y divide-brand-100/80 p-0">
        {pending.map((row) => {
          const href = personHrefBase
            ? `${personHrefBase.replace(/\/$/, "")}/${row.subjectUserId}?giveFeedback=1`
            : row.personHref;
          return (
            <li key={row.id}>
              <Link
                href={href}
                className="flex items-center justify-between gap-3 px-5 py-3.5 no-underline transition-colors hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold text-ink">
                    {row.subjectName}
                  </span>
                  <span className="block text-[12.5px] text-ink-muted">
                    {row.requestedByName
                      ? `Requested by ${row.requestedByName}`
                      : "Mentor request"}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-medium text-brand-700">
                  Write →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
