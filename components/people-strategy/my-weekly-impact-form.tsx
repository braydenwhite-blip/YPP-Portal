"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import {
  deriveImpactFlags,
  type ImpactFlag,
  type ImpactFlagSection,
} from "@/lib/people-strategy/impact-flags";
import {
  addAdhocProgressRow,
  addImpactInputRequestRow,
  addImpactNextStepRow,
  addImpactObjectiveRow,
  addWeeklyTaskDeliverable,
  removeAdhocProgressRow,
  removeImpactInputRequestRow,
  removeImpactNextStepRow,
  removeImpactObjectiveRow,
  submitMyMemberUpdate,
  updateAdhocProgressRow,
  updateImpactInputRequestRow,
  updateImpactNextStepRow,
  updateImpactObjectiveRow,
  updateWeeklyTaskUpdate,
} from "@/lib/people-strategy/weekly-team-brief-actions";
import type {
  MyWeeklyImpactTeamForm,
  WeeklyBriefTaskUpdateDTO,
} from "@/lib/people-strategy/weekly-team-briefs";

const cell =
  "w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-brand-400 disabled:opacity-60";
const cellArea =
  "min-h-[40px] w-full resize-y rounded-md border border-[var(--border)] bg-white px-2.5 py-2 text-[13px] leading-snug text-ink outline-none focus:border-brand-400 disabled:opacity-60";
const errorRing = "border-amber-400 ring-1 ring-amber-300";

function statusTone(status: string): StatusTone {
  if (status === "FINALIZED" || status === "PRESENTED") return "success";
  if (status === "SUBMITTED") return "success";
  if (status === "REOPENED") return "info";
  return "neutral";
}

function isoToDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function weekLabel(weekKey: string): string {
  const d = new Date(`${weekKey}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return weekKey;
  return `Week of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d)}`;
}

// ---- local row state ----------------------------------------------------
type ObjRow = { id: string; objective: string; deliverable: string; targetDate: string; linkUrl: string; linkLabel: string };
type NextRow = { id: string; action: string; deliverableNextWeek: string; dueDate: string };
type InputRow = { id: string; request: string; neededFrom: string; neededBy: string };
type ProgRow = {
  id: string;
  adhoc: boolean;
  title: string;
  whatYouDid: string;
  outcome: string;
  // tracked: links live on the ActionItem; adhoc: a single inline link
  links: Array<{ id: string; label: string; url: string }>;
  adhocLinkUrl: string;
  adhocLinkLabel: string;
  newLinkLabel: string;
  newLinkUrl: string;
  liveStatus: string | null;
  deadlineISO: string | null;
  carriedForward: boolean;
  passthrough: WeeklyBriefTaskUpdateDTO;
};

function toObjRow(o: MyWeeklyImpactTeamForm["form"]["objectives"][number]): ObjRow {
  return {
    id: o.id,
    objective: o.objective ?? "",
    deliverable: o.deliverable ?? "",
    targetDate: isoToDateInput(o.targetDateISO),
    linkUrl: o.linkUrl ?? "",
    linkLabel: o.linkLabel ?? "",
  };
}
function toNextRow(n: MyWeeklyImpactTeamForm["form"]["nextSteps"][number]): NextRow {
  return { id: n.id, action: n.action ?? "", deliverableNextWeek: n.deliverableNextWeek ?? "", dueDate: isoToDateInput(n.dueDateISO) };
}
function toInputRow(r: MyWeeklyImpactTeamForm["form"]["inputRequests"][number]): InputRow {
  return { id: r.id, request: r.request ?? "", neededFrom: r.neededFrom ?? "", neededBy: isoToDateInput(r.neededByISO) };
}
function toProgRow(t: WeeklyBriefTaskUpdateDTO): ProgRow {
  return {
    id: t.id,
    adhoc: t.isAdhoc,
    title: t.taskTitle ?? "",
    whatYouDid: t.workCompleted ?? "",
    outcome: t.currentResult ?? "",
    links: (t.allDeliverables.length ? t.allDeliverables : t.deliverables).map((d) => ({ id: d.id, label: d.label, url: d.url })),
    adhocLinkUrl: t.adhocLink?.url ?? "",
    adhocLinkLabel: t.adhocLink?.label ?? "",
    newLinkLabel: "",
    newLinkUrl: "",
    liveStatus: t.liveStatus,
    deadlineISO: t.deadlineISO,
    carriedForward: Boolean(t.carriedForward),
    passthrough: t,
  };
}

export function MyWeeklyImpactForm({ team, roleLabel }: { team: MyWeeklyImpactTeamForm; roleLabel?: string }) {
  const router = useRouter();
  const { form } = team;
  const locked = team.briefStatus === "FINALIZED";

  const [objs, setObjs] = useState<ObjRow[]>(form.objectives.map(toObjRow));
  const [progress, setProgress] = useState<ProgRow[]>(form.taskUpdates.map(toProgRow));
  const [nexts, setNexts] = useState<NextRow[]>(form.nextSteps.map(toNextRow));
  const [inputs, setInputs] = useState<InputRow[]>(form.inputRequests.map(toInputRow));

  const [serverFlags, setServerFlags] = useState<ImpactFlag[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const disabled = locked || pending;
  const submitted = form.status === "SUBMITTED" || form.status === "PRESENTED";

  // Live flags — same engine the server uses on submit.
  const flags = useMemo(
    () =>
      deriveImpactFlags({
        objectives: objs.map((o) => ({ id: o.id, objective: o.objective, deliverable: o.deliverable, hasLink: Boolean(o.linkUrl.trim()) })),
        progress: progress.map((p) => ({
          id: p.id,
          deliverable: p.title,
          whatYouDid: p.whatYouDid,
          outcome: p.outcome,
          hasLink: p.adhoc ? Boolean(p.adhocLinkUrl.trim()) : p.links.length > 0,
        })),
        nextSteps: nexts.map((n) => ({ id: n.id, action: n.action, deliverableNextWeek: n.deliverableNextWeek, hasDueDate: Boolean(n.dueDate.trim()) })),
        inputRequests: inputs.map((r) => ({ id: r.id, request: r.request, hasWho: Boolean(r.neededFrom.trim()) })),
      }),
    [objs, progress, nexts, inputs]
  );
  const flagCount = flags.length;
  const blockingCount = flags.filter((f) => f.blocking).length;

  function chip(section: ImpactFlagSection, rowId: string, field: string): string | null {
    const f = flags.find((x) => x.section === section && x.rowId === rowId && x.field === field);
    return f?.message ?? null;
  }
  function ringIf(section: ImpactFlagSection, rowId: string, field: string): string {
    return chip(section, rowId, field) ? errorRing : "";
  }

  async function persistAll() {
    for (const o of objs) {
      await updateImpactObjectiveRow({ id: o.id, objective: o.objective, deliverable: o.deliverable, targetDate: o.targetDate, linkUrl: o.linkUrl, linkLabel: o.linkLabel });
    }
    for (const p of progress) {
      if (p.adhoc) {
        await updateAdhocProgressRow({ id: p.id, deliverable: p.title, whatYouDid: p.whatYouDid, outcome: p.outcome, adhocLinkLabel: p.adhocLinkLabel, adhocLinkUrl: p.adhocLinkUrl });
      } else {
        const t = p.passthrough;
        await updateWeeklyTaskUpdate({
          updateId: p.id,
          statusNarrative: t.statusNarrative ?? "",
          workCompleted: p.whatYouDid,
          currentResult: p.outcome,
          remainingWork: t.remainingWork ?? "",
          blockerNote: t.blockerNote ?? "",
          explanation: t.explanation ?? "",
          decisionNeeded: t.decisionNeeded ?? "",
          nextAction: t.nextAction ?? "",
          teamMeetingPresenterId: t.teamMeetingPresenter?.id ?? "",
          officerMeetingPresenterId: t.officerMeetingPresenter?.id ?? "",
          teamMeetingReady: t.teamMeetingReady,
          officerMeetingReady: t.officerMeetingReady,
          escalationNeeded: t.escalationNeeded,
          officerReviewRequested: t.officerReviewRequested,
        });
      }
    }
    for (const n of nexts) {
      await updateImpactNextStepRow({ id: n.id, action: n.action, deliverableNextWeek: n.deliverableNextWeek, dueDate: n.dueDate });
    }
    for (const r of inputs) {
      await updateImpactInputRequestRow({ id: r.id, request: r.request, neededFrom: r.neededFrom, neededBy: r.neededBy });
    }
  }

  function saveDraft() {
    setNote(null);
    startTransition(async () => {
      await persistAll();
      setNote("Saved. Your changes are in — submit when you're ready.");
      router.refresh();
    });
  }

  function submit() {
    setNote(null);
    startTransition(async () => {
      await persistAll();
      const res = await submitMyMemberUpdate({ memberUpdateId: form.id });
      if (res.ok) {
        setServerFlags(null);
        setNote("Submitted ✓ — your update is ready for this week's Impact Meeting.");
        router.refresh();
      } else {
        setServerFlags(res.flags);
      }
    });
  }

  // ---- add / remove rows (hit the server to get/drop ids) ----
  function addObjective() {
    startTransition(async () => {
      const { id } = await addImpactObjectiveRow({ memberUpdateId: form.id });
      setObjs((p) => [...p, { id, objective: "", deliverable: "", targetDate: "", linkUrl: "", linkLabel: "" }]);
    });
  }
  function removeObjective(id: string) {
    startTransition(async () => {
      await removeImpactObjectiveRow({ id });
      setObjs((p) => p.filter((r) => r.id !== id));
    });
  }
  function addProgress() {
    startTransition(async () => {
      const { id } = await addAdhocProgressRow({ memberUpdateId: form.id });
      setProgress((p) => [
        ...p,
        { id, adhoc: true, title: "", whatYouDid: "", outcome: "", links: [], adhocLinkUrl: "", adhocLinkLabel: "", newLinkLabel: "", newLinkUrl: "", liveStatus: null, deadlineISO: null, carriedForward: false, passthrough: {} as WeeklyBriefTaskUpdateDTO },
      ]);
    });
  }
  function removeProgress(id: string) {
    startTransition(async () => {
      await removeAdhocProgressRow({ id });
      setProgress((p) => p.filter((r) => r.id !== id));
    });
  }
  function addNext() {
    startTransition(async () => {
      const { id } = await addImpactNextStepRow({ memberUpdateId: form.id });
      setNexts((p) => [...p, { id, action: "", deliverableNextWeek: "", dueDate: "" }]);
    });
  }
  function removeNext(id: string) {
    startTransition(async () => {
      await removeImpactNextStepRow({ id });
      setNexts((p) => p.filter((r) => r.id !== id));
    });
  }
  function addInput() {
    startTransition(async () => {
      const { id } = await addImpactInputRequestRow({ memberUpdateId: form.id });
      setInputs((p) => [...p, { id, request: "", neededFrom: "", neededBy: "" }]);
    });
  }
  function removeInput(id: string) {
    startTransition(async () => {
      await removeImpactInputRequestRow({ id });
      setInputs((p) => p.filter((r) => r.id !== id));
    });
  }
  function addTrackedLink(p: ProgRow) {
    if (!p.newLinkLabel.trim() || !p.newLinkUrl.trim()) return;
    startTransition(async () => {
      await addWeeklyTaskDeliverable({ updateId: p.id, label: p.newLinkLabel, url: p.newLinkUrl });
      router.refresh();
    });
  }

  const headerStatus =
    form.status === "DRAFT" && flagCount > 0 ? `Draft · ${flagCount} ${flagCount === 1 ? "flag" : "flags"}` : form.status === "DRAFT" ? "Draft" : form.status;

  return (
    <section className="overflow-hidden rounded-2xl border border-line-card bg-surface shadow-card">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[22px] font-bold leading-tight text-ink">Weekly Impact — {form.user.name}</h2>
          <p className="m-0 mt-1 text-[13px] font-semibold text-ink-muted">
            {roleLabel ? `${roleLabel} · ` : ""}
            {team.workstreamTitle} · {weekLabel(team.weekKey)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge tone={form.status === "DRAFT" && flagCount > 0 ? "warning" : statusTone(form.status)}>{headerStatus}</StatusBadge>
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="rounded-lg bg-brand-700 px-4 py-2 text-[13px] font-bold text-white shadow-sm disabled:opacity-50"
          >
            {pending ? "Saving…" : submitted ? "Re-submit →" : "Submit →"}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-5">
        {form.inputNeededCarried ? (
          <p className="m-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            Carried from last week — you asked for input and it wasn&apos;t resolved. Update it or clear it.
          </p>
        ) : null}

        {/* Section 1 — Objective & Deliverables */}
        <Section number={1} title="Objective & Deliverables">
          <TableHead cols={["Objective", "Deliverable", "Target date", ""]} widths="md:grid-cols-[1.4fr_1.4fr_120px_36px]" />
          {objs.map((o) => (
            <Row key={o.id} widths="md:grid-cols-[1.4fr_1.4fr_120px_36px]">
              <Field flag={chip("objective", o.id, "objective")}>
                <textarea className={`${cellArea} ${ringIf("objective", o.id, "objective")}`} value={o.objective} disabled={disabled} placeholder="Expand NJ partner-school network" onChange={(e) => setObjs((p) => p.map((r) => (r.id === o.id ? { ...r, objective: e.target.value } : r)))} />
              </Field>
              <Field flag={chip("objective", o.id, "deliverable") ?? chip("objective", o.id, "link")}>
                <textarea className={`${cellArea} ${ringIf("objective", o.id, "deliverable")}`} value={o.deliverable} disabled={disabled} placeholder="Signed LOIs from 3 new schools" onChange={(e) => setObjs((p) => p.map((r) => (r.id === o.id ? { ...r, deliverable: e.target.value } : r)))} />
                <LinkControl
                  url={o.linkUrl}
                  label={o.linkLabel}
                  disabled={disabled}
                  onChange={(url, label) => setObjs((p) => p.map((r) => (r.id === o.id ? { ...r, linkUrl: url, linkLabel: label } : r)))}
                />
              </Field>
              <input type="date" className={cell} value={o.targetDate} disabled={disabled} onChange={(e) => setObjs((p) => p.map((r) => (r.id === o.id ? { ...r, targetDate: e.target.value } : r)))} />
              <RemoveButton disabled={disabled} onClick={() => removeObjective(o.id)} />
            </Row>
          ))}
          <AddRow disabled={disabled} onClick={addObjective} label="Add objective" />
        </Section>

        {/* Section 2 — This Week's Progress */}
        <Section number={2} title="This Week's Progress">
          <TableHead cols={["Deliverable", "What you did", "Link / file", "Outcome", ""]} widths="md:grid-cols-[1fr_1.3fr_0.9fr_1.1fr_36px]" />
          {progress.map((p) => (
            <Row key={p.id} widths="md:grid-cols-[1fr_1.3fr_0.9fr_1.1fr_36px]">
              {p.adhoc ? (
                <input className={cell} value={p.title} disabled={disabled} placeholder="Partner tracker" onChange={(e) => setProgress((s) => s.map((r) => (r.id === p.id ? { ...r, title: e.target.value } : r)))} />
              ) : (
                <div className="rounded-md border border-line-soft bg-surface-muted px-2.5 py-2 text-[13px] font-semibold text-ink">
                  {p.title || "Tracked task"}
                  <span className="ml-1 text-[10px] font-bold uppercase text-ink-muted">· from tracker</span>
                </div>
              )}
              <Field flag={chip("progress", p.id, "whatYouDid")}>
                <textarea className={`${cellArea} ${ringIf("progress", p.id, "whatYouDid")}`} value={p.whatYouDid} disabled={disabled} placeholder="Cold-contacted 8 schools, booked 3 meetings" onChange={(e) => setProgress((s) => s.map((r) => (r.id === p.id ? { ...r, whatYouDid: e.target.value } : r)))} />
              </Field>
              <Field flag={chip("progress", p.id, "link")}>
                {p.adhoc ? (
                  <LinkControl url={p.adhocLinkUrl} label={p.adhocLinkLabel} disabled={disabled} onChange={(url, label) => setProgress((s) => s.map((r) => (r.id === p.id ? { ...r, adhocLinkUrl: url, adhocLinkLabel: label } : r)))} />
                ) : (
                  <TrackedLinks
                    p={p}
                    disabled={disabled}
                    onNew={(label, url) => setProgress((s) => s.map((r) => (r.id === p.id ? { ...r, newLinkLabel: label, newLinkUrl: url } : r)))}
                    onAdd={() => addTrackedLink(p)}
                  />
                )}
              </Field>
              <Field flag={chip("progress", p.id, "outcome")}>
                <textarea className={`${cellArea} ${ringIf("progress", p.id, "outcome")}`} value={p.outcome} disabled={disabled} placeholder="Pipeline: 2 → 5 warm leads" onChange={(e) => setProgress((s) => s.map((r) => (r.id === p.id ? { ...r, outcome: e.target.value } : r)))} />
              </Field>
              {p.adhoc ? <RemoveButton disabled={disabled} onClick={() => removeProgress(p.id)} /> : <span className="hidden md:block" />}
            </Row>
          ))}
          <AddRow disabled={disabled} onClick={addProgress} label="Add progress row" />
        </Section>

        {/* Section 3 — Next Steps */}
        <Section number={3} title="Next Steps">
          <TableHead cols={["Action", "Deliverable you'll show next week", "Due date", ""]} widths="md:grid-cols-[1.3fr_1.5fr_120px_36px]" />
          {nexts.map((n) => (
            <Row key={n.id} widths="md:grid-cols-[1.3fr_1.5fr_120px_36px]">
              <Field flag={chip("nextStep", n.id, "action")}>
                <textarea className={`${cellArea} ${ringIf("nextStep", n.id, "action")}`} value={n.action} disabled={disabled} placeholder="Follow up with 3 interested schools" onChange={(e) => setNexts((p) => p.map((r) => (r.id === n.id ? { ...r, action: e.target.value } : r)))} />
              </Field>
              <textarea className={cellArea} value={n.deliverableNextWeek} disabled={disabled} placeholder="Updated tracker with confirmed meetings" onChange={(e) => setNexts((p) => p.map((r) => (r.id === n.id ? { ...r, deliverableNextWeek: e.target.value } : r)))} />
              <Field flag={chip("nextStep", n.id, "dueDate")}>
                <input type="date" className={`${cell} ${ringIf("nextStep", n.id, "dueDate")}`} value={n.dueDate} disabled={disabled} onChange={(e) => setNexts((p) => p.map((r) => (r.id === n.id ? { ...r, dueDate: e.target.value } : r)))} />
              </Field>
              <RemoveButton disabled={disabled} onClick={() => removeNext(n.id)} />
            </Row>
          ))}
          <AddRow disabled={disabled} onClick={addNext} label="Add next step" />
        </Section>

        {/* Section 4 — Input Needed */}
        <Section number={4} title="Input Needed">
          <TableHead cols={["Question / request", "Who you need it from", "By when", ""]} widths="md:grid-cols-[1.8fr_1fr_120px_36px]" />
          {inputs.map((r) => (
            <Row key={r.id} widths="md:grid-cols-[1.8fr_1fr_120px_36px]">
              <Field flag={chip("input", r.id, "request")}>
                <textarea className={`${cellArea} ${ringIf("input", r.id, "request")}`} value={r.request} disabled={disabled} placeholder="Does Edison NJ count as Wave 2 or 3?" onChange={(e) => setInputs((p) => p.map((x) => (x.id === r.id ? { ...x, request: e.target.value } : x)))} />
              </Field>
              <Field flag={chip("input", r.id, "neededFrom")}>
                <input className={`${cell} ${ringIf("input", r.id, "neededFrom")}`} value={r.neededFrom} disabled={disabled} placeholder="Brayden + Sam" onChange={(e) => setInputs((p) => p.map((x) => (x.id === r.id ? { ...x, neededFrom: e.target.value } : x)))} />
              </Field>
              <input type="date" className={cell} value={r.neededBy} disabled={disabled} onChange={(e) => setInputs((p) => p.map((x) => (x.id === r.id ? { ...x, neededBy: e.target.value } : x)))} />
              <RemoveButton disabled={disabled} onClick={() => removeInput(r.id)} />
            </Row>
          ))}
          <AddRow disabled={disabled} onClick={addInput} label="Add input request" />
        </Section>

        {serverFlags && serverFlags.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
            <p className="m-0 font-semibold">Resolve these flags before submitting:</p>
            <ul className="m-0 mt-1 list-disc pl-5">
              {serverFlags.filter((f) => f.blocking).map((f, i) => (
                <li key={`${f.section}-${f.rowId}-${f.field}-${i}`}>{f.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {note ? <p className="m-0 text-[13px] font-medium text-complete-700">{note}</p> : null}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-4">
          {blockingCount > 0 ? (
            <span className="mr-auto text-[13px] font-semibold text-amber-700">
              {blockingCount} {blockingCount === 1 ? "flag needs" : "flags need"} attention before submitting
            </span>
          ) : (
            <span className="mr-auto text-[13px] font-semibold text-ink-muted">{locked ? "This week is finalized — locked for edits." : "Looks clean — ready to submit."}</span>
          )}
          <button type="button" onClick={saveDraft} disabled={disabled} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-50">
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={submit} disabled={disabled} className="rounded-lg bg-brand-700 px-5 py-2 text-[13px] font-bold text-white shadow-sm disabled:opacity-50">
            {submitted ? "Re-submit presentation →" : "Submit presentation →"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---- small presentational helpers --------------------------------------
function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line-soft bg-surface-muted/40">
      <div className="flex items-center gap-2.5 rounded-t-xl bg-brand-50 px-4 py-2.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-brand-700 text-[12px] font-bold text-white">{number}</span>
        <h3 className="m-0 text-[15px] font-bold text-ink">{title}</h3>
      </div>
      <div className="flex flex-col gap-2 px-4 py-3">{children}</div>
    </section>
  );
}

function TableHead({ cols, widths }: { cols: string[]; widths: string }) {
  return (
    <div className={`hidden gap-2 px-1 md:grid ${widths}`}>
      {cols.map((c, i) => (
        <span key={`${c}-${i}`} className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
          {c}
        </span>
      ))}
    </div>
  );
}

function Row({ widths, children }: { widths: string; children: React.ReactNode }) {
  return <div className={`grid grid-cols-1 items-start gap-2 rounded-lg border border-line-soft bg-white p-2 ${widths}`}>{children}</div>;
}

function Field({ flag, children }: { flag?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      {flag ? <span className="text-[11.5px] font-semibold text-amber-700">⚠ {flag}</span> : null}
    </div>
  );
}

function RemoveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label="Remove row" className="mt-0.5 flex size-8 items-center justify-center self-start rounded-md text-[18px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-40">
      ×
    </button>
  );
}

function AddRow({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="self-start rounded-md px-1 py-1 text-[13px] font-semibold text-brand-700 hover:underline disabled:opacity-40">
      + {label}
    </button>
  );
}

function LinkControl({ url, label, disabled, onChange }: { url: string; label: string; disabled: boolean; onChange: (url: string, label: string) => void }) {
  const [open, setOpen] = useState(false);
  if (url) {
    return (
      <div className="flex items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="truncate rounded-md border border-line-soft bg-surface-muted px-2 py-1 text-[12px] font-semibold text-brand-700 no-underline">
          🔗 {label?.trim() || "Open link"}
        </a>
        {!disabled ? (
          <button type="button" onClick={() => onChange("", "")} className="text-[12px] font-semibold text-ink-muted hover:underline">
            remove
          </button>
        ) : null}
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="self-start text-[12px] font-semibold text-brand-700 hover:underline disabled:opacity-40">
        + Add link / Drive doc
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <input className={cell} placeholder="Label (e.g. Tracker)" value={label} disabled={disabled} onChange={(e) => onChange(url, e.target.value)} />
      <input className={cell} placeholder="https://…" value={url} disabled={disabled} onChange={(e) => onChange(e.target.value, label)} />
    </div>
  );
}

function TrackedLinks({ p, disabled, onNew, onAdd }: { p: ProgRow; disabled: boolean; onNew: (label: string, url: string) => void; onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      {p.links.length ? (
        <div className="flex flex-wrap gap-1">
          {p.links.map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="truncate rounded-md border border-line-soft bg-surface-muted px-2 py-1 text-[12px] font-semibold text-brand-700 no-underline">
              🔗 {l.label}
            </a>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-1">
          <input className={cell} placeholder="Label" value={p.newLinkLabel} disabled={disabled} onChange={(e) => onNew(e.target.value, p.newLinkUrl)} />
          <div className="flex gap-1">
            <input className={cell} placeholder="https://…" value={p.newLinkUrl} disabled={disabled} onChange={(e) => onNew(p.newLinkLabel, e.target.value)} />
            <button type="button" onClick={onAdd} disabled={disabled || !p.newLinkLabel.trim() || !p.newLinkUrl.trim()} className="rounded-md border border-[var(--border)] px-2 text-[12px] font-semibold text-ink disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="self-start text-[12px] font-semibold text-brand-700 hover:underline disabled:opacity-40">
          + Add link / file
        </button>
      )}
    </div>
  );
}
