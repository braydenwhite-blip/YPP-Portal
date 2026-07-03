import { prisma } from "@/lib/prisma";
import { Button, ButtonLink } from "@/components/ui-v2";
import { CycleStatusBlock } from "@/components/mentorship/cycle-status-block";
import { getCurrentCycleMonth, getReflectionSoftDeadline } from "@/lib/mentorship-cycle";
import { createMentorshipNextStep } from "@/lib/mentorship-hub-actions";

/**
 * The mentor's authoring tools, brought onto the unified workspace so the mentor
 * runs the relationship from one page: where the review cycle stands (reused
 * `CycleStatusBlock`), one-click into the review / Goals & Resources / schedule /
 * resources, and a quick "next step" capture. Rendered only for the assigned
 * mentor/chair and leadership (never the mentee's own self-view).
 */
export async function MentorToolsPanel({
  menteeId,
  mentorshipId,
}: {
  menteeId: string;
  mentorshipId: string;
}) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      cycleStage: true,
      track: { select: { name: true } },
    },
  });
  if (!mentorship) return null;

  const cycle = getCurrentCycleMonth();
  const inputClass =
    "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-line-card bg-surface p-5 shadow-card">
      <div>
        <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-ink">Mentor tools</h2>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Run the review cycle and capture what happens next.
        </p>
      </div>

      <CycleStatusBlock
        menteeId={menteeId}
        mentorshipId={mentorship.id}
        cycleStage={mentorship.cycleStage ?? "REFLECTION_DUE"}
        trackName={mentorship.track?.name ?? null}
        cycleLabel={cycle.cycleLabel}
        softDeadline={getReflectionSoftDeadline(cycle.cycleMonth)}
      />

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/mentorship/reviews/${menteeId}`} size="sm" variant="secondary">
          Run monthly review
        </ButtonLink>
        <ButtonLink href={`/mentorship/mentees/${menteeId}/gr`} size="sm" variant="secondary">
          Goals &amp; Resources
        </ButtonLink>
        <ButtonLink href="/mentorship/schedule" size="sm" variant="secondary">
          Schedule a session
        </ButtonLink>
        <ButtonLink href="/mentorship/resources" size="sm" variant="secondary">
          Resources
        </ButtonLink>
      </div>

      <details className="rounded-[12px] border border-line-soft bg-surface-soft p-4">
        <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
          Create a next step
        </summary>
        <form action={createMentorshipNextStep} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="menteeId" value={menteeId} />
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <input
            name="title"
            required
            placeholder="One clear next step — e.g. Draft the project pitch outline"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dueAt" className={inputClass} aria-label="Due date" />
            <Button type="submit" variant="secondary" size="sm">
              Add next step
            </Button>
          </div>
        </form>
      </details>
    </section>
  );
}
