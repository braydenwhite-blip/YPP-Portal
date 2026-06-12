/**
 * Read-only render of a Summer Workshop Instructor's workshop outline.
 *
 * Used on the applicant detail/review pages to give reviewers a clean,
 * structured view of the outline submitted in place of a full course
 * outline / first-class plan.
 *
 * Soft warnings are surfaced inline (plan §6.7). Reviewers stay in control —
 * nothing here hard-blocks the review.
 */

import { workshopOutlineWarnings, type WorkshopOutline } from "@/lib/summer-workshop";

interface WorkshopOutlinePanelProps {
  outline: WorkshopOutline | null | undefined;
}

export default function WorkshopOutlinePanel({ outline }: WorkshopOutlinePanelProps) {
  const warnings = workshopOutlineWarnings(outline ?? null);
  const hasOutline = !!outline;

  return (
    <section id="section-workshop-outline" className="rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card">
      <div className="mb-4 grid gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">Summer Workshop</span>
        <h2>Workshop Outline</h2>
      </div>

      {!hasOutline && (
        <p
          role="status"
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Workshop outline is missing. The applicant did not submit a workshop outline.
        </p>
      )}

      {hasOutline && warnings.length > 0 && (
        <div
          role="status"
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          <strong>Soft warning:</strong> this outline has gaps. Reviewers may still proceed.
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {hasOutline && (
        <dl className="grid grid-cols-[minmax(120px,220px)_minmax(0,1fr)] gap-x-[18px] gap-y-2.5 [&_dt]:m-0 [&_dt]:text-[11.5px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.05em] [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:whitespace-pre-wrap [&_dd]:text-[13.5px] [&_dd]:text-ink">
          <dt>Title</dt>
          <dd>{outline!.title || <em style={{ color: "var(--muted)" }}>Not provided</em>}</dd>

          <dt>Age range</dt>
          <dd>{outline!.ageRange || <em style={{ color: "var(--muted)" }}>Not provided</em>}</dd>

          <dt>Duration</dt>
          <dd>
            {outline!.durationMinutes
              ? `${outline!.durationMinutes} minutes`
              : <em style={{ color: "var(--muted)" }}>Not provided</em>}
          </dd>

          <dt>Learning goals</dt>
          <dd>
            {outline!.learningGoals?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {outline!.learningGoals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            ) : (
              <em style={{ color: "var(--muted)" }}>Not provided</em>
            )}
          </dd>

          <dt>Activity flow</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {outline!.activityFlow || <em style={{ color: "var(--muted)" }}>Not provided</em>}
          </dd>

          <dt>Materials</dt>
          <dd>
            {outline!.materialsNeeded?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {outline!.materialsNeeded.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            ) : (
              <em style={{ color: "var(--muted)" }}>None listed</em>
            )}
          </dd>

          <dt>Engagement hook</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {outline!.engagementHook || <em style={{ color: "var(--muted)" }}>Not provided</em>}
          </dd>

          <dt>Adaptation notes</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {outline!.adaptationNotes || <em style={{ color: "var(--muted)" }}>Not provided</em>}
          </dd>
        </dl>
      )}
    </section>
  );
}
