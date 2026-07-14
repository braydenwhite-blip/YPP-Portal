import { prisma } from "@/lib/prisma";

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Browse monthly form answers — always open to mentor and mentee.
 */
export async function MenteeNotesPanel({
  mentorshipId,
  menteeFirstName,
  isSelf,
}: {
  mentorshipId: string;
  menteeFirstName: string;
  isSelf: boolean;
}) {
  const notes = await prisma.monthlySelfReflection.findMany({
    where: { mentorshipId },
    orderBy: { cycleNumber: "desc" },
    take: 12,
    select: {
      id: true,
      cycleNumber: true,
      cycleMonth: true,
      submittedAt: true,
      overallReflection: true,
      workingWell: true,
      supportNeeded: true,
      additionalReflections: true,
    },
  });

  if (notes.length === 0) {
    return (
      <section
        id="their-note"
        className="rounded-[16px] border border-dashed border-line bg-surface-soft/40 px-5 py-5"
      >
        <h3 className="m-0 text-[15px] font-bold text-ink">
          {isSelf ? "Your monthly answers" : `${menteeFirstName}'s monthly answers`}
        </h3>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          {isSelf
            ? "After you send the monthly form, your answers show up here."
            : "Nothing yet — answers show up here when they send the monthly form."}
        </p>
      </section>
    );
  }

  return (
    <section id="their-note" className="flex flex-col gap-3">
      <div>
        <h3 className="m-0 text-[15px] font-bold text-ink">
          {isSelf ? "Your monthly answers" : `${menteeFirstName}'s monthly answers`}
        </h3>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          Open any month to read what they wrote.
        </p>
      </div>

      {notes.map((note) => (
        <details
          key={note.id}
          className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-sm"
        >
          <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-[14px] text-ink">
                {formatMonth(note.cycleMonth)}
                <span className="ml-2 text-[12px] font-medium text-ink-muted">
                  Cycle {note.cycleNumber}
                </span>
              </strong>
              <span className="text-[12px] text-ink-muted">
                Sent {note.submittedAt.toLocaleDateString()}
              </span>
            </div>
          </summary>
          <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-4">
            <NoteBlock label="How was this month?" body={note.overallReflection} />
            <NoteBlock label="What went well?" body={note.workingWell} />
            <NoteBlock label="What was hard?" body={note.supportNeeded} />
            {note.additionalReflections ? (
              <NoteBlock label="Anything else" body={note.additionalReflections} />
            ) : null}
          </div>
        </details>
      ))}
    </section>
  );
}

function NoteBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </p>
      <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
        {body}
      </p>
    </div>
  );
}
