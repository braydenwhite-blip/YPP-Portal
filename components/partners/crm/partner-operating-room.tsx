"use client";

/**
 * Partner operating room (Partner Automation, Phase 1).
 *
 * The focused detail surface for one partner: overview + next action, contact
 * info, outreach + workflow actions, logistics checklist, timeline, and issues.
 * Every action calls a chapter-scoped server action and writes the timeline.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Button,
  ButtonLink,
  CardV2,
  ModalV2,
  ModalFooterV2,
  StatusBadge,
  ToastV2,
  cn,
} from "@/components/ui-v2";
import { OutreachComposer } from "@/components/partners/crm/outreach-composer";
import { buildMeetingBrief, renderMeetingBriefText } from "@/lib/partners/meeting-brief";
import {
  MEETING_OUTCOMES,
  MEETING_OUTCOME_LABELS,
  CLOSE_REASONS,
  CLOSE_REASON_LABELS,
} from "@/lib/partners/transitions";
import { LOGISTICS_ITEMS } from "@/lib/partners/logistics";
import {
  logResponse,
  scheduleMeeting,
  logMeetingOutcome,
  scheduleFollowUp,
  sendProposal,
  confirmPartner,
  closePartner,
  toggleLogisticsItem,
  raisePartnerIssue,
  resolvePartnerIssue,
  logPartnerCheckIn,
  addPartnerTimelineNote,
} from "@/lib/partners/crm-actions";
import type { PartnerDetailDTO } from "@/lib/partners/detail-types";

type ModalKind = "response" | "meeting" | "outcome" | "followup" | "close" | "issue" | "note" | "brief" | null;

const inputCls =
  "w-full rounded-[8px] border border-line-soft bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand-500 focus:outline-none";

export function PartnerOperatingRoom({ partner }: { partner: PartnerDetailDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ tone: "success" | "danger"; msg: string } | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  // Modal field state.
  const [text, setText] = useState("");
  const [dateVal, setDateVal] = useState("");
  const [outcome, setOutcome] = useState<(typeof MEETING_OUTCOMES)[number]>("CONFIRMED_YES");
  const [closeReason, setCloseReason] = useState<(typeof CLOSE_REASONS)[number]>("NOT_A_FIT");
  const [escalate, setEscalate] = useState(false);

  const brief = useMemo(() => buildMeetingBrief(partner.meetingBriefContext), [partner.meetingBriefContext]);

  function run(fn: () => Promise<{ ok: boolean; error?: string; summary?: string }>, okMsg?: string) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          setToast({ tone: "danger", msg: res.error ?? "Something went wrong." });
          return;
        }
        setToast({ tone: "success", msg: okMsg ?? res.summary ?? "Done ✓" });
        setModal(null);
        setText("");
        setDateVal("");
        router.refresh();
      } catch {
        setToast({ tone: "danger", msg: "Something went wrong. Try again." });
      }
    });
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(renderMeetingBriefText(brief));
      setToast({ tone: "success", msg: "Brief copied ✓" });
    } catch {
      setToast({ tone: "danger", msg: "Couldn't copy — select the text manually." });
    }
  }

  const c = partner.contact;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <ButtonLink href="/partners" variant="ghost" size="sm" className="w-fit">
          ← All partners
        </ButtonLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.4px] text-ink">{partner.name}</h1>
              <StatusBadge tone={partner.laneTone} withDot>{partner.laneLabel}</StatusBadge>
            </div>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              {[partner.typeLabel, partner.chapterLabel, c.location].filter(Boolean).join(" · ") || "Partner"}
            </p>
          </div>
        </div>
        {/* Next action banner */}
        <CardV2 padding="md" className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Next action</p>
            <p className={cn("m-0 mt-0.5 text-[15px] font-bold", partner.nextAction.tone === "danger" ? "text-rose-600" : "text-ink")}>
              {partner.nextAction.label}
              {partner.nextAction.detail ? <span className="ml-2 text-[12.5px] font-medium text-ink-muted">{partner.nextAction.detail}</span> : null}
            </p>
          </div>
          <OutreachComposer
            partnerId={partner.id}
            context={partner.emailContext}
            defaultKind={partner.lane === "RESEARCH" ? "INITIAL" : "FOLLOW_UP"}
            buttonVariant="primary"
            buttonLabel="Generate email"
          />
        </CardV2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(280px,360px)]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Actions */}
          <CardV2 padding="md" className="flex flex-col gap-3">
            <h2 className="m-0 text-[14px] font-bold text-ink">Outreach &amp; Actions</h2>
            <div className="flex flex-wrap gap-2">
              <OutreachComposer
                partnerId={partner.id}
                context={partner.emailContext}
                defaultKind={partner.lane === "RESEARCH" ? "INITIAL" : "FOLLOW_UP"}
                buttonLabel="Generate email"
              />
              <Button variant="secondary" size="sm" onClick={() => setModal("response")}>Log response</Button>
              <Button variant="secondary" size="sm" onClick={() => { setDateVal(""); setModal("meeting"); }}>Schedule meeting</Button>
              <Button variant="secondary" size="sm" onClick={() => setModal("brief")}>Meeting brief</Button>
              <Button variant="secondary" size="sm" onClick={() => setModal("outcome")}>Log meeting outcome</Button>
              <Button variant="secondary" size="sm" onClick={() => { setDateVal(""); setModal("followup"); }}>Schedule follow-up</Button>
              <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => sendProposal({ partnerId: partner.id }), "Proposal sent")}>Send proposal</Button>
              <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => confirmPartner({ partnerId: partner.id }), "Partner confirmed")}>Confirm partner</Button>
              <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => logPartnerCheckIn({ partnerId: partner.id }), "Check-in logged")}>Log check-in</Button>
              <Button variant="ghost" size="sm" onClick={() => { setEscalate(false); setModal("issue"); }}>Raise issue</Button>
              <Button variant="ghost" size="sm" onClick={() => { setCloseReason("NOT_A_FIT"); setModal("close"); }}>Close partner</Button>
            </div>
          </CardV2>

          {/* Logistics checklist (confirmed partners) */}
          {partner.logistics.relevant && (
            <CardV2 padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 text-[14px] font-bold text-ink">Logistics readiness</h2>
                <StatusBadge tone={partner.logistics.readiness.isComplete ? "success" : "warning"}>
                  {partner.logistics.readiness.complete}/{partner.logistics.readiness.total}
                </StatusBadge>
              </div>
              {!partner.logistics.readiness.isComplete && (
                <p className="m-0 text-[12px] font-semibold text-amber-600">Confirmed, but logistics are incomplete — not launch-ready yet.</p>
              )}
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {LOGISTICS_ITEMS.map((item) => {
                  const done = partner.logistics.readiness.items.find((i) => i.key === item.key)?.done ?? false;
                  return (
                    <li key={item.key}>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={pending}
                          onChange={(e) => run(() => toggleLogisticsItem({ partnerId: partner.id, key: item.key, done: e.target.checked }))}
                          className="h-4 w-4 accent-brand-600"
                        />
                        <span className={done ? "text-ink-muted line-through" : ""}>{item.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </CardV2>
          )}

          {/* Open issues */}
          {partner.openIssues.length > 0 && (
            <CardV2 padding="md" className="flex flex-col gap-2.5">
              <h2 className="m-0 text-[14px] font-bold text-ink">Open issues</h2>
              {partner.openIssues.map((issue) => (
                <div key={issue.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-line-soft px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={issue.overdue ? "danger" : "warning"}>{issue.severity}</StatusBadge>
                      {issue.escalated && <StatusBadge tone="danger">Escalated</StatusBadge>}
                      <span className="text-[11.5px] text-ink-muted">{issue.dateLabel}{issue.overdue ? " · >24h open" : ""}</span>
                    </div>
                    <p className="m-0 mt-1 text-[13px] text-ink">{issue.body}</p>
                  </div>
                  <Button variant="ghost" size="sm" loading={pending} onClick={() => run(() => resolvePartnerIssue({ partnerId: partner.id, issueNoteId: issue.id }), "Issue resolved")}>
                    Resolve
                  </Button>
                </div>
              ))}
            </CardV2>
          )}

          {/* Timeline */}
          <CardV2 padding="md" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-[14px] font-bold text-ink">Timeline</h2>
              <Button variant="ghost" size="sm" onClick={() => setModal("note")}>+ Note</Button>
            </div>
            {partner.timeline.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-muted">No activity yet. Generate an email to get started.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {partner.timeline.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="m-0 text-[12.5px] font-semibold text-ink">
                        {e.kindLabel}
                        <span className="ml-2 text-[11px] font-normal text-ink-muted">{e.dateLabel}{e.authorName ? ` · ${e.authorName}` : ""}</span>
                      </p>
                      <p className="m-0 mt-0.5 whitespace-pre-wrap text-[12.5px] text-ink-muted">{e.body}</p>
                      {e.followUpLabel && <p className="m-0 mt-0.5 text-[11px] font-semibold text-brand-600">Follow-up: {e.followUpLabel}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardV2>
        </div>

        {/* Sidebar: contact + meeting */}
        <div className="flex flex-col gap-4">
          <CardV2 padding="md" className="flex flex-col gap-2.5">
            <h2 className="m-0 text-[14px] font-bold text-ink">Contact information</h2>
            <Field label="Contact" value={[c.name, c.title].filter(Boolean).join(" · ") || "—"} />
            <Field label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
            <Field label="Phone" value={c.phone} href={c.phone ? `tel:${c.phone}` : undefined} />
            <Field label="Website" value={c.website} href={c.website ?? undefined} external />
            <Field label="Address" value={c.location} />
          </CardV2>

          <CardV2 padding="md" className="flex flex-col gap-2">
            <h2 className="m-0 text-[14px] font-bold text-ink">Meeting</h2>
            <Field label="Scheduled" value={partner.meeting.dateLabel ?? "Not scheduled"} />
            <Field label="Next follow-up" value={partner.nextFollowUp.label ?? "None"} highlight={partner.nextFollowUp.overdue} />
          </CardV2>

          {partner.connectedClasses.length > 0 && (
            <CardV2 padding="md" className="flex flex-col gap-2">
              <h2 className="m-0 text-[14px] font-bold text-ink">
                Connected classes ({partner.classCount})
              </h2>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {partner.connectedClasses.map((cls) => (
                  <li key={cls.id} className="rounded-[8px] border border-line-soft px-2.5 py-2">
                    <p className="m-0 text-[12.5px] font-semibold text-ink">{cls.title}</p>
                    <p className="m-0 mt-0.5 text-[11.5px] text-ink-muted">
                      {[
                        cls.statusLabel,
                        cls.instructorName ? `Instructor: ${cls.instructorName}` : "Needs instructor",
                        `${cls.students} student${cls.students === 1 ? "" : "s"}`,
                      ].join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </CardV2>
          )}

          {partner.openActions.length > 0 && (
            <CardV2 padding="md" className="flex flex-col gap-2">
              <h2 className="m-0 text-[14px] font-bold text-ink">
                Open actions ({partner.openActions.length})
              </h2>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {partner.openActions.map((action) => (
                  <li key={action.id}>
                    <Link
                      href={action.href}
                      className="flex items-center justify-between gap-2 rounded-[8px] border border-line-soft px-2.5 py-2 no-underline transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">{action.title}</span>
                        <span className="block truncate text-[11.5px] text-ink-muted">
                          {action.ownerName ?? "No owner"}
                        </span>
                      </span>
                      <StatusBadge tone={action.overdue ? "danger" : "neutral"}>
                        {action.statusLabel}
                      </StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardV2>
          )}
        </div>
      </div>

      {/* ----- Modals ----- */}
      <ModalV2 open={modal === "response"} onClose={() => setModal(null)} size="md">
        <ModalTitle>Log a response</ModalTitle>
        <textarea className={`${inputCls} mt-3 min-h-[100px]`} placeholder="What did they say?" value={text} onChange={(e) => setText(e.target.value)} />
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" size="md" loading={pending} onClick={() => run(() => logResponse({ partnerId: partner.id, body: text || undefined }), "Response logged")}>Log response</Button>
        </ModalFooterV2>
      </ModalV2>

      <ModalV2 open={modal === "meeting"} onClose={() => setModal(null)} size="md">
        <ModalTitle>Schedule a meeting</ModalTitle>
        <label className="mt-3 block text-[12px] font-semibold text-ink-muted">Date &amp; time</label>
        <input type="datetime-local" className={`${inputCls} mt-1`} value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
        <textarea className={`${inputCls} mt-3 min-h-[70px]`} placeholder="Notes (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" size="md" loading={pending} disabled={!dateVal} onClick={() => run(() => scheduleMeeting({ partnerId: partner.id, meetingDate: new Date(dateVal).toISOString(), note: text || undefined }))}>Schedule</Button>
        </ModalFooterV2>
      </ModalV2>

      <ModalV2 open={modal === "outcome"} onClose={() => setModal(null)} size="md">
        <ModalTitle>Log meeting outcome</ModalTitle>
        <p className="m-0 mt-1 text-[12px] text-ink-muted">Log every meeting right away — we&rsquo;ll set the next follow-up automatically.</p>
        <label className="mt-3 block text-[12px] font-semibold text-ink-muted">Outcome</label>
        <select className={`${inputCls} mt-1`} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
          {MEETING_OUTCOMES.map((o) => <option key={o} value={o}>{MEETING_OUTCOME_LABELS[o]}</option>)}
        </select>
        <textarea className={`${inputCls} mt-3 min-h-[80px]`} placeholder="Notes (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" size="md" loading={pending} onClick={() => run(() => logMeetingOutcome({ partnerId: partner.id, outcome, body: text || undefined }))}>Log outcome</Button>
        </ModalFooterV2>
      </ModalV2>

      <ModalV2 open={modal === "followup"} onClose={() => setModal(null)} size="md">
        <ModalTitle>Schedule a follow-up</ModalTitle>
        <label className="mt-3 block text-[12px] font-semibold text-ink-muted">Follow up on</label>
        <input type="date" className={`${inputCls} mt-1`} value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
        <textarea className={`${inputCls} mt-3 min-h-[70px]`} placeholder="Note (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" size="md" loading={pending} disabled={!dateVal} onClick={() => run(() => scheduleFollowUp({ partnerId: partner.id, nextFollowUpAt: dateVal, note: text || undefined }), "Follow-up scheduled")}>Schedule</Button>
        </ModalFooterV2>
      </ModalV2>

      <ModalV2 open={modal === "close"} onClose={() => setModal(null)} size="md" accent="danger">
        <ModalTitle>Close partner</ModalTitle>
        <label className="mt-3 block text-[12px] font-semibold text-ink-muted">Reason</label>
        <select className={`${inputCls} mt-1`} value={closeReason} onChange={(e) => setCloseReason(e.target.value as typeof closeReason)}>
          {CLOSE_REASONS.map((r) => <option key={r} value={r}>{CLOSE_REASON_LABELS[r]}</option>)}
        </select>
        <textarea className={`${inputCls} mt-3 min-h-[70px]`} placeholder="Notes (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" size="md" loading={pending} onClick={() => run(() => closePartner({ partnerId: partner.id, reason: closeReason, body: text || undefined }))}>Close partner</Button>
        </ModalFooterV2>
      </ModalV2>

      <ModalV2 open={modal === "issue"} onClose={() => setModal(null)} size="md" accent="warning">
        <ModalTitle>Raise an issue</ModalTitle>
        <textarea className={`${inputCls} mt-3 min-h-[90px]`} placeholder="Describe the issue (e.g. room double-booked)" value={text} onChange={(e) => setText(e.target.value)} />
        <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={escalate} onChange={(e) => setEscalate(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Escalate to global leadership
        </label>
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" size="md" loading={pending} disabled={!text.trim()} onClick={() => run(() => raisePartnerIssue({ partnerId: partner.id, body: text, escalate }))}>Raise issue</Button>
        </ModalFooterV2>
      </ModalV2>

      <ModalV2 open={modal === "note"} onClose={() => setModal(null)} size="md">
        <ModalTitle>Add a note</ModalTitle>
        <textarea className={`${inputCls} mt-3 min-h-[90px]`} placeholder="Add an internal note…" value={text} onChange={(e) => setText(e.target.value)} />
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" size="md" loading={pending} disabled={!text.trim()} onClick={() => run(() => addPartnerTimelineNote({ partnerId: partner.id, body: text }), "Note added")}>Add note</Button>
        </ModalFooterV2>
      </ModalV2>

      <ModalV2 open={modal === "brief"} onClose={() => setModal(null)} size="lg">
        <ModalTitle>Meeting brief</ModalTitle>
        <textarea readOnly value={renderMeetingBriefText(brief)} rows={18} className={`${inputCls} mt-3 resize-y font-mono text-[12px] leading-relaxed`} aria-label="Meeting brief" />
        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setModal(null)}>Close</Button>
          <Button variant="primary" size="md" onClick={copyBrief}>Copy brief</Button>
        </ModalFooterV2>
      </ModalV2>

      {toast && <ToastV2 open tone={toast.tone}>{toast.msg}</ToastV2>}
    </div>
  );
}

function ModalTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 text-[18px] font-bold text-ink">{children}</h2>;
}

function Field({
  label,
  value,
  href,
  external,
  highlight,
}: {
  label: string;
  value: string | null;
  href?: string;
  external?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      {value ? (
        href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className="truncate text-[13px] font-semibold text-brand-600 no-underline hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className={cn("truncate text-[13px] font-medium", highlight ? "text-rose-600" : "text-ink")}>{value}</span>
        )
      ) : (
        <span className="text-[13px] text-ink-muted">—</span>
      )}
    </div>
  );
}
