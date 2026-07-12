import { prisma } from "@/lib/prisma";
import { Button, ButtonLink } from "@/components/ui-v2";
import { createMentorshipNextStep } from "@/lib/mentorship-hub-actions";

/**
 * Quick mentor shortcuts — Feedback tab does the writing; this is optional capture.
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
    select: { id: true },
  });
  if (!mentorship) return null;

  const inputClass =
    "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-line-card bg-surface p-5 shadow-card">
      <div>
        <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-ink">Quick tools</h2>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">Shortcuts — most work lives in the tabs above.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={`/mentorship/people/${menteeId}?section=reviews`}
          size="sm"
          variant="secondary"
        >
          Send feedback
        </ButtonLink>
        <ButtonLink href="/mentorship/resources" size="sm" variant="secondary">
          Resources
        </ButtonLink>
      </div>

      <details className="rounded-[12px] border border-line-soft bg-surface-soft p-4">
        <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
          Add a follow-up
        </summary>
        <form action={createMentorshipNextStep} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="menteeId" value={menteeId} />
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <input
            name="title"
            required
            placeholder="One clear next step"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dueAt" className={inputClass} aria-label="Due date" />
            <Button type="submit" variant="secondary" size="sm">
              Add
            </Button>
          </div>
        </form>
      </details>
    </section>
  );
}
