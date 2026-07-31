import { InstructorFeedbackSection } from "@/components/instructor/instructor-feedback-section";
import { MentorshipNotesPanel } from "@/components/mentorship/workspace/mentorship-notes-panel";
import type { InstructorReviewContext } from "@/lib/instructor-feedback-actions";
import { loadInstructorReviewContext } from "@/lib/instructor-feedback-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";

function formatMonth(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const SOURCE_LABEL: Record<string, string> = {
  PARENT: "Parent",
  BOARD: "Board",
  MENTOR: "Mentor",
  OFFICER: "Officer",
  STUDENT: "Student",
  PARTNER: "Partner",
};

/**
 * Mentorship review evidence. Collect Parent / Board / Mentor / Officer
 * feedback about the mentee — not instructor class-parent surveys.
 */
export async function InstructorReviewFeedbackContext({
  instructorId,
  reviewId,
  density = "calm",
}: {
  instructorId: string;
  reviewId?: string | null;
  density?: "calm" | "full";
}) {
  try {
    const ctx = await loadInstructorReviewContext(instructorId, { reviewId });
    return (
      <ReviewEvidenceInline menteeId={instructorId} ctx={ctx} density={density} />
    );
  } catch {
    return null;
  }
}

export function ReviewEvidenceInline({
  menteeId,
  ctx,
  density = "calm",
}: {
  menteeId: string;
  ctx: InstructorReviewContext;
  density?: "calm" | "full";
}) {
  const parentRows = ctx.received.filter((r) => r.source === "PARENT");
  const boardRows = ctx.received.filter((r) => r.source === "BOARD");
  const mentorRows = ctx.received.filter((r) => r.source === "MENTOR");
  const officerRows = ctx.received.filter((r) => r.source === "OFFICER");
  const otherRows = ctx.received.filter(
    (r) => r.source === "STUDENT" || r.source === "PARTNER"
  );

  if (density === "full") {
    return (
      <div className="flex flex-col gap-5">
        <SourceFeedbackBlock
          title="Parent feedback"
          hint="What a parent shared about this mentee"
          menteeId={menteeId}
          rows={parentRows}
          lockedSource="PARENT"
          canLog={ctx.canLogReceivedFeedback}
          defaultCategory="Parent note"
        />

        <SourceFeedbackBlock
          title="Board feedback"
          hint="Board or leadership observations"
          menteeId={menteeId}
          rows={boardRows}
          lockedSource="BOARD"
          canLog={ctx.canLogReceivedFeedback}
          defaultCategory="Board note"
        />

        <SourceFeedbackBlock
          title="Mentor feedback"
          hint="Notes from another mentor or co-mentor"
          menteeId={menteeId}
          rows={mentorRows}
          lockedSource="MENTOR"
          canLog={ctx.canLogReceivedFeedback}
          defaultCategory="Mentor note"
        />

        <SourceFeedbackBlock
          title="Officer feedback"
          hint="Officer observations with date, category, rating, and comments"
          menteeId={menteeId}
          rows={officerRows}
          lockedSource="OFFICER"
          canLog={ctx.canLogReceivedFeedback}
          defaultCategory="Observation"
        />

        <PreviousReviewsSection reviews={ctx.priorMentorReviews} />

        <FeedbackHistoryTimeline entries={ctx.timeline} />

        <MentorshipNotesPanel
          menteeId={menteeId}
          initialNotes={ctx.mentorshipNotes}
          canEdit={ctx.canEditFeedback}
          compact
        />

        {otherRows.length > 0 ? (
          <details className="rounded-[12px] border border-line-soft px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink">
              Student or partner feedback
            </summary>
            <div className="mt-3">
              <InstructorFeedbackSection
                instructorId={menteeId}
                canEdit={ctx.canLogReceivedFeedback}
                initialRows={otherRows}
                embed
                sources={[
                  { value: "STUDENT", label: "Student" },
                  { value: "PARTNER", label: "Partner" },
                ]}
              />
            </div>
          </details>
        ) : null}

        {(ctx.notes.length > 0 || ctx.recentCheckIns.length > 0) && (
          <details className="rounded-[12px] border border-line-soft px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink">
              Reflections &amp; meeting notes
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              {ctx.notes.length > 0 ? <ReflectionCompact notes={ctx.notes} /> : null}
              {ctx.recentCheckIns.length > 0 ? (
                <CheckInsCompact rows={ctx.recentCheckIns} />
              ) : null}
            </div>
          </details>
        )}
      </div>
    );
  }

  // Calm: mentorship feedback timeline + log Parent/Board/Mentor/Officer.
  const preview = ctx.timeline.slice(0, 5);
  const rest = ctx.timeline.slice(5);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="m-0 text-[15px] font-semibold text-ink">What others said</h3>
        <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
          Parent, board, mentor, and officer feedback collected in mentorship
        </p>
        {preview.length > 0 ? (
          <ul className="m-0 mt-3 list-none divide-y divide-line-soft border-t border-line-soft p-0">
            {preview.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-3 text-[13px] text-ink-muted">
            Nothing logged yet — add parent, board, mentor, or officer feedback
            below.
          </p>
        )}
        {rest.length > 0 ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[13px] font-medium text-brand-700">
              Show {rest.length} older
            </summary>
            <ul className="m-0 mt-2 list-none divide-y divide-line-soft p-0">
              {rest.map((entry) => (
                <TimelineRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {ctx.canLogReceivedFeedback ? (
        <details
          className="rounded-[12px] border border-line-soft px-3.5 py-2.5"
          open={preview.length === 0}
        >
          <summary className="cursor-pointer text-[13px] font-semibold text-ink">
            Log feedback
          </summary>
          <div className="mt-3">
            <p className="m-0 mb-3 text-[12.5px] leading-relaxed text-ink-muted">
              Choose who it came from — Parent, Board, Mentor, or Officer — then
              save it on this mentee&apos;s mentorship record.
            </p>
            <InstructorFeedbackSection
              instructorId={menteeId}
              canEdit
              initialRows={ctx.received}
              embed
              defaultCategory="Mentorship"
            />
          </div>
        </details>
      ) : null}

      <MentorshipNotesPanel
        menteeId={menteeId}
        initialNotes={ctx.mentorshipNotes}
        canEdit={ctx.canEditFeedback}
        compact
      />
    </div>
  );
}

function SourceFeedbackBlock({
  title,
  hint,
  menteeId,
  rows,
  lockedSource,
  canLog,
  defaultCategory,
  compact = false,
}: {
  title: string;
  hint: string;
  menteeId: string;
  rows: InstructorReviewContext["received"];
  lockedSource: "PARENT" | "BOARD" | "MENTOR" | "OFFICER";
  canLog: boolean;
  defaultCategory: string;
  compact?: boolean;
}) {
  return (
    <section className={compact ? undefined : undefined}>
      <h3 className="m-0 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="m-0 mt-0.5 text-[13px] text-ink-muted">{hint}</p>
      <div className="mt-3">
        <InstructorFeedbackSection
          instructorId={menteeId}
          canEdit={canLog}
          initialRows={rows}
          embed
          lockedSource={lockedSource}
          defaultCategory={defaultCategory}
        />
      </div>
    </section>
  );
}

function PreviousReviewsSection({
  reviews,
}: {
  reviews: InstructorReviewContext["priorMentorReviews"];
}) {
  return (
    <section>
      <h3 className="m-0 text-[15px] font-semibold text-ink">Previous monthly reviews</h3>
      <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
        Ratings, comments, and recommendations from past months
      </p>
      {reviews.length > 0 ? (
        <ul className="m-0 mt-3 list-none space-y-3 border-t border-line-soft pt-3 p-0">
          {reviews.map((row) => (
            <li key={row.id}>
              <p className="m-0 text-[13.5px] font-medium text-ink">
                {formatMonth(row.cycleMonth)} · {getGoalRatingCopy(row.overallRating).label}
                <span className="font-normal text-ink-muted"> · {row.mentorName}</span>
              </p>
              {row.overallComments ? (
                <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] leading-5 text-ink">
                  {row.overallComments}
                </p>
              ) : null}
              {row.planOfAction ? (
                <p className="m-0 mt-1 text-[13px] text-ink-muted">
                  <span className="font-medium text-ink">Next steps:</span> {row.planOfAction}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">No prior monthly reviews yet.</p>
      )}
    </section>
  );
}

function FeedbackHistoryTimeline({
  entries,
}: {
  entries: InstructorReviewContext["timeline"];
}) {
  return (
    <section>
      <h3 className="m-0 text-[15px] font-semibold text-ink">Feedback history</h3>
      <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
        Everything in one list · newest first
      </p>
      {entries.length > 0 ? (
        <ul className="m-0 mt-3 list-none divide-y divide-line-soft border-t border-line-soft p-0">
          {entries.map((entry) => (
            <TimelineRow key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">No history yet.</p>
      )}
    </section>
  );
}

function formatTimelineRating(entry: InstructorReviewContext["timeline"][number]) {
  if (entry.rating.includes("/")) return entry.rating;
  return getGoalRatingCopy(entry.rating).label;
}

function TimelineRow({
  entry,
}: {
  entry: InstructorReviewContext["timeline"][number];
}) {
  const isMentorReview = entry.source === "MENTOR";
  const title = isMentorReview
    ? "Monthly review"
    : SOURCE_LABEL[entry.source] ?? entry.source;
  const detail = isMentorReview
    ? formatTimelineRating(entry)
    : `${entry.category} · ${formatTimelineRating(entry)}`;

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[13.5px] font-medium text-ink">
          {title}
          <span className="font-normal text-ink-muted"> · {detail}</span>
        </p>
        <time className="text-[12px] text-ink-muted" dateTime={entry.date}>
          {formatDate(entry.date)}
        </time>
      </div>
      {entry.comment ? (
        <p className="m-0 mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] leading-5 text-ink-muted">
          {entry.comment}
        </p>
      ) : null}
    </li>
  );
}

function ReflectionCompact({
  notes,
}: {
  notes: InstructorReviewContext["notes"];
}) {
  return (
    <div>
      <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        Reflections
      </p>
      <ul className="m-0 mt-2 list-none space-y-2 p-0">
        {notes.slice(0, 4).map((note) => (
          <li key={note.id} className="text-[13px] text-ink-muted">
            <span className="font-medium text-ink">{formatMonth(note.cycleMonth)}</span>
            {" — "}
            {note.overallReflection}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckInsCompact({
  rows,
}: {
  rows: InstructorReviewContext["recentCheckIns"];
}) {
  return (
    <div>
      <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        Meeting notes
      </p>
      <ul className="m-0 mt-2 list-none space-y-2 p-0">
        {rows.slice(0, 4).map((row) => (
          <li key={row.id} className="text-[13px] text-ink-muted">
            <span className="font-medium text-ink">{formatDate(row.occurredAt)}</span>
            {" — "}
            {row.notes}
          </li>
        ))}
      </ul>
    </div>
  );
}
