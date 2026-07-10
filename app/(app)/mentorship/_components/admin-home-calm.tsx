import { ButtonLink } from "@/components/ui-v2";
import { getAdminMentorshipCommandCenterData } from "@/lib/admin-mentorship-command-center";
import type { SessionUser } from "@/lib/auth-supabase";
import { loadMentorshipWorkspace } from "@/lib/mentorship/workspace";

import { AdminPeopleFinder, type MentorshipPersonIndexItem } from "./admin-people-finder";

type Workspace = NonNullable<Awaited<ReturnType<typeof loadMentorshipWorkspace>>>;

const OWNER_LABELS: Record<string, string> = {
  subject: "Mentee",
  writer: "Mentor",
  approver: "Role Chair",
  leadership: "Leadership",
};

const SETUP_KEYS = new Set([
  "assign-mentor",
  "schedule-kickoff",
  "assign-goals",
  "assign-role-chair",
]);
const QUARTERLY_KEYS = new Set([
  "start-quarterly-review",
  "revise-quarterly-review",
  "approve-quarterly-review",
  "board-approve-quarterly-review",
]);

const ACTION_PRIORITY: Record<string, number> = {
  "approve-review": 0,
  "revise-review": 1,
  "write-review": 2,
  "record-mentor-check-in": 3,
  "submit-reflection": 4,
  "assign-mentor": 5,
  "schedule-kickoff": 6,
  "assign-goals": 7,
  "assign-role-chair": 8,
  "start-quarterly-review": 9,
};

function canTakeCurrentAction(workspace: Workspace) {
  return (
    workspace.nextAction.key === workspace.cycleState.nextAction.key ||
    workspace.cycleState.availableActions.includes(workspace.cycleState.nextAction.key) ||
    (workspace.canManageSetup && SETUP_KEYS.has(workspace.cycleState.nextAction.key))
  );
}

function ownerFor(workspace: Workspace): string {
  const next = workspace.cycleState.nextAction;
  return next.ownerName ?? OWNER_LABELS[next.ownerRole] ?? next.ownerRole;
}

function groupFor(workspace: Workspace) {
  const next = workspace.cycleState.nextAction;
  if (SETUP_KEYS.has(next.key)) return "setup";
  if (QUARTERLY_KEYS.has(next.key)) return "quarterly";
  if (canTakeCurrentAction(workspace)) return "needs-me";
  if (next.ownerRole === "subject") return "waiting-mentee";
  if (next.ownerRole === "writer") return "waiting-mentor";
  if (next.ownerRole === "approver") return "waiting-chair";
  return "other";
}

const GROUPS = [
  { id: "needs-me", label: "Needs me", detail: "Actions you can complete now" },
  { id: "setup", label: "Setup needed", detail: "Repair before the cycle can continue" },
  { id: "waiting-mentee", label: "Waiting on mentee", detail: "Self-reflection or acknowledgment" },
  { id: "waiting-mentor", label: "Waiting on mentor", detail: "Check-in, update, or revision" },
  { id: "waiting-chair", label: "Waiting on Role Chair", detail: "Decision pending" },
  { id: "quarterly", label: "Quarterly review", detail: "Committee packet or decision" },
  { id: "other", label: "Follow-through", detail: "Open mentorship work" },
] as const;

function AttentionRow({ workspace }: { workspace: Workspace }) {
  const next = workspace.cycleState.nextAction;
  const canTake = canTakeCurrentAction(workspace);
  return (
    <li className="grid gap-2 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.9fr)_auto] md:items-center md:gap-4">
      <div className="min-w-0">
        <a
          href={`/mentorship/people/${workspace.person.id}`}
          className="text-[14px] font-bold text-ink no-underline hover:text-brand-700 hover:underline"
        >
          {workspace.person.name}
        </a>
        <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
          {workspace.person.contextLabel ?? "Mentorship member"}
          {workspace.overview.mentorName
            ? ` · Mentor: ${workspace.overview.mentorName}`
            : " · No mentor"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-semibold text-ink">{next.label}</p>
        <p className="m-0 mt-0.5 line-clamp-2 text-[12px] text-ink-muted">
          Owner: {ownerFor(workspace)}
          {next.reason ? ` · ${next.reason}` : ""}
        </p>
      </div>
      <ButtonLink
        href={canTake && next.href ? next.href : `/mentorship/people/${workspace.person.id}`}
        size="sm"
        variant="secondary"
      >
        {canTake ? next.label : "View status"} →
      </ButtonLink>
    </li>
  );
}

export async function AdminMentorshipHome({ viewer }: { viewer: SessionUser }) {
  const command = await getAdminMentorshipCommandCenterData();
  const personIds = Array.from(
    new Set([
      ...command.circleSummaries.map((circle) => circle.menteeId),
      ...command.unassignedMentees.map((person) => person.id),
    ])
  ).slice(0, 100);

  const workspaces = (
    await Promise.all(personIds.map((personId) => loadMentorshipWorkspace(viewer, personId)))
  )
    .filter((workspace): workspace is Workspace => Boolean(workspace))
    .sort((left, right) => {
      const priority =
        (ACTION_PRIORITY[left.cycleState.nextAction.key] ?? 50) -
        (ACTION_PRIORITY[right.cycleState.nextAction.key] ?? 50);
      return priority || left.person.name.localeCompare(right.person.name);
    });

  const attention = workspaces.filter(
    (workspace) =>
      workspace.cycleState.nextAction.key !== "all-caught-up" ||
      workspace.commitments.some((commitment) => commitment.overdue)
  );
  const firstActionable = attention.find(canTakeCurrentAction) ?? attention[0] ?? null;
  const grouped = new Map<string, Workspace[]>();
  for (const workspace of attention) {
    const group = groupFor(workspace);
    grouped.set(group, [...(grouped.get(group) ?? []), workspace]);
  }

  const people: MentorshipPersonIndexItem[] = workspaces.map((workspace) => ({
    id: workspace.person.id,
    name: workspace.person.name,
    context: workspace.person.contextLabel ?? "Mentorship member",
    mentor: workspace.overview.mentorName,
    state: workspace.cycleState.nextAction.label,
    owner: ownerFor(workspace),
    needsAttention: attention.some((item) => item.person.id === workspace.person.id),
  }));

  return (
    <div className="mx-auto grid w-full max-w-[1080px] gap-7">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.07em] text-brand-700">
            {attention.length} people need attention
          </p>
          <h2 className="m-0 mt-1 text-[22px] font-bold tracking-[-0.3px] text-ink">
            Who needs something from me?
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Each person appears once, at the next step that moves their mentorship forward.
          </p>
        </div>
        {firstActionable ? (
          <ButtonLink
            href={
              canTakeCurrentAction(firstActionable) && firstActionable.cycleState.nextAction.href
                ? firstActionable.cycleState.nextAction.href
                : `/mentorship/people/${firstActionable.person.id}`
            }
            size="md"
          >
            {canTakeCurrentAction(firstActionable)
              ? firstActionable.cycleState.nextAction.label
              : "Open first person"}
            {" →"}
          </ButtonLink>
        ) : null}
      </section>

      <section aria-label="Mentorship attention queue">
        {attention.length === 0 ? (
          <div className="rounded-2xl bg-surface-soft px-6 py-8 text-center">
            <h2 className="m-0 text-[16px] font-bold text-ink">Everyone is moving.</h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              No setup, review, or follow-through needs leadership right now.
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {GROUPS.map((group) => {
              const rows = grouped.get(group.id) ?? [];
              if (rows.length === 0) return null;
              return (
                <section key={group.id} aria-labelledby={`attention-${group.id}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 id={`attention-${group.id}`} className="m-0 text-[14px] font-bold text-ink">
                      {group.label} <span className="font-normal text-ink-muted">{rows.length}</span>
                    </h3>
                    <span className="text-[11.5px] text-ink-muted">{group.detail}</span>
                  </div>
                  <ul className="m-0 mt-1 list-none divide-y divide-line-soft border-y border-line-soft p-0">
                    {rows.slice(0, 8).map((workspace) => (
                      <AttentionRow key={workspace.person.id} workspace={workspace} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <AdminPeopleFinder people={people} />

      <details className="border-t border-line-soft pt-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-ink">
          Secondary oversight tools
        </summary>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/mentorship?view=admin&tab=assignments" variant="secondary" size="sm">
            Matching
          </ButtonLink>
          <ButtonLink href="/mentorship?view=admin&tab=templates" variant="secondary" size="sm">
            G&amp;R templates
          </ButtonLink>
          <ButtonLink href="/mentorship?view=admin&tab=committees" variant="secondary" size="sm">
            Role Chairs
          </ButtonLink>
          <ButtonLink href="/mentorship?view=admin&tab=capacity" variant="secondary" size="sm">
            Workload
          </ButtonLink>
          <ButtonLink href="/mentorship?view=admin&tab=analytics" variant="secondary" size="sm">
            Analytics
          </ButtonLink>
        </div>
      </details>
    </div>
  );
}
