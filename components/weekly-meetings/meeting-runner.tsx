"use client";

/**
 * Simple meeting page — people, notes, topics, follow-ups. One column, no tabs.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, CardV2, StatusBadge } from "@/components/ui-v2";
import type { AssignableUser } from "@/lib/weekly-meetings/teams";
import type { MeetingDetail, MeetingStatus, OfficerTopicDTO } from "@/lib/weekly-meetings/meetings";
import type { WorkflowMeetingContext } from "@/lib/workflow-engine/meeting-sync";
import {
  addFollowUp,
  addOfficerTopic,
  deleteFollowUp,
  deleteOfficerTopic,
  setAttendeePresent,
  setFollowUpStatus,
  setMeetingStatus,
  setPresentationRowFlags,
  syncMeetingAttendees,
  updateOfficerTopic,
} from "@/lib/weekly-meetings/meeting-actions";
import {
  actionPrefillToQuery,
  buildActionPrefillFromMeeting,
  buildActionPrefillFromMeetingFollowUp,
} from "@/lib/people-strategy/action-prefill";
import { createActionFromMeetingFollowUp } from "@/lib/chapters/actions";
import { copyHtmlToClipboard, downloadDocx } from "./copy-docs";
import { MeetingNotesKit } from "./meeting-notes-kit";
import { MeetingPeoplePicker } from "./meeting-people-picker";

const inputCls =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

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
  currentUserId,
  workflowContext,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
  partners: { id: string; name: string }[];
  currentUserId: string;
  workflowContext?: WorkflowMeetingContext | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch {
        /* inline */
      }
    });

  const isImpact = meeting.type === "WEEKLY_TEAM_IMPACT" || meeting.type === "CHAPTER_IMPACT";

  return (
    <div className="flex flex-col gap-5 pb-10">
      <Link href="/meetings" className="text-[13px] font-semibold text-brand-600 hover:opacity-70">
        ← Meetings
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-muted">
              {meeting.typeLabel}
            </span>
            <StatusBadge tone={STATUS_TONE[meeting.status]}>
              {meeting.status.replace("_", " ")}
            </StatusBadge>
          </div>
          <h1 className="m-0 text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {meeting.title}
          </h1>
          <p className="m-0 mt-2 text-[14px] text-ink-muted">{fmtDateTime(meeting.scheduledISO)}</p>
          <p className="m-0 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-muted">
            {meeting.facilitator ? <span>{meeting.facilitator.name}</span> : null}
            {meeting.partner ? (
              <Link href={`/partners/${meeting.partner.id}`} className="text-brand-700 hover:underline">
                {meeting.partner.name}
              </Link>
            ) : null}
            {meeting.weekLabel ? <span>{meeting.weekLabel}</span> : null}
          </p>
        </div>
        <StatusControl meeting={meeting} pending={pending} onSet={(s) => run(() => setMeetingStatus({ meetingId: meeting.id, status: s }))} />
      </header>

      <PeopleSection meeting={meeting} people={people} currentUserId={currentUserId} pending={pending} run={run} />

      {workflowContext ? <WorkflowContextSection ctx={workflowContext} /> : null}

      <MeetingNotesKit meeting={meeting} pending={pending} onSave={run} />

      {isImpact ? <PresentationsSection meeting={meeting} pending={pending} run={run} /> : null}

      <TopicsSection meeting={meeting} pending={pending} run={run} />

      <FollowUpsSection meeting={meeting} people={people} pending={pending} run={run} />

      <BoardDetails meeting={meeting} />

      <p className="m-0 text-center">
        <Link
          href={actionPrefillToQuery(
            buildActionPrefillFromMeeting({
              meetingId: meeting.id,
              title: `Follow-through: ${meeting.title}`,
              chapterId: meeting.chapterContext?.id ?? null,
            }),
          )}
          className="text-[13px] font-medium text-brand-700 hover:underline"
        >
          + New action from this meeting
        </Link>
      </p>
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
  if (meeting.status === "SCHEDULED") {
    return (
      <Button variant="primary" size="md" loading={pending} onClick={() => onSet("IN_PROGRESS")}>
        Start
      </Button>
    );
  }
  if (meeting.status === "IN_PROGRESS") {
    return (
      <Button variant="primary" size="md" loading={pending} onClick={() => onSet("COMPLETED")}>
        Complete
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={() => onSet("SCHEDULED")}>
      Reopen
    </Button>
  );
}

function PeopleSection({
  meeting,
  people,
  currentUserId,
  pending,
  run,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
  currentUserId: string;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const presentCount = meeting.attendees.filter((a) => a.present).length;
  const inviteIds = meeting.attendees.map((a) => a.userId);

  return (
    <CardV2 padding="md">
      <h2 className="m-0 text-[15px] font-bold text-ink">People</h2>
      <p className="m-0 mt-0.5 mb-4 text-[12.5px] text-ink-muted">Who&apos;s invited and who showed up.</p>
      <MeetingPeoplePicker
        people={people}
        selectedIds={inviteIds}
        onChange={(ids) => run(() => syncMeetingAttendees({ meetingId: meeting.id, userIds: ids }))}
        currentUserId={currentUserId}
        hideHeader
      />
      {meeting.attendees.length > 0 ? (
        <div className="mt-4 border-t border-line-soft pt-4">
          <p className="m-0 mb-2 text-[12.5px] text-ink-muted">
            Present — {presentCount}/{meeting.attendees.length}
          </p>
          <div className="flex flex-col gap-1">
            {meeting.attendees.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] hover:bg-surface-soft"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={a.present}
                  disabled={pending}
                  onChange={(e) =>
                    run(() => setAttendeePresent({ attendeeId: a.id, present: e.target.checked }))
                  }
                />
                {a.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </CardV2>
  );
}

function WorkflowContextSection({ ctx }: { ctx: WorkflowMeetingContext }) {
  return (
    <CardV2 padding="md">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="brand">Workflow step</StatusBadge>
          <h2 className="m-0 text-[15px] font-bold text-ink">Part of: {ctx.templateName}</h2>
          {ctx.stageName && <StatusBadge tone="neutral">Stage: {ctx.stageName}</StatusBadge>}
        </div>
        <Link
          href={`/workflows/${ctx.instanceId}`}
          className="text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          Open workflow →
        </Link>
      </div>

      {ctx.stepTitle && (
        <p className="m-0 text-[13px] text-ink-muted">
          This meeting fulfills the step <b className="font-semibold text-ink">{ctx.stepTitle}</b>.
        </p>
      )}
      {ctx.guidance && <p className="m-0 mt-1.5 text-[13px] text-ink-muted">{ctx.guidance}</p>}

      {(ctx.openActionsCount > 0 || ctx.blockedStepsCount > 0) && (
        <p className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
          {ctx.openActionsCount > 0 && (
            <span>
              <b className="font-semibold text-ink">{ctx.openActionsCount}</b> open action
              {ctx.openActionsCount === 1 ? "" : "s"} on this workflow
            </span>
          )}
          {ctx.blockedStepsCount > 0 && (
            <span className="font-medium text-danger-700">
              {ctx.blockedStepsCount} blocked step{ctx.blockedStepsCount === 1 ? "" : "s"}
            </span>
          )}
        </p>
      )}
    </CardV2>
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
  if (meeting.presentations.length === 0) {
    return (
      <CardV2 padding="md">
        <h2 className="m-0 text-[15px] font-bold text-ink">Impact presentations</h2>
        <p className="m-0 mt-2 text-[13px] text-ink-muted">
          Nothing flagged to present yet for {meeting.weekLabel ?? "this week"}.
        </p>
      </CardV2>
    );
  }

  return (
    <CardV2 padding="md">
      <h2 className="m-0 text-[15px] font-bold text-ink">Impact presentations</h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {meeting.presentations.map((p) => (
          <li key={p.rowId} className="rounded-[12px] border border-line-soft px-3 py-2.5">
            <p className="m-0 text-[14px] font-semibold text-ink">{p.item}</p>
            <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
              {p.person} · {p.scopeLabel}
            </p>
            {p.evidenceNext ? (
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{p.evidenceNext}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-brand-600"
                  checked={p.decisionNeeded}
                  disabled={pending}
                  onChange={(e) =>
                    run(() =>
                      setPresentationRowFlags({
                        rowId: p.rowId,
                        meetingId: meeting.id,
                        decisionNeeded: e.target.checked,
                      }),
                    )
                  }
                />
                Decision needed
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-brand-600"
                  checked={p.sendToBoard}
                  disabled={pending}
                  onChange={(e) =>
                    run(() =>
                      setPresentationRowFlags({
                        rowId: p.rowId,
                        meetingId: meeting.id,
                        sendToBoard: e.target.checked,
                      }),
                    )
                  }
                />
                Board
              </label>
            </div>
          </li>
        ))}
      </ul>
    </CardV2>
  );
}

function TopicsSection({
  meeting,
  pending,
  run,
}: {
  meeting: MeetingDetail;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [newTitle, setNewTitle] = useState("");

  function addTopic() {
    const t = newTitle.trim();
    if (!t) return;
    run(() => addOfficerTopic({ meetingId: meeting.id, title: t }));
    setNewTitle("");
  }

  return (
    <CardV2 padding="md">
      <h2 className="m-0 text-[15px] font-bold text-ink">Agenda items</h2>
      <div className="mt-3 flex gap-2">
        <input
          className={inputCls}
          placeholder="Add a topic…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
        />
        <Button variant="secondary" size="sm" loading={pending} disabled={!newTitle.trim()} onClick={addTopic}>
          Add
        </Button>
      </div>
      {meeting.officerTopics.length === 0 ? (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">No topics yet.</p>
      ) : (
        <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {meeting.officerTopics.map((t, i) => (
            <TopicRow key={t.id} index={i + 1} topic={t} run={run} />
          ))}
        </ol>
      )}
    </CardV2>
  );
}

function TopicRow({
  index,
  topic,
  run,
}: {
  index: number;
  topic: OfficerTopicDTO;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [notes, setNotes] = useState(topic.detail ?? "");

  return (
    <li className="flex items-start gap-3 rounded-[12px] border border-line-soft px-3 py-2.5">
      <span className="mt-0.5 text-[13px] font-bold text-brand-600">{index}.</span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14px] font-medium text-ink">{topic.title}</p>
        <textarea
          className={`${inputCls} mt-2 min-h-[52px] text-[13px]`}
          placeholder="Notes on this topic…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (topic.detail ?? "")) {
              run(() => updateOfficerTopic({ topicId: topic.id, detail: notes }));
            }
          }}
        />
      </div>
      <button
        type="button"
        className="shrink-0 text-[12px] text-ink-muted hover:text-danger-700"
        onClick={() => run(() => deleteOfficerTopic({ topicId: topic.id }))}
      >
        ✕
      </button>
    </li>
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

  function addTask() {
    const t = title.trim();
    if (!t) return;
    run(() =>
      addFollowUp({ meetingId: meeting.id, title: t, ownerId: owner || undefined }),
    );
    setTitle("");
    setOwner("");
  }

  return (
    <CardV2 padding="md">
      <h2 className="m-0 text-[15px] font-bold text-ink">Follow-ups</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className={`${inputCls} min-w-[180px] flex-1`}
          placeholder="What needs to happen next?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTask())}
        />
        <select className={`${inputCls} w-40`} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Owner</option>
          {people.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" loading={pending} disabled={!title.trim()} onClick={addTask}>
          Add
        </Button>
      </div>
      {meeting.followUps.length === 0 ? (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">No follow-ups yet.</p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
          {meeting.followUps.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-line-soft px-3 py-2"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-brand-600"
                  checked={f.status === "COMPLETED"}
                  onChange={(e) =>
                    run(() =>
                      setFollowUpStatus({
                        followUpId: f.id,
                        status: e.target.checked ? "COMPLETED" : "OPEN",
                      }),
                    )
                  }
                />
                <span
                  className={`text-[13.5px] ${f.status === "COMPLETED" ? "text-ink-muted line-through" : "text-ink"}`}
                >
                  {f.title}
                  {f.owner ? (
                    <span className="text-ink-muted"> · {f.owner.name}</span>
                  ) : null}
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-2">
                {f.linkedActionId ? (
                  <Link href={`/actions/${f.linkedActionId}`} className="text-[12px] text-success-700 hover:underline">
                    Action
                  </Link>
                ) : meeting.chapterContext ? (
                  <button
                    type="button"
                    className="text-[12px] text-brand-700 hover:underline"
                    disabled={pending}
                    onClick={() => run(() => createActionFromMeetingFollowUp({ followUpId: f.id }))}
                  >
                    Track
                  </button>
                ) : (
                  <Link
                    href={actionPrefillToQuery(
                      buildActionPrefillFromMeetingFollowUp({
                        followUpId: f.id,
                        title: f.title,
                        description: f.detail,
                        meetingId: meeting.id,
                        meetingTitle: meeting.title,
                        suggestedOwnerId: f.owner?.id ?? null,
                        dueDate: f.dueISO,
                      }),
                    )}
                    className="text-[12px] text-brand-700 hover:underline"
                  >
                    Action
                  </Link>
                )}
                <button
                  type="button"
                  className="text-[12px] text-ink-muted hover:text-danger-700"
                  onClick={() => run(() => deleteFollowUp({ followUpId: f.id }))}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardV2>
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
        `<tr><td style="border:1px solid #ccc;padding:6px 9px;">${esc(t.title)}</td><td style="border:1px solid #ccc;padding:6px 9px;">${esc(t.decision ?? t.detail ?? "")}</td></tr>`,
    )
    .join("");
  const th = "background:#5B21B6;color:#fff;border:1px solid #5B21B6;padding:7px 9px;text-align:left;font-size:12px;";
  const body = `
    <h2 style="font-family:Arial;font-size:18px;margin:0 0 4px;">Board roll-up — ${esc(meeting.title)}</h2>
    ${meeting.boardRows.length ? `<table style="border-collapse:collapse;font-family:Arial;font-size:12px;"><thead><tr><th style="${th}">Scope</th><th style="${th}">Person</th><th style="${th}">Item</th></tr></thead><tbody>${presRows}</tbody></table>` : ""}
    ${meeting.boardTopics.length ? `<table style="border-collapse:collapse;font-family:Arial;font-size:12px;margin-top:12px;"><thead><tr><th style="${th}">Topic</th><th style="${th}">Detail</th></tr></thead><tbody>${topicRows}</tbody></table>` : ""}
  `;
  const plain = [
    `Board roll-up — ${meeting.title}`,
    ...meeting.boardRows.map((p) => `• ${p.person}: ${p.item}`),
    ...meeting.boardTopics.map((t) => `• ${t.title}`),
  ].join("\n");
  return { html: body, plain };
}

function BoardDetails({ meeting }: { meeting: MeetingDetail }) {
  const empty = meeting.boardRows.length === 0 && meeting.boardTopics.length === 0;
  if (empty) return null;

  const { html, plain } = buildBoardHtml(meeting);

  async function onCopy() {
    await copyHtmlToClipboard(`<div>${html}</div>`, plain);
  }
  async function onDocx() {
    await downloadDocx(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,
      `board-rollup-${meeting.id}.docx`,
    );
  }

  return (
    <details className="rounded-[14px] border border-line-soft bg-surface/60">
      <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-semibold text-ink">
        Board roll-up ({meeting.boardRows.length + meeting.boardTopics.length})
      </summary>
      <div className="border-t border-line-soft px-4 py-4">
        <div className="mb-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onCopy}>
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={onDocx}>
            Download .docx
          </Button>
        </div>
        {meeting.boardRows.map((p) => (
          <p key={p.rowId} className="m-0 mb-1 text-[13px] text-ink">
            <b>{p.person}:</b> {p.item}
          </p>
        ))}
        {meeting.boardTopics.map((t) => (
          <p key={t.id} className="m-0 mb-1 text-[13px] text-ink">
            <b>{t.title}</b>
            {t.decision || t.detail ? ` — ${t.decision ?? t.detail}` : ""}
          </p>
        ))}
      </div>
    </details>
  );
}
