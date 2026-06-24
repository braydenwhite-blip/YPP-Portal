/**
 * Read-only render of a Summer Workshop Instructor's workshop outline.
 *
 * Used on the applicant detail/review pages to give reviewers a clean,
 * structured view of the outline submitted in place of a full course
 * outline / first-class plan.
 *
 * Soft warnings are surfaced inline (plan §6.7) via the shared `BannerV2`.
 * Reviewers stay in control — nothing here hard-blocks the review.
 */

import { BannerV2 } from "@/components/ui-v2";
import { workshopOutlineWarnings, type WorkshopOutline } from "@/lib/summer-workshop";

interface WorkshopOutlinePanelProps {
  outline: WorkshopOutline | null | undefined;
}

function NotProvided({ children = "Not provided" }: { children?: string }) {
  return <em className="not-italic text-ink-muted">{children}</em>;
}

export default function WorkshopOutlinePanel({ outline }: WorkshopOutlinePanelProps) {
  const warnings = workshopOutlineWarnings(outline ?? null);
  const hasOutline = !!outline;

  return (
    <section
      id="section-workshop-outline"
      className="rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card"
    >
      <div className="mb-4 grid gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">
          Summer Workshop
        </span>
        <h2>Workshop Outline</h2>
      </div>

      {!hasOutline && (
        <BannerV2 tone="warning" role="status">
          Workshop outline is missing. The applicant did not submit a workshop
          outline.
        </BannerV2>
      )}

      {hasOutline && warnings.length > 0 && (
        <BannerV2
          tone="warning"
          role="status"
          title="Soft warning:"
          className="mb-3 items-start"
        >
          <span>this outline has gaps. Reviewers may still proceed.</span>
          <ul className="mt-1.5 ml-[18px] list-disc">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </BannerV2>
      )}

      {hasOutline && (
        <dl className="grid grid-cols-[minmax(120px,220px)_minmax(0,1fr)] gap-x-[18px] gap-y-2.5 [&_dt]:m-0 [&_dt]:text-[11.5px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.05em] [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:whitespace-pre-wrap [&_dd]:text-[13.5px] [&_dd]:text-ink">
          <dt>Title</dt>
          <dd>{outline!.title || <NotProvided />}</dd>

          <dt>Age range</dt>
          <dd>{outline!.ageRange || <NotProvided />}</dd>

          <dt>Duration</dt>
          <dd>
            {outline!.durationMinutes ? (
              `${outline!.durationMinutes} minutes`
            ) : (
              <NotProvided />
            )}
          </dd>

          <dt>Learning goals</dt>
          <dd>
            {outline!.learningGoals?.length ? (
              <ul className="m-0 list-disc pl-[18px]">
                {outline!.learningGoals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            ) : (
              <NotProvided />
            )}
          </dd>

          <dt>Activity flow</dt>
          <dd className="whitespace-pre-wrap">
            {outline!.activityFlow || <NotProvided />}
          </dd>

          <dt>Materials</dt>
          <dd>
            {outline!.materialsNeeded?.length ? (
              <ul className="m-0 list-disc pl-[18px]">
                {outline!.materialsNeeded.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            ) : (
              <NotProvided>None listed</NotProvided>
            )}
          </dd>

          <dt>Engagement hook</dt>
          <dd className="whitespace-pre-wrap">
            {outline!.engagementHook || <NotProvided />}
          </dd>

          <dt>Adaptation notes</dt>
          <dd className="whitespace-pre-wrap">
            {outline!.adaptationNotes || <NotProvided />}
          </dd>
        </dl>
      )}
    </section>
  );
}
