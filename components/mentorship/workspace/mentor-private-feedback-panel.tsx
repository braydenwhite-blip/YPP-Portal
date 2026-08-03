import { InstructorFeedbackSection } from "@/components/instructor/instructor-feedback-section";
import { RequestParentFeedbackButton } from "@/components/mentorship/workspace/request-parent-feedback-button";
import { loadInstructorReviewContext } from "@/lib/instructor-feedback-actions";

const SOURCE_LABEL: Record<string, string> = {
  PARENT: "Parent",
  BOARD: "Board",
  MENTOR: "Colleague",
  OFFICER: "Officer",
  STUDENT: "Student",
  PARTNER: "Partner",
};

const SOURCE_TONE: Record<string, string> = {
  PARENT: "bg-sky-50 text-sky-800",
  BOARD: "bg-violet-50 text-violet-800",
  MENTOR: "bg-brand-50 text-brand-800",
  OFFICER: "bg-amber-50 text-amber-900",
  STUDENT: "bg-emerald-50 text-emerald-800",
  PARTNER: "bg-rose-50 text-rose-800",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Mentor-only scratchpad under the performance review form.
 * One quiet list + one add form — no multi-section dump.
 */
export async function MentorPrivateFeedbackPanel({
  menteeId,
  menteeFirstName,
  reviewId,
}: {
  menteeId: string;
  menteeFirstName: string;
  reviewId?: string | null;
}) {
  let ctx: Awaited<ReturnType<typeof loadInstructorReviewContext>> | null = null;
  try {
    ctx = await loadInstructorReviewContext(menteeId, { reviewId });
  } catch {
    return null;
  }

  const rows = ctx.received;
  const count = rows.length;

  return (
    <details className="overflow-hidden rounded-[14px] border border-[#e8e4f0] bg-white shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden hover:bg-[#faf8ff]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-semibold text-[#2e1065]">
              Notes about {menteeFirstName}
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
              From people they worked with · private to you
            </p>
          </div>
          <span className="inline-flex items-center gap-2">
            {count > 0 ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-800">
                {count} note{count === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="rounded-full bg-[#f3f0f8] px-2.5 py-1 text-[12px] font-medium text-ink-muted">
                None yet
              </span>
            )}
            <span className="text-[12px] font-medium text-brand-700">
              {count > 0 ? "View / add" : "Add note"}
            </span>
          </span>
        </div>
      </summary>

      <div className="grid gap-5 border-t border-[#e8e4f0] px-5 py-5 lg:grid-cols-[1fr_1.05fr]">
        {/* Existing notes */}
        <div>
          <p className="m-0 mb-3 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            Saved notes
          </p>
          {rows.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[#e0dae9] bg-[#faf8ff] px-4 py-6 text-center">
              <p className="m-0 text-[13.5px] text-ink-muted">
                Nothing logged yet. Add a note from someone {menteeFirstName}{" "}
                worked with, or ask parents to share feedback.
              </p>
              <div className="mt-3.5 flex justify-center">
                <RequestParentFeedbackButton
                  instructorId={menteeId}
                  label="Request feedback"
                  variant="secondary"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 flex justify-end">
                <RequestParentFeedbackButton
                  instructorId={menteeId}
                  label="Request feedback"
                  variant="ghost"
                />
              </div>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-[12px] border border-[#eeeaf5] bg-[#faf8ff] px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          SOURCE_TONE[row.source] ?? "bg-brand-50 text-brand-800",
                        ].join(" ")}
                      >
                        {SOURCE_LABEL[row.source] ?? row.source}
                      </span>
                      <time
                        className="text-[11.5px] text-ink-muted"
                        dateTime={row.feedbackDate}
                      >
                        {formatDate(row.feedbackDate)}
                      </time>
                    </div>
                    <p className="m-0 mt-2 text-[13px] font-semibold text-ink">
                      {row.category}
                      <span className="font-normal text-ink-muted">
                        {" "}
                        · {row.rating}/5
                      </span>
                    </p>
                    {row.comment ? (
                      <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
                        {row.comment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Add form — single unified entry */}
        <div className="rounded-[12px] border border-[#e8e4f0] bg-[#faf8ff] p-4">
          <p className="m-0 mb-3 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            Add a note
          </p>
          {ctx.canLogReceivedFeedback ? (
            <InstructorFeedbackSection
              instructorId={menteeId}
              canEdit
              initialRows={[]}
              embed
              formOnly
              defaultCategory="Collaboration"
              sources={[
                { value: "OFFICER", label: "Officer / lead" },
                { value: "MENTOR", label: "Colleague / co-mentor" },
                { value: "PARENT", label: "Parent" },
                { value: "PARTNER", label: "Partner" },
                { value: "BOARD", label: "Board" },
                { value: "STUDENT", label: "Student" },
              ]}
            />
          ) : (
            <p className="m-0 text-[13px] text-ink-muted">
              You don&apos;t have permission to log feedback here.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
