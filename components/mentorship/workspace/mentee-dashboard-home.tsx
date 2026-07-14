import { ButtonLink, CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

/**
 * Simple mentee home: mentor contact + goals snapshot.
 */

const GOAL_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  NONE: { label: "Not started", tone: "neutral" },
  DRAFT: { label: "Being set up", tone: "info" },
  PENDING_APPROVAL: { label: "Almost ready", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
};

function Line({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          className="m-0 break-all text-[13.5px] font-medium text-brand-700 hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="m-0 break-all text-[13.5px] font-medium text-ink">{value}</p>
      )}
    </div>
  );
}

export function MenteeDashboardHome({
  workspace,
  goalsHref,
  checkInsHref,
  reviewsHref,
}: {
  workspace: MentorshipWorkspace;
  goalsHref: string;
  checkInsHref: string;
  reviewsHref: string;
}) {
  const { overview, goals, lifecycle, relationships } = workspace;
  const status = GOAL_STATUS[goals.docStatus] ?? {
    label: goals.docStatus,
    tone: "neutral" as StatusTone,
  };
  const goalsReady = goals.docStatus === "ACTIVE";

  return (
    <div className="flex flex-col gap-4">
      <CardV2 padding="lg" className="flex flex-col gap-4">
        <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-ink">Your mentor</h2>
        {overview.mentorName ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Line label="Name" value={overview.mentorName} />
            <Line
              label="Email"
              value={overview.mentorEmail}
              href={overview.mentorEmail ? `mailto:${overview.mentorEmail}` : null}
            />
            {overview.chairName ? (
              <>
                <Line label="Chair" value={overview.chairName} />
                <Line
                  label="Chair email"
                  value={overview.chairEmail}
                  href={overview.chairEmail ? `mailto:${overview.chairEmail}` : null}
                />
              </>
            ) : null}
            <Line label="Started" value={relationships.startedAtLabel} />
            <Line label="Last talk" value={relationships.lastConversationLabel} />
          </div>
        ) : (
          <p className="m-0 text-[13.5px] text-ink-muted">
            No mentor yet. Someone will pair you soon.
          </p>
        )}
      </CardV2>

      <CardV2
        padding="lg"
        className="relative overflow-hidden border-l-[3px] border-l-brand-600"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-brand-50/70 to-transparent" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-ink">
                Your goals
              </h2>
              <p className="m-0 mt-1 max-w-[42ch] text-[13px] leading-relaxed text-ink-muted">
                {goals.docTitle ??
                  (goalsReady
                    ? "What you're working on this cycle."
                    : "Goals show up here after your first meeting and setup.")}
              </p>
            </div>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>

          {goalsReady ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniStat label="Open" value={String(goals.activeGoals)} />
              <MiniStat label="Done" value={String(goals.completedGoals)} />
              <MiniStat
                label="First meeting"
                value={lifecycle.kickoffComplete ? "Done" : "Not yet"}
                emphasize={!lifecycle.kickoffComplete}
              />
            </div>
          ) : (
            <div className="rounded-[12px] border border-dashed border-line bg-surface-soft/80 px-4 py-4">
              <p className="m-0 text-[14px] font-semibold text-ink">
                {lifecycle.kickoffComplete
                  ? "Goals are being set up."
                  : "First meeting still needed."}
              </p>
              <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-muted">
                {lifecycle.kickoffComplete
                  ? "Once they're ready, you'll see them here and under Goals."
                  : "After you and your mentor meet once, goals can be assigned."}
              </p>
            </div>
          )}

          {overview.currentFocus ? (
            <div className="rounded-[12px] border border-line-soft bg-white/80 px-3.5 py-3">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                Working on
              </p>
              <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink">
                {overview.currentFocus}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
            <ButtonLink href={goalsHref} size="sm">
              {goalsReady ? "Open goals →" : "Goals tab →"}
            </ButtonLink>
            <ButtonLink href={checkInsHref} variant="secondary" size="sm">
              Meetings
            </ButtonLink>
            <ButtonLink href={reviewsHref} variant="secondary" size="sm">
              Feedback
            </ButtonLink>
          </div>
        </div>
      </CardV2>
    </div>
  );
}

function MiniStat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? "rounded-[12px] border border-warning-200 bg-warning-50 px-3.5 py-3"
          : "rounded-[12px] border border-line-soft bg-white/90 px-3.5 py-3 shadow-[0_1px_0_rgba(28,26,46,0.03)]"
      }
    >
      <p className="m-0 truncate text-[20px] font-bold leading-none tracking-[-0.3px] text-ink">
        {value}
      </p>
      <p className="m-0 mt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}
