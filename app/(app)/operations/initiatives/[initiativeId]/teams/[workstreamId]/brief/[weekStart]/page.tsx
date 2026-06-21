import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSessionUser } from "@/lib/authorization";
import { isWeeklyTeamBriefsEnabled } from "@/lib/feature-flags";
import { listActionAssignableUsers } from "@/lib/people-strategy/action-queries";
import {
  addWeeklyTaskDeliverable,
  finalizeTeamMeetingAndBrief,
  prepareTaskForOfficerReview,
  reopenWeeklyBrief,
  submitWeeklyBrief,
  updateWeeklyBriefOverall,
  updateWeeklyTaskUpdate,
} from "@/lib/people-strategy/weekly-team-brief-actions";
import {
  loadWeeklyBriefWorkspace,
  type WeeklyBriefTaskUpdateDTO,
} from "@/lib/people-strategy/weekly-team-briefs";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { PageHeaderV2, RecordSection, StatusBadge } from "@/components/ui-v2";
import { GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID } from "@/lib/people-strategy/impact-meetings";

export const dynamic = "force-dynamic";

async function saveOverall(formData: FormData) {
  "use server";
  await updateWeeklyBriefOverall({
    briefId: String(formData.get("briefId") ?? ""),
    teamObjective: String(formData.get("teamObjective") ?? ""),
    overallStatus: String(formData.get("overallStatus") ?? ""),
    lastCommitments: String(formData.get("lastCommitments") ?? ""),
    blockersSummary: String(formData.get("blockersSummary") ?? ""),
    decisionsNeeded: String(formData.get("decisionsNeeded") ?? ""),
    nextActionsSummary: String(formData.get("nextActionsSummary") ?? ""),
    nextCycleCommitments: String(formData.get("nextCycleCommitments") ?? ""),
  });
}

async function saveTask(formData: FormData) {
  "use server";
  await updateWeeklyTaskUpdate({
    updateId: String(formData.get("updateId") ?? ""),
    statusNarrative: String(formData.get("statusNarrative") ?? ""),
    workCompleted: String(formData.get("workCompleted") ?? ""),
    currentResult: String(formData.get("currentResult") ?? ""),
    remainingWork: String(formData.get("remainingWork") ?? ""),
    blockerNote: String(formData.get("blockerNote") ?? ""),
    explanation: String(formData.get("explanation") ?? ""),
    decisionNeeded: String(formData.get("decisionNeeded") ?? ""),
    nextAction: String(formData.get("nextAction") ?? ""),
    teamMeetingPresenterId: String(formData.get("teamMeetingPresenterId") ?? ""),
    officerMeetingPresenterId: String(formData.get("officerMeetingPresenterId") ?? ""),
    teamMeetingReady: formData.get("teamMeetingReady") === "on",
    officerMeetingReady: formData.get("officerMeetingReady") === "on",
    escalationNeeded: formData.get("escalationNeeded") === "on",
    officerReviewRequested: formData.get("officerReviewRequested") === "on",
  });
}

async function addDeliverable(formData: FormData) {
  "use server";
  await addWeeklyTaskDeliverable({
    updateId: String(formData.get("updateId") ?? ""),
    label: String(formData.get("label") ?? ""),
    url: String(formData.get("url") ?? ""),
  });
}

async function prepareOfficerItem(formData: FormData) {
  "use server";
  await prepareTaskForOfficerReview({
    weeklyTaskUpdateId: String(formData.get("weeklyTaskUpdateId") ?? ""),
    reasonForOfficerReview: String(formData.get("reasonForOfficerReview") ?? ""),
    title: String(formData.get("title") ?? ""),
    statusSummary: String(formData.get("statusSummary") ?? ""),
    requestedDecision: String(formData.get("requestedDecision") ?? ""),
    presenterId: String(formData.get("presenterId") ?? ""),
    targetOfficerMeetingId: String(formData.get("targetOfficerMeetingId") ?? ""),
    submit: formData.get("submit") === "on",
  });
}

async function submitBriefForm(formData: FormData) {
  "use server";
  await submitWeeklyBrief({ briefId: String(formData.get("briefId") ?? "") });
}

async function finalizeBriefForm(formData: FormData) {
  "use server";
  await finalizeTeamMeetingAndBrief({ briefId: String(formData.get("briefId") ?? "") });
}

async function reopenBriefForm(formData: FormData) {
  "use server";
  await reopenWeeklyBrief({ briefId: String(formData.get("briefId") ?? "") });
}

function textareaClass() {
  return "min-h-[76px] rounded-md border border-[var(--border)] px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
}

function inputClass() {
  return "rounded-md border border-[var(--border)] px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
}

function statusTone(status: string) {
  if (status === "FINALIZED") return "success";
  if (status === "SUBMITTED" || status === "PRESENTED") return "warning";
  if (status === "REOPENED") return "info";
  return "neutral";
}

export default async function WeeklyTeamBriefPage({
  params,
}: {
  params: Promise<{ initiativeId: string; workstreamId: string; weekStart: string }>;
}) {
  if (!isWeeklyTeamBriefsEnabled()) notFound();
  const session = await requireSessionUser().catch(() => null);
  if (!session) notFound();
  const { initiativeId, workstreamId, weekStart } = await params;
  const viewer: ActionViewer = {
    id: session.id,
    roles: session.roles,
    primaryRole: session.primaryRole,
    adminSubtypes: session.adminSubtypes,
  };

  const [brief, people] = await Promise.all([
    loadWeeklyBriefWorkspace({
      initiativeId,
      workstreamId,
      weekStart,
      viewer,
      autoGenerate: true,
    }),
    listActionAssignableUsers(),
  ]);
  if (!brief) notFound();

  const finalized = brief.status === "FINALIZED";
  const peopleOptions = people.map((person) => ({
    id: person.id,
    name: person.name ?? person.email,
  }));
  const isImpactBrief = initiativeId === GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID;
  const targetMeetingHref = brief.officerMeeting ? `/meetings/${brief.officerMeeting.id}` : null;

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 pb-10">
      <PageHeaderV2
        eyebrow="Team presentation"
        backHref="/meetings"
        backLabel="Meetings"
        title={`${brief.workstreamTitle} — Weekly Impact`}
        subtitle={`${brief.initiativeTitle} · Week of ${brief.weekKey} · one combined presentation${
          brief.members.length ? ` from ${brief.members.length} contributor${brief.members.length === 1 ? "" : "s"}` : ""
        }`}
      >
        <StatusBadge tone={statusTone(brief.status)}>{brief.status}</StatusBadge>
      </PageHeaderV2>

      <p className="m-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
        This is {brief.workstreamTitle}&apos;s single weekly presentation — everyone&apos;s parts
        combined. Contributors add their piece from{" "}
        <Link href="/my-weekly-impact" className="font-semibold text-brand-700 no-underline hover:underline">
          My Weekly Impact
        </Link>
        {brief.officerMeeting ? (
          <>
            ; it&apos;s presented at{" "}
            <Link
              href={targetMeetingHref ?? "/meetings"}
              className="font-semibold text-brand-700 no-underline hover:underline"
            >
              this week&apos;s {isImpactBrief ? "Impact Meeting" : "meeting"}
            </Link>
          </>
        ) : null}
        .
      </p>

      <div className="flex flex-wrap gap-2">
        <form action={submitBriefForm}>
          <input type="hidden" name="briefId" value={brief.id} />
          <button
            type="submit"
            disabled={finalized}
            className="rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Submit for Team Meeting
          </button>
        </form>
        <form action={finalizeBriefForm}>
          <input type="hidden" name="briefId" value={brief.id} />
          <button
            type="submit"
            disabled={finalized}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Finalize Team Meeting
          </button>
        </form>
        {finalized ? (
          <form action={reopenBriefForm}>
            <input type="hidden" name="briefId" value={brief.id} />
            <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink">
              Reopen
            </button>
          </form>
        ) : null}
        {brief.officerMeeting && targetMeetingHref ? (
          <Link href={targetMeetingHref} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-brand-700 no-underline">
            Target {isImpactBrief ? "Impact Meeting" : "Officer Meeting"}
          </Link>
        ) : null}
        {brief.officerMeeting && isImpactBrief && targetMeetingHref ? (
          <Link href={`${targetMeetingHref}#team-${workstreamId}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-brand-700 no-underline">
            Add to agenda
          </Link>
        ) : null}
        {brief.officerMeeting && isImpactBrief && targetMeetingHref ? (
          <Link href={`${targetMeetingHref}#impact-follow-up-${workstreamId}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-brand-700 no-underline">
            Create follow-up
          </Link>
        ) : null}
      </div>

      <RecordSection
        id="team-meeting"
        title="Team Meeting"
        description="The team uses this agenda first. Only selected prepared items move to officers."
      >
        <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-ink-muted md:grid-cols-2">
          {[
            "Overall team status",
            "Last commitments",
            "Tasks requiring discussion",
            "Deliverables to review",
            "Blockers",
            "Internal decisions",
            "Items being prepared for officers",
            "Presenter confirmation",
            "Next actions",
            "Next Team Meeting commitments",
          ].map((item) => (
            <div key={item} className="rounded-md bg-[var(--rail)] px-3 py-2 font-semibold text-ink">
              {item}
            </div>
          ))}
        </div>
      </RecordSection>

      <RecordSection
        id="overall"
        title="This week"
        description="Team-level notes. Task facts stay connected to the Action Tracker below."
      >
        <form action={saveOverall} className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <input type="hidden" name="briefId" value={brief.id} />
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Team objective
            <textarea name="teamObjective" defaultValue={brief.teamObjective ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Overall team status
            <textarea name="overallStatus" defaultValue={brief.overallStatus ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Last commitments
              <textarea name="lastCommitments" defaultValue={brief.lastCommitments ?? ""} className={textareaClass()} disabled={finalized} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Blockers
              <textarea name="blockersSummary" defaultValue={brief.blockersSummary ?? ""} className={textareaClass()} disabled={finalized} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Decisions needed
              <textarea name="decisionsNeeded" defaultValue={brief.decisionsNeeded ?? ""} className={textareaClass()} disabled={finalized} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Next actions
              <textarea name="nextActionsSummary" defaultValue={brief.nextActionsSummary ?? ""} className={textareaClass()} disabled={finalized} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Next-cycle commitments
            <textarea name="nextCycleCommitments" defaultValue={brief.nextCycleCommitments ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <button type="submit" disabled={finalized} className="justify-self-start rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Save team status
          </button>
        </form>
      </RecordSection>

      {brief.expectations.length ? (
        <RecordSection
          id="expectations"
          title="Required this week"
          description="Officer-set expectations carried into this team's brief."
        >
          <div className="grid gap-2">
            {brief.expectations.map((expectation) => (
              <div key={expectation.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
                <p className="m-0 font-semibold text-ink">{expectation.prompt}</p>
                <p className="m-0 mt-1 text-ink-muted">
                  {expectation.kind.replaceAll("_", " ")}
                  {expectation.actionTitle ? ` · ${expectation.actionTitle}` : ""}
                  {expectation.presenter ? ` · presenter ${expectation.presenter.name}` : ""}
                </p>
              </div>
            ))}
          </div>
        </RecordSection>
      ) : null}

      <RecordSection
        id="tasks"
        title="Tasks"
        description="Each section shows the task, owner, current result, deliverable, blocker, meeting status, presenter, and next action."
      >
        {brief.taskUpdates.length ? (
          <div className="grid gap-4">
            {brief.taskUpdates.map((task) => (
              <TaskUpdateCard
                key={task.id}
                task={task}
                finalized={finalized}
                people={peopleOptions}
                officerMeetingId={brief.officerMeeting?.id ?? brief.teamMeeting?.targetOfficerMeeting?.id ?? ""}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-ink-muted">
            No active tasks were found for this team this week. Add a team objective, or create an Action Tracker task for this workstream.
          </div>
        )}
      </RecordSection>

      {brief.preparedPresentationItems.length ? (
        <RecordSection
          id="prepared"
          title="Preparing for officers"
          description="These are the selected items that may appear in an Officer Meeting."
        >
          <div className="grid gap-3">
            {brief.preparedPresentationItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-ink">{item.title}</strong>
                  <span className="text-ink-muted">{item.readiness.replaceAll("_", " ")}</span>
                </div>
                <p className="m-0 mt-2 text-ink-muted">{item.reasonForOfficerReview}</p>
                {item.agendaItemId ? (
                  <p className="m-0 mt-2 font-semibold text-green-700">Accepted onto the Officer Meeting agenda.</p>
                ) : null}
              </div>
            ))}
          </div>
        </RecordSection>
      ) : null}
    </div>
  );
}

function TaskUpdateCard({
  task,
  finalized,
  people,
  officerMeetingId,
}: {
  task: WeeklyBriefTaskUpdateDTO;
  finalized: boolean;
  people: Array<{ id: string; name: string }>;
  officerMeetingId: string;
}) {
  const hasDeliverable = task.deliverables.length > 0 || task.allDeliverables.length > 0;
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-bold text-ink">{task.taskTitle}</h3>
          <p className="m-0 mt-1 text-sm text-ink-muted">
            Owner: {task.owner?.name ?? "Unassigned"} · Status: {task.liveStatus ?? "Historical"}
          </p>
        </div>
        {task.actionItemId ? (
          <Link href={`/actions/${task.actionItemId}`} className="text-sm font-semibold text-brand-700 no-underline hover:underline">
            Open task
          </Link>
        ) : null}
      </div>

      <form action={saveTask} className="mt-4 grid gap-3">
        <input type="hidden" name="updateId" value={task.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Status summary
            <textarea name="statusNarrative" defaultValue={task.statusNarrative ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Work completed
            <textarea name="workCompleted" defaultValue={task.workCompleted ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Current result
            <textarea name="currentResult" defaultValue={task.currentResult ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Remaining work
            <textarea name="remainingWork" defaultValue={task.remainingWork ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Blocker
            <textarea name="blockerNote" defaultValue={task.blockerNote ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Decision needed
            <textarea name="decisionNeeded" defaultValue={task.decisionNeeded ?? ""} className={textareaClass()} disabled={finalized} />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Next concrete action
          <textarea name="nextAction" defaultValue={task.nextAction ?? ""} className={textareaClass()} disabled={finalized} />
        </label>
        <input type="hidden" name="explanation" value={task.explanation ?? ""} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Team Meeting presenter
            <select name="teamMeetingPresenterId" defaultValue={task.teamMeetingPresenter?.id ?? ""} className={inputClass()} disabled={finalized}>
              <option value="">No presenter</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Officer Meeting presenter
            <select name="officerMeetingPresenterId" defaultValue={task.officerMeetingPresenter?.id ?? ""} className={inputClass()} disabled={finalized}>
              <option value="">No presenter</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-medium text-ink-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="teamMeetingReady" defaultChecked={task.teamMeetingReady} disabled={finalized} />
            Ready for Team Meeting
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="officerMeetingReady" defaultChecked={task.officerMeetingReady} disabled={finalized} />
            Ready for Officer Meeting
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="escalationNeeded" defaultChecked={task.escalationNeeded} disabled={finalized} />
            Escalation needed
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="officerReviewRequested" defaultChecked={task.officerReviewRequested} disabled={finalized} />
            Officer review requested
          </label>
        </div>
        <button type="submit" disabled={finalized} className="justify-self-start rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Save task update
        </button>
      </form>

      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--rail)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-sm font-bold text-ink">Actual deliverables</p>
          {!hasDeliverable ? <span className="text-xs font-semibold text-red-700">Missing work product</span> : null}
        </div>
        {task.allDeliverables.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {task.allDeliverables.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-700 no-underline">
                Open {link.label}
              </a>
            ))}
          </div>
        ) : null}
        <form action={addDeliverable} className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input type="hidden" name="updateId" value={task.id} />
          <input name="label" placeholder="Label" className={inputClass()} disabled={finalized} />
          <input name="url" placeholder="https://..." className={inputClass()} disabled={finalized} />
          <button type="submit" disabled={finalized} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">
            Add
          </button>
        </form>
      </div>

      <form action={prepareOfficerItem} className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] p-3">
        <input type="hidden" name="weeklyTaskUpdateId" value={task.id} />
        <input type="hidden" name="targetOfficerMeetingId" value={officerMeetingId} />
        <p className="m-0 text-sm font-bold text-ink">Prepare for officers</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="title" defaultValue={task.taskTitle} className={inputClass()} disabled={finalized} />
          <select name="presenterId" defaultValue={task.officerMeetingPresenter?.id ?? task.teamMeetingPresenter?.id ?? ""} className={inputClass()} disabled={finalized}>
            <option value="">Choose presenter</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </div>
        <textarea name="reasonForOfficerReview" required placeholder="Why should officers review this?" className={textareaClass()} disabled={finalized} />
        <textarea name="statusSummary" placeholder="Prepared presentation summary" defaultValue={task.statusNarrative ?? task.currentResult ?? ""} className={textareaClass()} disabled={finalized} />
        <textarea name="requestedDecision" placeholder="Decision or leadership input requested" defaultValue={task.decisionNeeded ?? ""} className={textareaClass()} disabled={finalized} />
        <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <input name="submit" type="checkbox" disabled={finalized} />
          Submit to Officer Meeting review
        </label>
        <button type="submit" disabled={finalized} className="justify-self-start rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">
          Prepare item
        </button>
      </form>
    </article>
  );
}
