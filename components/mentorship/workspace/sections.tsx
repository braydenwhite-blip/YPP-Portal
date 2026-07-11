import {
  ButtonLink,
  CardV2,
  EmptyStateV2,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/components/ui-v2";
import type {
  ConversationRecordView,
  MentorshipWorkspace,
  WorkspaceTimelineEvent,
  WorkspaceTone,
} from "@/lib/mentorship/workspace";
import { updateMentorshipActionItemStatus } from "@/lib/mentorship-hub-actions";

import { CheckInComposer } from "./check-in-composer";

/* ------------------------------- shared bits ------------------------------ */

const EVENT_DOT: Record<WorkspaceTone, string> = {
  danger: "bg-danger-700",
  warning: "bg-warning-700",
  info: "bg-info-700",
  brand: "bg-brand-600",
  success: "bg-success-700",
  neutral: "bg-line",
};

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-ink">{title}</h2>
        {description ? (
          <p className="m-0 mt-1 text-[13px] text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      <p className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{value}</p>
    </div>
  );
}

/* -------------------------------- Overview -------------------------------- */

/**
 * Overview answers: what matters now, what changed, what happens next.
 * Relationship context (the old Relationships tab) and recent activity (the
 * old Timeline tab) fold in here; the one canonical next action comes from
 * the lifecycle engine — the same state every POV reads.
 */
export function OverviewSection({
  workspace,
  children,
  /** When true, skip the mentor/goals summary card (mentee dashboard already shows it). */
  skipSummary = false,
}: {
  workspace: MentorshipWorkspace;
  /** Host-supplied extras (leadership controls, self help card) render at the end. */
  children?: React.ReactNode;
  skipSummary?: boolean;
}) {
  const { overview, relationships, goals, checkIns, lifecycle } = workspace;
  const concerns =
    overview.record?.signals.filter((s) => s.lane === "concern") ?? [];
  const openCommitments = workspace.commitments.filter((c) => !c.completed);

  return (
    <div className="flex flex-col gap-4">
      {!skipSummary ? (
        <CardV2 padding="lg" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge tone={workspace.activeMentorshipId ? "success" : "neutral"}>
              {overview.statusLabel}
            </StatusBadge>
            {concerns.slice(0, 3).map((signal, i) => (
              <StatusBadge key={`${signal.kind}-${i}`} tone={signal.tone as StatusTone}>
                {signal.label}
              </StatusBadge>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock
              label="Mentor"
              value={
                overview.mentorName
                  ? overview.mentorEmail
                    ? `${overview.mentorName}\n${overview.mentorEmail}${
                        overview.chairName
                          ? `\nChair: ${overview.chairName}${
                              overview.chairEmail ? ` · ${overview.chairEmail}` : ""
                            }`
                          : ""
                      }`
                    : overview.chairName
                      ? `${overview.mentorName} · Chair: ${overview.chairName}`
                      : overview.mentorName
                  : "None assigned"
              }
            />
            <FieldBlock
              label="Current focus"
              value={overview.currentFocus ?? "Not set yet — log a check-in to capture it."}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              label="Goals"
              value={lifecycle.grDocStatus === "ACTIVE" ? String(goals.activeGoals) : "—"}
            />
            <MiniStat label="Check-ins" value={String(checkIns.length)} />
            <MiniStat label="Open commitments" value={String(openCommitments.length)} />
            <MiniStat label="Since" value={relationships.startedAtLabel ?? "—"} />
          </div>

          {relationships.cadenceLabel || overview.upcomingFollowUp ? (
            <p className="m-0 text-[12.5px] text-ink-muted">
              {[
                relationships.cadenceLabel,
                overview.upcomingFollowUp
                  ? `${overview.upcomingFollowUp.label} ${overview.upcomingFollowUp.dateLabel}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </CardV2>
      ) : null}

      {overview.coachingPlan ? (
        <CardV2 padding="md" className="flex flex-col gap-2">
          <SectionHeading title="Coaching plan" />
          <p className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
            {overview.coachingPlan.planOfAction}
          </p>
          <p className="m-0 text-[12px] text-ink-muted">
            From {overview.coachingPlan.mentorName}&apos;s monthly review.
          </p>
        </CardV2>
      ) : null}

      {relationships.reviewCycles.length > 0 ? (
        <CardV2 padding="md" className="flex flex-col gap-2">
          <SectionHeading title="Active review cycles" />
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {relationships.reviewCycles.map((cycle) => (
              <li key={cycle.id} className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={`/mentorship/cycles/${cycle.id}`}
                  className="text-[13px] font-semibold text-ink hover:text-brand-700 hover:underline"
                >
                  {cycle.name}
                </a>
                <StatusBadge tone="info">{cycle.stageLabel}</StatusBadge>
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      <RecentActivity timeline={workspace.timeline} />

      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2">
      <p className="m-0 truncate text-[18px] font-bold leading-tight text-ink">{value}</p>
      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

/** The old Timeline tab, folded into Overview as a compact "what changed". */
function RecentActivity({ timeline }: { timeline: WorkspaceTimelineEvent[] }) {
  if (timeline.length === 0) return null;
  const recent = timeline.slice(0, 8);
  return (
    <CardV2 padding="md" className="flex flex-col gap-2">
      <SectionHeading title="Recent activity" />
      <ol className="m-0 flex list-none flex-col p-0">
        {recent.map((event, i) => (
          <li key={`${event.kind}-${event.atISO}-${i}`} className="flex gap-3 py-1.5">
            <span className="w-[92px] shrink-0 pt-0.5 text-[11.5px] font-semibold text-ink-muted">
              {event.dateLabel}
            </span>
            <span
              aria-hidden
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", EVENT_DOT[event.tone])}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink">{event.label}</span>
              {event.detail ? (
                <span className="block text-[12px] text-ink-muted">{event.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      {timeline.length > recent.length ? (
        <p className="m-0 text-[12px] text-ink-muted">
          Older activity lives in Check-ins and Reviews.
        </p>
      ) : null}
    </CardV2>
  );
}

/* ------------------------------- Check-Ins -------------------------------- */

/**
 * Meetings: a shared log of talks that happened. Mentor and mentee can both
 * mark a meeting done — no scheduling here.
 */
export function CheckInsSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const { checkIns, commitments } = workspace;
  const open = commitments.filter((c) => !c.completed);
  const done = commitments.filter((c) => c.completed);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Meetings"
        description="Mark when you met."
        action={
          workspace.canRecordCheckIn && workspace.activeMentorshipId ? (
            <CheckInComposer
              subjectId={workspace.person.id}
              mentorshipId={workspace.activeMentorshipId}
              selfReflectionId={
                workspace.nextAction.key === "record-mentor-check-in"
                  ? workspace.lifecycle.activeReflectionId
                  : null
              }
              cycleLabel={workspace.lifecycle.cycleLabel}
              participantOptions={workspace.participantOptions}
              personName={workspace.person.name}
              isSelf={workspace.isSelf}
            />
          ) : null
        }
      />

      {open.length > 0 || done.length > 0 ? (
        <CardV2 padding="md" className="flex flex-col gap-2">
          <p className="m-0 text-[13px] font-bold text-ink">Follow-ups</p>
          {open.length === 0 ? (
            <p className="m-0 text-[12.5px] text-ink-muted">Nothing open.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {open.map((c) => (
                <CommitmentRow key={c.id} commitment={c} canToggle={workspace.canRecordCheckIn} />
              ))}
            </ul>
          )}
          {done.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-[12px] font-semibold text-ink-muted">
                Done ({done.length})
              </summary>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                {done.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-2 text-[12.5px] text-ink-muted">
                    <span className="line-through">{c.title}</span>
                    {c.completedLabel ? <span>· {c.completedLabel}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </CardV2>
      ) : null}

      {checkIns.length === 0 ? (
        <EmptyStateV2
          title="No meetings logged yet"
          body={
            workspace.canRecordCheckIn
              ? "When you meet, tap Log a meeting and pick the date."
              : "Meetings will show up here once someone logs one."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {checkIns.map((checkIn) => (
            <CheckInCard key={checkIn.id} checkIn={checkIn} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommitmentRow({
  commitment,
  canToggle,
}: {
  commitment: MentorshipWorkspace["commitments"][number];
  canToggle: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-medium text-ink">{commitment.title}</p>
        <p className="m-0 text-[12px] text-ink-muted">
          {[
            commitment.ownerName ? `Owner: ${commitment.ownerName}` : null,
            commitment.dueLabel
              ? commitment.overdue
                ? `was due ${commitment.dueLabel}`
                : `due ${commitment.dueLabel}`
              : null,
            commitment.fromReviewLabel,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {commitment.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
        {canToggle ? (
          <form action={updateMentorshipActionItemStatus}>
            <input type="hidden" name="itemId" value={commitment.id} />
            <input type="hidden" name="status" value="COMPLETE" />
            <button
              type="submit"
              className="rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-soft"
            >
              Mark done
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function CheckInCard({ checkIn }: { checkIn: ConversationRecordView }) {
  const kindLabel =
    checkIn.kind === "MEETING"
      ? "Meeting"
      : checkIn.kind === "CONVERSATION"
        ? "Conversation"
        : "Check-in";
  const note =
    checkIn.discussion ||
    checkIn.notes ||
    [checkIn.wins, checkIn.challenges, checkIn.decisions, checkIn.commitments]
      .filter(Boolean)
      .join(" · ");

  return (
    <CardV2 padding="md" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone="success">Done</StatusBadge>
          <StatusBadge tone="brand">{kindLabel}</StatusBadge>
          <span className="text-[13px] font-semibold text-ink">{checkIn.dateLabel}</span>
        </div>
        {checkIn.authorName ? (
          <span className="text-[12px] text-ink-muted">Logged by {checkIn.authorName}</span>
        ) : null}
      </div>

      {note ? (
        <p className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{note}</p>
      ) : null}
    </CardV2>
  );
}
