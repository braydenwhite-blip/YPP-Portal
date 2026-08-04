import { EmptyStateV2, StatusBadge } from "@/components/ui-v2";
import { getWorkspaceGRDocument } from "@/lib/gr-actions";
import { buildGrCompetencyRows } from "@/lib/mentorship/gr-competency-rows";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

import { AssignGoalsForm } from "./assign-goals-form";
import { ActivateGRButton } from "./activate-gr-button";
import { GrCompetencyExpectationsTable } from "./gr-competency-expectations";
import { ProposeChangeForm } from "./propose-change-form";

const TIME_PHASE_LABELS: Record<string, string> = {
  MONTHLY: "This cycle",
  FIRST_MONTH: "First month",
  FIRST_QUARTER: "First quarter",
  LONG_TERM: "Long-term",
  FULL_YEAR: "Long-term",
};

const COMPETENCY_TITLES = new Set(
  [
    "Impact & Results",
    "Ideas & Initiative",
    "Timeliness, Reliability & Communication",
    "Leadership, Community & Collaboration",
    "Continuity and Long-Term Potential",
    "Continuity & Long-Term Potential",
  ].map((t) => t.toLowerCase()),
);

function isCompetencyGoal(g: { title: string; kind?: string }) {
  if (g.kind === "COMPETENCY") return true;
  return COMPETENCY_TITLES.has(g.title.trim().toLowerCase());
}

/**
 * Mentorship G&R tab.
 * Primary surface: pathway competency expectations + mentor role examples.
 * Optional extras: shared resources and any time-phased goals beyond the rubric.
 */
export async function GoalsSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const personId = workspace.person.id;
  const isSelf = workspace.isSelf;
  // Never treat someone as editor of their own G&R — even admins who are also mentees.
  const canEdit =
    !isSelf &&
    (workspace.isMentor ||
      workspace.isAdmin ||
      workspace.canManageSetup ||
      workspace.accessLevel === "leadership");

  const doc = await getWorkspaceGRDocument(personId);

  const competency = buildGrCompetencyRows({
    primaryRole: workspace.person.primaryRole,
    title: workspace.person.title,
    goals: doc?.goals?.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      kind: (g as { kind?: string }).kind,
    })),
  });

  const expectationsTable = (
    <GrCompetencyExpectationsTable
      rubricLabel={competency.rubricLabel}
      currentLevelHeading={competency.currentLevelHeading}
      nextLevelHeading={competency.nextLevelHeading}
      rows={competency.rows}
      canEdit={Boolean(canEdit && workspace.activeMentorshipId)}
      mentorshipId={workspace.activeMentorshipId}
      menteeId={personId}
    />
  );

  if (!doc) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="m-0 text-[18px] font-semibold tracking-[-0.3px] text-ink">
            Goals &amp; Rubric
          </h2>
          <p className="m-0 mt-1 max-w-[60ch] text-[13.5px] leading-relaxed text-ink-muted">
            {isSelf
              ? "What is expected at your level, what promotion looks like, and any role-specific examples your mentor adds."
              : canEdit
                ? `Expectations for ${workspace.person.name}. Add specific examples in the last column when helpful.`
                : "Pathway expectations for this role."}
          </p>
        </div>

        {expectationsTable}

        {canEdit && workspace.activeMentorshipId ? (
          <details className="rounded-[12px] border border-line-soft bg-surface p-4">
            <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
              Add time-phased goals (optional)
            </summary>
            <p className="m-0 mt-2 mb-3 text-[12.5px] text-ink-muted">
              Use this only if you also need monthly or quarterly goals beyond the
              competency rubric above.
            </p>
            <AssignGoalsForm
              personId={personId}
              mentorshipId={workspace.activeMentorshipId}
            />
          </details>
        ) : null}
      </div>
    );
  }

  // Mentees wait while draft/pending; mentors can still open and activate.
  // Still show the pathway table so expectations are visible.
  if (isSelf && (doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL")) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="m-0 text-[18px] font-semibold text-ink">
            Goals &amp; Rubric
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            Role expectations are below. Your mentor is still finishing custom goals
            for {doc.template.title}.
          </p>
        </div>
        {expectationsTable}
        <EmptyStateV2
          title="Custom goals being prepared"
          body="You'll see mentor-added examples and resources here when they're ready."
        />
      </div>
    );
  }

  const activeGoals = doc.goals.filter((g) => g.lifecycleStatus === "ACTIVE");
  const extraGoals = activeGoals.filter(
    (g) => !isCompetencyGoal(g as { title: string; kind?: string }),
  );
  const resources = doc.resources.map((r) => ({
    title: r.resource.title,
    url: r.resource.url,
    description: r.resource.description,
  }));
  const hasExtras = extraGoals.length > 0 || resources.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[18px] font-semibold tracking-[-0.3px] text-ink">
            Goals &amp; Rubric
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            {isSelf
              ? "Your competency expectations and role-specific examples — shared with your mentor."
              : `${doc.template.title} — expectations below; edit role-specific examples in the last column.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={
              doc.status === "ACTIVE"
                ? "success"
                : doc.status === "PENDING_APPROVAL"
                  ? "warning"
                  : "neutral"
            }
          >
            {doc.status === "ACTIVE"
              ? "Active"
              : doc.status === "PENDING_APPROVAL"
                ? "Pending"
                : "Draft"}
          </StatusBadge>
          {canEdit && doc.status === "DRAFT" ? (
            <ActivateGRButton documentId={doc.id} />
          ) : null}
        </div>
      </div>

      {expectationsTable}

      {hasExtras ? (
        <details className="rounded-[12px] border border-line-soft bg-surface">
          <summary className="cursor-pointer list-none px-4 py-3.5 text-[13.5px] font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
            More on this G&amp;R
            <span className="mt-0.5 block text-[12.5px] font-normal text-ink-muted">
              {[
                extraGoals.length > 0
                  ? `${extraGoals.length} extra goal${extraGoals.length === 1 ? "" : "s"}`
                  : null,
                resources.length > 0
                  ? `${resources.length} resource${resources.length === 1 ? "" : "s"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-line-soft px-4 py-4">
            {extraGoals.length > 0 ? (
              <section>
                <h3 className="m-0 text-[13px] font-bold text-ink">
                  Extra goals
                </h3>
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                  Time-phased goals beyond the competency rubric above.
                </p>
                <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
                  {extraGoals.map((g) => (
                    <li
                      key={g.id}
                      className="rounded-[10px] border border-line-soft bg-surface-soft/40 px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="m-0 text-[13.5px] font-semibold text-ink">
                          {g.title}
                        </p>
                        <span className="text-[11.5px] font-medium text-ink-muted">
                          {TIME_PHASE_LABELS[g.timePhase] ?? g.timePhase}
                        </span>
                      </div>
                      {g.description?.trim() ? (
                        <p className="m-0 mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted">
                          {g.description.trim()}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {resources.length > 0 ? (
              <section>
                <h3 className="m-0 text-[13px] font-bold text-ink">Resources</h3>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                  {resources.map((r) => (
                    <li key={`${r.title}-${r.url}`}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13.5px] font-semibold text-brand-700 no-underline hover:underline"
                      >
                        {r.title}
                      </a>
                      {r.description ? (
                        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                          {r.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </details>
      ) : null}

      {canEdit ? (
        <details className="rounded-[12px] border border-line-soft bg-surface p-4">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-ink">
            Propose a change
          </summary>
          <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
            Suggest a new goal, an edit, or a removal. An admin reviews every proposal
            before the document changes.
          </p>
          <ProposeChangeForm
            documentId={doc.id}
            goals={activeGoals.map((g) => ({
              id: g.id,
              title: g.title,
              timePhase: TIME_PHASE_LABELS[g.timePhase] ?? g.timePhase,
            }))}
            sourceReviewId={doc.latestReview?.id ?? null}
          />
        </details>
      ) : null}
    </div>
  );
}

/** @deprecated Use GoalsSection — kept as alias for older imports. */
export const MenteeGoalsSection = GoalsSection;
