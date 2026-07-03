import Link from "next/link";

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
  WorkspaceOpportunity,
  WorkspaceTimelineEvent,
  WorkspaceTone,
} from "@/lib/mentorship/workspace";
import type { LoadedHierarchy } from "@/lib/growth/queries";

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

function SectionHeading({
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

export function OverviewSection({ workspace }: { workspace: MentorshipWorkspace }) {
  const { overview, developmentPlan, checkIns, opportunities, relationships } = workspace;
  const concerns =
    overview.record?.signals.filter((s) => s.lane === "concern") ?? [];

  return (
    <div className="flex flex-col gap-4">
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
          <FieldBlock label="Current mentor" value={overview.mentorName ?? "None assigned"} />
          <FieldBlock
            label="Current focus"
            value={overview.currentFocus ?? "Not set yet — log a check-in to capture it."}
          />
        </div>

        {overview.nextAction ? (
          <div className="flex flex-col gap-3 rounded-[12px] border border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-700">
                Next recommended action
              </p>
              <p className="m-0 mt-1 text-[14px] font-semibold text-ink">
                {overview.nextAction.reason ?? overview.nextAction.label}
              </p>
              {overview.upcomingFollowUp ? (
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                  {overview.upcomingFollowUp.label} · {overview.upcomingFollowUp.dateLabel}
                </p>
              ) : null}
            </div>
            <ButtonLink href={overview.nextAction.href} variant="primary" size="sm">
              {overview.nextAction.label}
            </ButtonLink>
          </div>
        ) : overview.upcomingFollowUp ? (
          <p className="m-0 text-[12.5px] text-ink-muted">
            {overview.upcomingFollowUp.label} · {overview.upcomingFollowUp.dateLabel}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label={
              developmentPlan.progressBasis === "goals" ? "Goals done" : "Actions done"
            }
            value={
              developmentPlan.progressBasis === "none"
                ? "—"
                : `${developmentPlan.progressPct}%`
            }
          />
          <MiniStat label="Active goals" value={String(developmentPlan.activeGoals)} />
          <MiniStat label="Check-ins" value={String(checkIns.length)} />
          <MiniStat label="Opportunities" value={String(opportunities.length)} />
        </div>
      </CardV2>

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

      {relationships.lastConversationLabel ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Last conversation on {relationships.lastConversationLabel}.
        </p>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2">
      <p className="m-0 text-[18px] font-bold leading-tight text-ink">{value}</p>
      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

/* ---------------------------- Development Plan ---------------------------- */

const GROWTH_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "brand",
  ACHIEVED: "success",
  ARCHIVED: "neutral",
};

export function DevelopmentPlanSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const { developmentPlan } = workspace;
  const { hierarchy } = developmentPlan;
  const goals = [
    ...hierarchy.visions.flatMap((v) => v.goals),
    ...hierarchy.looseGoals,
  ];

  return (
    <div className="flex flex-col gap-4">
      {developmentPlan.progressBasis !== "none" ? (
        <CardV2 padding="lg" className="flex flex-col gap-3">
          <SectionHeading
            title="Development plan"
            description="Long-term goals, milestones, and skills this person is building."
          />
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${developmentPlan.progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-[12.5px] font-semibold text-ink">
              {developmentPlan.progressLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px] text-ink-muted">
            <span>{developmentPlan.activeGoals} active</span>
            <span>·</span>
            <span>{developmentPlan.achievedGoals} achieved</span>
            <span>·</span>
            <span>{developmentPlan.totalGoals} total goals</span>
          </div>
        </CardV2>
      ) : null}

      {goals.length === 0 ? (
        <EmptyStateV2
          title="No development plan yet"
          body="Goals appear here once a mentorship plan is set — either from a mentor match or added directly."
          action={
            workspace.accessLevel === "leadership" ? (
              <ButtonLink href="/admin/mentorship?tab=assignments" size="sm" variant="secondary">
                Assign a mentor
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal }: { goal: LoadedHierarchy["looseGoals"][number] }) {
  const milestones = goal.milestones;
  const directActions = goal.directActions;
  return (
    <CardV2 padding="md" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[14px] font-semibold text-ink">{goal.title}</h3>
        <StatusBadge tone={GROWTH_STATUS_TONE[goal.status ?? "ACTIVE"] ?? "neutral"}>
          {(goal.status ?? "active").toLowerCase()}
        </StatusBadge>
      </div>
      {milestones.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[13px] text-ink">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  m.status === "ACHIEVED" ? "bg-success-700" : "bg-brand-400"
                )}
              />
              <span className={m.status === "ACHIEVED" ? "text-ink-muted line-through" : ""}>
                {m.title}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {directActions.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {directActions.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-[12.5px] text-ink-muted">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  a.completedAt || a.status === "DONE" ? "bg-success-700" : "bg-line"
                )}
              />
              <span className={a.completedAt || a.status === "DONE" ? "line-through" : ""}>
                {a.title}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </CardV2>
  );
}

/* ------------------------------- Check-Ins -------------------------------- */

export function CheckInsSection({ workspace }: { workspace: MentorshipWorkspace }) {
  const { checkIns } = workspace;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Check-ins"
        description="Every conversation — wins, challenges, decisions, and commitments — in one place."
        action={
          workspace.canRecordCheckIn && workspace.activeMentorshipId ? (
            <CheckInComposer
              subjectId={workspace.person.id}
              mentorshipId={workspace.activeMentorshipId}
              participantOptions={workspace.participantOptions}
              personName={workspace.person.name}
            />
          ) : null
        }
      />
      {checkIns.length === 0 ? (
        <EmptyStateV2
          title="No check-ins yet"
          body={
            workspace.canRecordCheckIn
              ? "Log the first conversation to start the record."
              : "Conversations logged by this person's mentor will appear here."
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

function CheckInCard({ checkIn }: { checkIn: ConversationRecordView }) {
  const kindLabel =
    checkIn.kind === "MEETING"
      ? "Meeting"
      : checkIn.kind === "CONVERSATION"
        ? "Conversation"
        : "Check-in";
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone="brand">{kindLabel}</StatusBadge>
          <span className="text-[13px] font-semibold text-ink">{checkIn.dateLabel}</span>
          {checkIn.rating != null ? (
            <span className="text-[12px] text-ink-muted">{checkIn.rating}/5</span>
          ) : null}
        </div>
        {checkIn.authorName ? (
          <span className="text-[12px] text-ink-muted">by {checkIn.authorName}</span>
        ) : null}
      </div>

      {checkIn.participantNames.length > 0 ? (
        <p className="m-0 text-[12px] text-ink-muted">
          With {checkIn.participantNames.join(", ")}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {checkIn.wins ? <FieldBlock label="Wins" value={checkIn.wins} /> : null}
        {checkIn.challenges ? <FieldBlock label="Challenges" value={checkIn.challenges} /> : null}
        {checkIn.discussion ? <FieldBlock label="Discussion" value={checkIn.discussion} /> : null}
        {checkIn.decisions ? <FieldBlock label="Decisions" value={checkIn.decisions} /> : null}
        {checkIn.commitments ? (
          <FieldBlock label="Commitments" value={checkIn.commitments} />
        ) : null}
        {!checkIn.wins &&
        !checkIn.challenges &&
        !checkIn.discussion &&
        !checkIn.decisions &&
        !checkIn.commitments ? (
          <p className="m-0 text-[13px] text-ink">{checkIn.notes}</p>
        ) : null}
      </div>

      {checkIn.followUpLabel ? (
        <div>
          <StatusBadge tone={checkIn.followUpOverdue ? "danger" : "info"}>
            Follow-up {checkIn.followUpLabel}
          </StatusBadge>
        </div>
      ) : null}
    </CardV2>
  );
}

/* -------------------------------- Timeline -------------------------------- */

export function TimelineSection({ workspace }: { workspace: MentorshipWorkspace }) {
  const { timeline } = workspace;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Timeline"
        description="The complete story of this relationship — newest first."
      />
      {timeline.length === 0 ? (
        <EmptyStateV2
          title="Nothing on the timeline yet"
          body="Check-ins, reviews, milestones, and recognition will appear here as they happen."
        />
      ) : (
        <CardV2 padding="md">
          <ol className="m-0 flex list-none flex-col p-0">
            {timeline.map((event, i) => (
              <TimelineRow key={`${event.kind}-${event.atISO}-${i}`} event={event} />
            ))}
          </ol>
        </CardV2>
      )}
    </div>
  );
}

function TimelineRow({ event }: { event: WorkspaceTimelineEvent }) {
  return (
    <li className="flex gap-3 py-2">
      <span className="w-[92px] shrink-0 pt-0.5 text-[11.5px] font-semibold text-ink-muted">
        {event.dateLabel}
      </span>
      <span
        aria-hidden
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", EVENT_DOT[event.tone])}
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{event.label}</span>
        {event.detail ? (
          <span className="block text-[12.5px] text-ink-muted">{event.detail}</span>
        ) : null}
      </span>
    </li>
  );
}

/* ---------------------------- Growth Opportunities ------------------------ */

const OPPORTUNITY_TONE: Record<string, StatusTone> = {
  computed: "info",
  recommended: "brand",
};

export function OpportunitiesSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const { opportunities } = workspace;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Growth opportunities"
        description="Recommended next moves — teach a class, shadow, apply for leadership, lead a project."
      />
      {opportunities.length === 0 ? (
        <EmptyStateV2
          title="No open opportunities"
          body="Suggestions appear here as this person progresses, or when a mentor recommends one."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {opportunities.map((opp) => (
            <OpportunityCard key={`${opp.source}-${opp.id}`} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({ opp }: { opp: WorkspaceOpportunity }) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={OPPORTUNITY_TONE[opp.source]}>
            {opp.source === "recommended" ? "Recommended" : "Suggested"}
          </StatusBadge>
          <h3 className="m-0 text-[14px] font-semibold text-ink">{opp.title}</h3>
        </div>
        {opp.href ? (
          <ButtonLink href={opp.href} size="sm" variant="secondary">
            Open
          </ButtonLink>
        ) : null}
      </div>
      {opp.detail ? (
        <p className="m-0 text-[13px] text-ink">{opp.detail}</p>
      ) : null}
      {opp.reason ? (
        <p className="m-0 text-[12px] text-ink-muted">Why: {opp.reason}</p>
      ) : null}
    </CardV2>
  );
}

/* ------------------------------ Relationships ----------------------------- */

export function RelationshipsSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const { relationships } = workspace;
  const facts: Array<{ label: string; value: string }> = [
    { label: "Primary mentor", value: relationships.primaryMentorName ?? "None assigned" },
    { label: "Relationship start", value: relationships.startedAtLabel ?? "—" },
    { label: "Last conversation", value: relationships.lastConversationLabel ?? "None yet" },
    { label: "Conversation cadence", value: relationships.cadenceLabel ?? "Not established" },
    {
      label: "Upcoming follow-ups",
      value: String(relationships.upcomingFollowUps),
    },
    { label: "Overall progress", value: workspace.developmentPlan.progressLabel },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Relationship"
        description="Who supports this person, and how the relationship is going."
      />
      <CardV2 padding="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <FieldBlock key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </div>
      </CardV2>

      {relationships.reviewCycles.length > 0 ? (
        <CardV2 padding="md" className="flex flex-col gap-2">
          <SectionHeading title="Active review cycles" />
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {relationships.reviewCycles.map((cycle) => (
              <li
                key={cycle.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <Link
                  href={`/mentorship/cycles/${cycle.id}`}
                  className="text-[13px] font-semibold text-ink hover:text-brand-700 hover:underline"
                >
                  {cycle.name}
                </Link>
                <StatusBadge tone="info">{cycle.stageLabel}</StatusBadge>
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}
    </div>
  );
}
