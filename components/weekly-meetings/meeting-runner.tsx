"use client";

/**
 * The single Meeting Runner. One clean page that adapts by meeting type:
 * - WEEKLY_TEAM_IMPACT / CHAPTER_IMPACT → Impact Presentations table
 * - OFFICER / GENERIC → Officer Topics list
 * All types → Decisions, Follow-ups, Attendance, and a Board roll-up tab.
 *
 * No Before/During/After phasing, no auto-summary banner, no empty-state filler.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, CardV2, StatusBadge } from "@/components/ui-v2";
import type { AssignableUser } from "@/lib/weekly-meetings/teams";
import type {
  MeetingDetail,
  MeetingStatus,
  OfficerTopicDTO,
  PresentationDTO,
} from "@/lib/weekly-meetings/meetings";
import {
  addDecision,
  addFollowUp,
  addOfficerTopic,
  addAttendee,
  deleteDecision,
  deleteFollowUp,
  deleteOfficerTopic,
  removeAttendee,
  setAttendeePresent,
  setFollowUpStatus,
  setMeetingStatus,
  setPresentationRowFlags,
  setTopicOwners,
  updateOfficerTopic,
} from "@/lib/weekly-meetings/meeting-actions";
import {
  actionPrefillToQuery,
  buildActionPrefillFromDecision,
  buildActionPrefillFromMeeting,
  buildActionPrefillFromMeetingFollowUp,
} from "@/lib/people-strategy/action-prefill";
import { createActionFromMeetingFollowUp } from "@/lib/chapters/actions";
import { copyHtmlToClipboard, downloadDocx } from "./copy-docs";

const inputCls =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

const STATUS_TONE: Record<MeetingStatus, "neutral" | "info" | "success" | "warning"> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MeetingRunner({
  meeting,
  people,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"run" | "board">("run");

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch {
        /* surfaced inline elsewhere */
      }
    });

  const isImpact = meeting.type === "WEEKLY_TEAM_IMPACT" || meeting.type === "CHAPTER_IMPACT";
  const showTopics = meeting.type === "OFFICER" || meeting.type === "GENERIC";

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5 pb-16">
      <Link href="/meetings" className="text-[13px] font-semibold text-brand-600 hover:opacity-70">
        ← Meetings
      </Link>

      {/* Header */}
      <CardV2 padding="md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">{meeting.typeLabel}</StatusBadge>
              <StatusBadge tone={STATUS_TONE[meeting.status]}>{meeting.status.replace("_", " ")}</StatusBadge>
              {meeting.scopeLabel && <span className="text-[12.5px] text-ink-muted">{meeting.scopeLabel}</span>}
            </div>
            <h1 className="m-0 text-[26px] font-bold leading-tight text-ink">{meeting.title}</h1>
            {meeting.purpose && <p className="m-0 mt-2 max-w-[680px] text-[14px] text-ink-muted">{meeting.purpose}</p>}
            <p className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
              <span><b className="font-semibold text-ink">When:</b> {fmtDateTime(meeting.scheduledISO)}</span>
              <span><b className="font-semibold text-ink">Owner:</b> {meeting.facilitator?.name ?? "—"}</span>
              {meeting.weekLabel && <span><b className="font-semibold text-ink">Week:</b> {meeting.weekLabel}</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusControl meeting={meeting} pending={pending} onSet={(status) => run(() => setMeetingStatus({ meetingId: meeting.id, status }))} />
          <Link
            href={actionPrefillToQuery(buildActionPrefillFromMeeting({ meetingId: meeting.id, title: `Follow-through: ${meeting.title}`, chapterId: meeting.chapterContext?.id ?? null }))}
            className="text-[12.5px] font-medium text-brand-700 hover:underline"
          >
            + New action from this meeting
          </Link>
        </div>
        </div>
      </CardV2>

      {/* Tabs */}
      <div className="seg-tabs w-fit">
        <button type="button" className={`seg-tab${tab === "run" ? " active" : ""}`} onClick={() => setTab("run")}>
          Run
        </button>
        <button type="button" className={`seg-tab${tab === "board" ? " active" : ""}`} onClick={() => setTab("board")}>
          Board roll-up
        </button>
      </div>

      {tab === "run" ? (
        <div className="flex flex-col gap-5">
          {meeting.chapterContext && <ChapterContextSection ctx={meeting.chapterContext} />}
          {isImpact && <PresentationsSection meeting={meeting} pending={pending} run={run} />}
          {showTopics && <OfficerTopicsSection meeting={meeting} people={people} pending={pending} run={run} />}
          <DecisionsSection meeting={meeting} people={people} pending={pending} run={run} />
          <FollowUpsSection meeting={meeting} people={people} pending={pending} run={run} />
          <AttendanceSection meeting={meeting} people={people} pending={pending} run={run} />
        </div>
      ) : (
        <BoardRollupSection meeting={meeting} />
      )}
    </div>
  );
}

function StatusControl({
  meeting,
  pending,
  onSet,
}: {
  meeting: MeetingDetail;
  pending: boolean;
  onSet: (s: MeetingStatus) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {meeting.status === "SCHEDULED" && (
        <Button variant="primary" size="sm" loading={pending} onClick={() => onSet("IN_PROGRESS")}>
          Start meeting
        </Button>
      )}
      {meeting.status === "IN_PROGRESS" && (
        <Button variant="primary" size="sm" loading={pending} onClick={() => onSet("COMPLETED")}>
          Complete
        </Button>
      )}
      {(meeting.status === "COMPLETED" || meeting.status === "CANCELLED") && (
        <Button variant="secondary" size="sm" loading={pending} onClick={() => onSet("SCHEDULED")}>
          Reopen
        </Button>
      )}
    </div>
  );
}

function ChapterContextSection({ ctx }: { ctx: NonNullable<MeetingDetail["chapterContext"]> }) {
  return (
    <CardV2 padding="md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="brand">Chapter meeting</StatusBadge>
          <h2 className="m-0 text-[15px] font-bold text-ink">{ctx.name}</h2>
          <StatusBadge tone="neutral">{ctx.lifecycleLabel}</StatusBadge>
        </div>
        <Link href={ctx.detailHref} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
          Open chapter →
        </Link>
      </div>

      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
        <span>
          <b className="font-semibold text-ink">Chapter President:</b>{" "}
          {ctx.president ? (
            <Link href={`/people/${ctx.president.id}`} className="text-brand-700 hover:underline">
              {ctx.president.name}
            </Link>
          ) : (
            "Not assigned"
          )}
        </span>
        <span><b className="font-semibold text-ink">Members:</b> {ctx.memberCount}</span>
        <span><b className="font-semibold text-ink">Open actions:</b> {ctx.openActionCount}</span>
      </p>

      {ctx.activeGoals.length > 0 && (
        <div className="mt-3">
          <h3 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Active goals</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-ink">
            {ctx.activeGoals.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3">
                <span>{g.title}</span>
                <span className="shrink-0 text-[12px] text-ink-muted">
                  {g.currentValue}/{g.targetValue} {g.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ctx.openActions.length > 0 && (
        <div className="mt-3">
          <h3 className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Open chapter actions
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
            {ctx.openActions.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <Link href={`/actions/${a.id}`} className="min-w-0 truncate text-ink hover:underline">
                  {a.title}
                </Link>
                <span className="shrink-0 text-[12px] text-ink-muted">{a.owner?.name ?? "Unassigned"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardV2>
  );
}

function Section({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <CardV2 padding="md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-bold text-ink">
          {title}
          {count !== undefined && <span className="ml-2 text-[13px] font-medium text-ink-muted">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </CardV2>
  );
}

function ImpactCoverageStrip({ coverage }: { coverage: NonNullable<MeetingDetail["impactCoverage"]> }) {
  const missing = coverage.people.filter((p) => p.status === "MISSING");
  const drafting = coverage.people.filter((p) => p.status === "DRAFT");
  return (
    <div className="mb-3 rounded-lg border border-line-soft bg-surface-soft px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
        <span className="font-semibold text-ink">{coverage.weekLabel}</span>
        <span className="text-ink-muted">{coverage.scopeLabel}</span>
        <span className="text-ink-muted">
          <b className="font-semibold text-ink">{coverage.submitted}</b>
          {coverage.hasRoster ? `/${coverage.expected}` : ""} submitted
        </span>
        <span className="text-ink-muted">
          <b className="font-semibold text-ink">{coverage.presenting}</b> flagged to present
        </span>
      </div>
      {(missing.length > 0 || drafting.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {drafting.map((p) => (
            <span
              key={p.userId}
              title="Started a draft but hasn't submitted"
              className="inline-flex items-center rounded-full border border-progress-700/30 bg-progress-50 px-2 py-0.5 text-[11px] font-medium text-progress-700"
            >
              {p.name} · draft
            </span>
          ))}
          {missing.map((p) => (
            <span
              key={p.userId}
              title="Has not submitted Weekly Impact for this week"
              className="inline-flex items-center rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted"
            >
              {p.name}
            </span>
          ))}
          <span className="text-[11px] text-ink-muted">
            {missing.length > 0 ? "still to submit" : "in draft"}
          </span>
        </div>
      )}
    </div>
  );
}

function PresentationsSection({
  meeting,
  pending,
  run,
}: {
  meeting: MeetingDetail;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const coverage = meeting.impactCoverage;
  return (
    <Section title="Impact Presentations" count={meeting.presentations.length}>
      {coverage && <ImpactCoverageStrip coverage={coverage} />}
      {meeting.presentations.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">
          No rows flagged to present{coverage ? ` for ${coverage.weekLabel}` : ""} yet. They appear here once
          {meeting.type === "CHAPTER_IMPACT" ? " the chapter" : " team members"} tick
          <b className="font-semibold text-ink"> Present</b> on their submitted Weekly Impact for this week.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wide text-ink-muted">
                <th className="px-2 py-2 font-semibold">{meeting.type === "CHAPTER_IMPACT" ? "Chapter" : "Team"}</th>
                <th className="px-2 py-2 font-semibold">Person</th>
                <th className="px-2 py-2 font-semibold">Item to present</th>
                <th className="px-2 py-2 font-semibold">Evidence / next</th>
                <th className="w-24 px-2 py-2 text-center font-semibold">Decision?</th>
                <th className="w-24 px-2 py-2 text-center font-semibold">Board?</th>
              </tr>
            </thead>
            <tbody>
              {meeting.presentations.map((p) => (
                <tr key={p.rowId} className="border-t border-line-soft align-top">
                  <td className="px-2 py-2 font-medium text-ink">{p.scopeLabel}</td>
                  <td className="px-2 py-2 text-ink">{p.person}</td>
                  <td className="px-2 py-2 text-ink">{p.item}</td>
                  <td className="px-2 py-2 text-ink-muted">{p.evidenceNext ?? "—"}</td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={p.decisionNeeded}
                      disabled={pending}
                      onChange={(e) => run(() => setPresentationRowFlags({ rowId: p.rowId, meetingId: meeting.id, decisionNeeded: e.target.checked }))}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={p.sendToBoard}
                      disabled={pending}
                      onChange={(e) => run(() => setPresentationRowFlags({ rowId: p.rowId, meetingId: meeting.id, sendToBoard: e.target.checked }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function OfficerTopicsSection({
  meeting,
  people,
  pending,
  run,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  return (
    <Section
      title="Officer Topics"
      count={meeting.officerTopics.length}
      action={
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} w-56`}
            placeholder="Add a topic…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                run(() => addOfficerTopic({ meetingId: meeting.id, title: newTitle.trim() }));
                setNewTitle("");
              }
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            disabled={!newTitle.trim()}
            onClick={() => {
              run(() => addOfficerTopic({ meetingId: meeting.id, title: newTitle.trim() }));
              setNewTitle("");
            }}
          >
            Add
          </Button>
        </div>
      }
    >
      {meeting.officerTopics.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">No topics yet — add the first discussion item above.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {meeting.officerTopics.map((t, i) => (
            <TopicRow key={t.id} index={i + 1} topic={t} people={people} pending={pending} run={run} />
          ))}
        </ol>
      )}
    </Section>
  );
}

function TopicRow({
  index,
  topic,
  people,
  pending,
  run,
}: {
  index: number;
  topic: OfficerTopicDTO;
  people: AssignableUser[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(topic.detail ?? "");
  const [decision, setDecision] = useState(topic.decision ?? "");
  const [nextSteps, setNextSteps] = useState(topic.nextSteps ?? "");
  const ownerIds = new Set(topic.owners.map((o) => o.id));

  return (
    <li className="rounded-lg border border-line-soft p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 text-[13px] font-bold text-brand-600">{index}.</span>
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-medium text-ink">{topic.title}</p>
            <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
              {topic.owners.length ? topic.owners.map((o) => o.name).join(", ") : "No owners"}
              {topic.decisionNeeded && " · Decision needed"}
              {topic.sendToBoard && " · → Board"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="text-[12px] font-semibold text-brand-600 hover:opacity-70" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Edit"}
          </button>
          <button type="button" className="text-[12px] text-ink-muted hover:text-danger-700" onClick={() => run(() => deleteOfficerTopic({ topicId: topic.id }))}>
            ✕
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-line-soft pt-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Owners</label>
            <div className="flex flex-wrap gap-2">
              {people.map((u) => {
                const checked = ownerIds.has(u.id);
                return (
                  <label key={u.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${checked ? "border-brand-400 bg-brand-50 text-brand-800" : "border-line text-ink-muted"}`}>
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-brand-600"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(ownerIds);
                        if (e.target.checked) next.add(u.id);
                        else next.delete(u.id);
                        run(() => setTopicOwners({ topicId: topic.id, userIds: [...next] }));
                      }}
                    />
                    {u.name}
                  </label>
                );
              })}
            </div>
          </div>
          <textarea className={`${inputCls} min-h-[48px]`} placeholder="Detail / context" value={detail} onChange={(e) => setDetail(e.target.value)} onBlur={() => detail !== (topic.detail ?? "") && run(() => updateOfficerTopic({ topicId: topic.id, detail }))} />
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink"><input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={topic.decisionNeeded} onChange={(e) => run(() => updateOfficerTopic({ topicId: topic.id, decisionNeeded: e.target.checked }))} /> Decision needed</label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink"><input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={topic.sendToBoard} onChange={(e) => run(() => updateOfficerTopic({ topicId: topic.id, sendToBoard: e.target.checked }))} /> Send to board</label>
            <select className={`${inputCls} w-40`} value={topic.status} onChange={(e) => run(() => updateOfficerTopic({ topicId: topic.id, status: e.target.value as OfficerTopicDTO["status"] }))} disabled={pending}>
              <option value="OPEN">Open</option>
              <option value="DISCUSSED">Discussed</option>
              <option value="DECIDED">Decided</option>
              <option value="DEFERRED">Deferred</option>
            </select>
          </div>
          <textarea className={`${inputCls} min-h-[48px]`} placeholder="Decision / outcome" value={decision} onChange={(e) => setDecision(e.target.value)} onBlur={() => decision !== (topic.decision ?? "") && run(() => updateOfficerTopic({ topicId: topic.id, decision }))} />
          <textarea className={`${inputCls} min-h-[48px]`} placeholder="Next steps" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} onBlur={() => nextSteps !== (topic.nextSteps ?? "") && run(() => updateOfficerTopic({ topicId: topic.id, nextSteps }))} />
        </div>
      )}
    </li>
  );
}

function DecisionsSection({
  meeting,
  people,
  pending,
  run,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [text, setText] = useState("");
  const [by, setBy] = useState("");
  return (
    <Section title="Decisions" count={meeting.decisions.length}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="Record a decision…" value={text} onChange={(e) => setText(e.target.value)} />
        <select className={`${inputCls} w-44`} value={by} onChange={(e) => setBy(e.target.value)}>
          <option value="">Decided by…</option>
          {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Button variant="secondary" size="sm" loading={pending} disabled={!text.trim()} onClick={() => { run(() => addDecision({ meetingId: meeting.id, decision: text.trim(), decidedById: by || undefined })); setText(""); setBy(""); }}>
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {meeting.decisions.map((d) => (
          <div key={d.id} className="flex items-start justify-between gap-3 rounded-md border border-line-soft px-3 py-2">
            <div>
              <p className="m-0 text-[13.5px] text-ink">{d.decision}</p>
              {d.decidedBy && <p className="m-0 text-[11.5px] text-ink-muted">— {d.decidedBy.name}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {d.linkedActionId ? (
                <Link href={`/actions/${d.linkedActionId}`} className="text-[12px] font-medium text-success-700 hover:underline">✓ Action</Link>
              ) : (
                <Link
                  href={actionPrefillToQuery(buildActionPrefillFromDecision({
                    decision: d.decision,
                    rationale: d.rationale,
                    meetingId: meeting.id,
                    decisionId: d.id,
                    meetingTitle: meeting.title,
                    suggestedOwnerId: d.decidedBy?.id ?? null,
                    chapterId: meeting.chapterContext?.id ?? null,
                  }))}
                  className="text-[12px] font-medium text-brand-700 hover:underline"
                >
                  Create action
                </Link>
              )}
              <button type="button" className="text-[12px] text-ink-muted hover:text-danger-700" onClick={() => run(() => deleteDecision({ decisionId: d.id }))}>✕</button>
            </div>
          </div>
        ))}
        {meeting.decisions.length === 0 && <p className="m-0 text-[13px] text-ink-muted">No decisions recorded.</p>}
      </div>
    </Section>
  );
}

function FollowUpsSection({
  meeting,
  people,
  pending,
  run,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  return (
    <Section title="Follow-ups" count={meeting.followUps.length}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Add a follow-up / next action…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className={`${inputCls} w-40`} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Owner…</option>
          {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input type="date" className={`${inputCls} w-40`} value={due} onChange={(e) => setDue(e.target.value)} />
        <Button variant="secondary" size="sm" loading={pending} disabled={!title.trim()} onClick={() => { run(() => addFollowUp({ meetingId: meeting.id, title: title.trim(), ownerId: owner || undefined, dueDate: due || undefined })); setTitle(""); setOwner(""); setDue(""); }}>
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {meeting.followUps.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-line-soft px-3 py-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.status === "COMPLETED"} onChange={(e) => run(() => setFollowUpStatus({ followUpId: f.id, status: e.target.checked ? "COMPLETED" : "OPEN" }))} />
              <div>
                <p className={`m-0 text-[13.5px] ${f.status === "COMPLETED" ? "text-ink-muted line-through" : "text-ink"}`}>{f.title}</p>
                <p className="m-0 text-[11.5px] text-ink-muted">{f.owner?.name ?? "Unassigned"}{f.dueISO ? ` · due ${new Date(f.dueISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {f.linkedActionId ? (
                <Link href={`/actions/${f.linkedActionId}`} className="text-[12px] font-medium text-success-700 hover:underline">✓ Action</Link>
              ) : meeting.chapterContext ? (
                // Chapter meeting: one-click turn this follow-up into a real,
                // chapter-scoped action owned by the CP — no detour to a form.
                <button
                  type="button"
                  className="text-[12px] font-medium text-brand-700 hover:underline disabled:opacity-50"
                  disabled={pending}
                  onClick={() => run(() => createActionFromMeetingFollowUp({ followUpId: f.id }))}
                >
                  Track as chapter action
                </button>
              ) : (
                <Link
                  href={actionPrefillToQuery(buildActionPrefillFromMeetingFollowUp({
                    followUpId: f.id,
                    title: f.title,
                    description: f.detail,
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    suggestedOwnerId: f.owner?.id ?? null,
                    dueDate: f.dueISO,
                  }))}
                  className="text-[12px] font-medium text-brand-700 hover:underline"
                >
                  Create action
                </Link>
              )}
              <button type="button" className="text-[12px] text-ink-muted hover:text-danger-700" onClick={() => run(() => deleteFollowUp({ followUpId: f.id }))}>✕</button>
            </div>
          </div>
        ))}
        {meeting.followUps.length === 0 && <p className="m-0 text-[13px] text-ink-muted">No follow-ups yet.</p>}
      </div>
    </Section>
  );
}

function AttendanceSection({
  meeting,
  people,
  pending,
  run,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [addId, setAddId] = useState("");
  const presentCount = meeting.attendees.filter((a) => a.present).length;
  const attendeeIds = new Set(meeting.attendees.map((a) => a.userId));
  const available = people.filter((u) => !attendeeIds.has(u.id));
  return (
    <Section title="Attendance" count={meeting.attendees.length}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-56`} value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">Add attendee…</option>
          {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Button variant="secondary" size="sm" loading={pending} disabled={!addId} onClick={() => { run(() => addAttendee({ meetingId: meeting.id, userId: addId })); setAddId(""); }}>
          Add
        </Button>
        {meeting.attendees.length > 0 && <span className="text-[12px] text-ink-muted">{presentCount}/{meeting.attendees.length} present</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        {meeting.attendees.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-line-soft px-3 py-1.5">
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={a.present} onChange={(e) => run(() => setAttendeePresent({ attendeeId: a.id, present: e.target.checked }))} />
              {a.name}
            </label>
            <button type="button" className="text-[12px] text-ink-muted hover:text-danger-700" onClick={() => run(() => removeAttendee({ attendeeId: a.id }))}>Remove</button>
          </div>
        ))}
        {meeting.attendees.length === 0 && <p className="m-0 text-[13px] text-ink-muted">No attendees added.</p>}
      </div>
    </Section>
  );
}

function buildBoardHtml(meeting: MeetingDetail): { html: string; plain: string } {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const presRows = meeting.boardRows
    .map(
      (p) =>
        `<tr><td style="border:1px solid #ccc;padding:6px 9px;">${esc(p.scopeLabel)}</td><td style="border:1px solid #ccc;padding:6px 9px;">${esc(p.person)}</td><td style="border:1px solid #ccc;padding:6px 9px;">${esc(p.item)}</td></tr>`,
    )
    .join("");
  const topicRows = meeting.boardTopics
    .map(
      (t) =>
        `<tr><td style="border:1px solid #ccc;padding:6px 9px;">${esc(t.title)}</td><td style="border:1px solid #ccc;padding:6px 9px;">${esc(t.decision ?? t.detail ?? "")}</td><td style="border:1px solid #ccc;padding:6px 9px;">${esc(t.owners.map((o) => o.name).join(", "))}</td></tr>`,
    )
    .join("");
  const th = "background:#5B21B6;color:#fff;border:1px solid #5B21B6;padding:7px 9px;text-align:left;font-size:12px;";
  const body = `
    <h2 style="font-family:Arial;font-size:18px;margin:0 0 4px;">Board roll-up — ${esc(meeting.title)}</h2>
    <p style="font-family:Arial;color:#666;font-size:12px;margin:0 0 14px;">${esc(meeting.typeLabel)}${meeting.scopeLabel ? " · " + esc(meeting.scopeLabel) : ""}</p>
    ${meeting.boardRows.length ? `<h3 style="font-family:Arial;font-size:13px;margin:10px 0 4px;">Impact items</h3><table style="border-collapse:collapse;font-family:Arial;font-size:12px;"><thead><tr><th style="${th}">Team/Chapter</th><th style="${th}">Person</th><th style="${th}">Item</th></tr></thead><tbody>${presRows}</tbody></table>` : ""}
    ${meeting.boardTopics.length ? `<h3 style="font-family:Arial;font-size:13px;margin:14px 0 4px;">Topics</h3><table style="border-collapse:collapse;font-family:Arial;font-size:12px;"><thead><tr><th style="${th}">Topic</th><th style="${th}">Decision / detail</th><th style="${th}">Owners</th></tr></thead><tbody>${topicRows}</tbody></table>` : ""}
  `;
  const plain = [
    `Board roll-up — ${meeting.title}`,
    ...meeting.boardRows.map((p) => `• ${p.scopeLabel} / ${p.person}: ${p.item}`),
    ...meeting.boardTopics.map((t) => `• ${t.title}: ${t.decision ?? t.detail ?? ""}`),
  ].join("\n");
  return { html: body, plain };
}

function BoardRollupSection({ meeting }: { meeting: MeetingDetail }) {
  const [copied, setCopied] = useState(false);
  const empty = meeting.boardRows.length === 0 && meeting.boardTopics.length === 0;
  const { html, plain } = buildBoardHtml(meeting);

  async function onCopy() {
    const ok = await copyHtmlToClipboard(`<div>${html}</div>`, plain);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  }
  async function onDocx() {
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    await downloadDocx(full, `board-rollup-${meeting.id}.docx`);
  }

  return (
    <Section
      title="Board roll-up"
      action={
        !empty && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onCopy}>{copied ? "✓ Copied" : "Copy for Google Docs"}</Button>
            <Button variant="primary" size="sm" onClick={onDocx}>Download .docx</Button>
          </div>
        )
      }
    >
      {empty ? (
        <p className="m-0 text-[13px] text-ink-muted">
          Nothing flagged for the board yet. Tick <b className="font-semibold text-ink">Board?</b> on a presentation row or
          <b className="font-semibold text-ink"> Send to board</b> on a topic to collect it here.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {meeting.boardRows.length > 0 && (
            <div>
              <h3 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Impact items</h3>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13.5px] text-ink">
                {meeting.boardRows.map((p) => (
                  <li key={p.rowId}><b className="font-semibold">{p.scopeLabel} · {p.person}:</b> {p.item}</li>
                ))}
              </ul>
            </div>
          )}
          {meeting.boardTopics.length > 0 && (
            <div>
              <h3 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Topics</h3>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13.5px] text-ink">
                {meeting.boardTopics.map((t) => (
                  <li key={t.id}><b className="font-semibold">{t.title}:</b> {t.decision ?? t.detail ?? "—"}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
