"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { meetingCategoryTone } from "@/lib/people-strategy/meeting-categories";
import type {
  AgendaItemDTO,
  DecisionDTO,
  FollowUpDTO,
  LinkedActionDTO,
  MeetingDetailDTO,
} from "@/lib/people-strategy/meetings-queries";
import {
  addAgendaItem,
  addDecision,
  convertAgendaItemToAction,
  convertFollowUpToAction,
  deleteDecision,
  saveMeetingNotes,
  setAgendaItemStatus,
  setFollowUpStatus,
  setMeetingStatus,
} from "@/lib/people-strategy/meetings-actions";
import { AddFollowUpDrawer } from "./meeting-followup-drawer";
import { MeetingIcon, type MeetingIconName } from "./meeting-icons";
import { fieldStyle } from "./meeting-form-kit";
import {
  AgendaStatusBadge,
  Avatar,
  Card,
  CategoryBadge,
  EmptyState,
  FollowUpStatusBadge,
  MeetingButton,
  MeetingStatusBadge,
  PersonChip,
  Pill,
  PriorityBadge,
  SectionTitle,
  TinyLabel,
  dueText,
  fmtTime,
  fmtWeekday,
} from "./meeting-ui";
import type { PersonOption } from "./new-meeting-drawer";
import { RelatedEntityBadge } from "./operational-badges";

/** The portal context a meeting is connected to (resolved server-side). */
export type MeetingRelatedContext = {
  entityType: string;
  entityLabel: string;
  entityHref: string | null;
  area: string;
  openActions: Array<{ id: string; title: string; status: string; leadName: string }>;
  otherMeetings: Array<{ id: string; title: string; dateISO: string }>;
};

export function MeetingDetailClient({
  meeting,
  people,
  relatedContext = null,
}: {
  meeting: MeetingDetailDTO;
  people: PersonOption[];
  relatedContext?: MeetingRelatedContext | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<null | { create: boolean }>(null);

  const c = meetingCategoryTone(meeting.category);
  const overdue = meeting.overdueFollowUps;
  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn().then(() => router.refresh()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1180, margin: "0 auto" }}>
      {/* breadcrumb */}
      <Link
        href="/actions/meetings"
        style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--ypp-purple-600)", textDecoration: "none", alignSelf: "flex-start" }}
      >
        <MeetingIcon name="chevL" size={16} />
        Weekly Command Center
      </Link>

      {/* header card */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ background: c.bg, borderBottom: `1px solid ${c.border}`, padding: "20px 22px", display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 380px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <CategoryBadge category={meeting.category} />
              <MeetingStatusBadge status={meeting.effectiveStatus} />
              <PriorityBadge priority={meeting.priority} />
            </div>
            <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: "var(--ypp-ink)", letterSpacing: "-.02em", lineHeight: 1.15 }}>
              {meeting.title}
            </h1>
            {meeting.purpose && (
              <p style={{ margin: "9px 0 0", fontSize: 14.5, color: "var(--text-secondary)", maxWidth: 620, lineHeight: 1.5 }}>{meeting.purpose}</p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {meeting.effectiveStatus === "completed" || meeting.effectiveStatus === "needs_follow_up" ? (
                <MeetingButton variant="outline" icon="repeat" disabled={pending} onClick={() => run(() => setMeetingStatus(meeting.id, "SCHEDULED"))}>
                  Reopen
                </MeetingButton>
              ) : (
                <MeetingButton icon="check" disabled={pending} onClick={() => run(() => setMeetingStatus(meeting.id, "COMPLETED"))}>
                  Mark Complete
                </MeetingButton>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <MeetingButton variant="outline" icon="flag" onClick={() => setDrawer({ create: false })}>
                Add Follow-Up
              </MeetingButton>
              <MeetingButton variant="outline" icon="bolt" onClick={() => setDrawer({ create: true })}>
                Create Action
              </MeetingButton>
            </div>
          </div>
        </div>
        {/* health snapshot */}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 6px", flexWrap: "wrap", rowGap: 12 }}>
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 3 }}>
            <TinyLabel>Meeting health</TinyLabel>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>
              {meeting.agendaCount} agenda · {meeting.agendaDoneCount} discussed · {meeting.decisionCount} decisions
            </span>
          </div>
          <HealthStat icon="list" value={`${meeting.agendaDoneCount}/${meeting.agendaCount}`} label="Agenda done" />
          <HealthStat icon="checkCircle" value={meeting.decisionCount} label="Decisions" />
          <HealthStat icon="flag" value={meeting.openFollowUps} label="Follow-ups open" />
          <HealthStat icon="bolt" value={meeting.linkedActions.length} label="Linked actions" />
          <HealthStat icon="alert" value={overdue} label="Overdue" danger={overdue > 0} />
        </div>
      </Card>

      {/* body two-col */}
      <div className="detail-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <AgendaSection meeting={meeting} pending={pending} run={run} />
          <NotesSection meeting={meeting} pending={pending} run={run} />
          <DecisionsSection meeting={meeting} people={people} pending={pending} run={run} />
          <FollowUpsSection meeting={meeting} pending={pending} run={run} onAdd={() => setDrawer({ create: false })} />
          <LinkedActionsSection actions={meeting.linkedActions} />
        </div>

        {/* SIDE */}
        <div className="detail-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {relatedContext ? (
            <Card style={{ padding: "16px 17px" }}>
              <SectionTitle icon="link">Related portal context</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <RelatedEntityBadge
                    type={relatedContext.entityType}
                    label={relatedContext.entityLabel}
                    href={relatedContext.entityHref}
                  />
                </div>
                <div>
                  <TinyLabel>Open actions for this {relatedContext.entityLabel}</TinyLabel>
                  {relatedContext.openActions.length ? (
                    <ul style={{ margin: "7px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                      {relatedContext.openActions.map((a) => (
                        <li key={a.id} style={{ fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <Link href={`/actions/${a.id}`} style={{ color: "var(--ypp-ink)", fontWeight: 600, textDecoration: "none", minWidth: 0 }}>
                            {a.title}
                          </Link>
                          <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{a.leadName}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                      No open actions linked here yet.
                    </p>
                  )}
                </div>
                {relatedContext.otherMeetings.length ? (
                  <div>
                    <TinyLabel>Other meetings for this {relatedContext.entityLabel}</TinyLabel>
                    <ul style={{ margin: "7px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                      {relatedContext.otherMeetings.map((m) => (
                        <li key={m.id} style={{ fontSize: 12.5 }}>
                          <Link href={`/actions/meetings/${m.id}`} style={{ color: "var(--ypp-ink)", fontWeight: 600, textDecoration: "none" }}>
                            {m.title}
                          </Link>
                          <span style={{ color: "var(--muted)" }}> · {fmtWeekday(m.dateISO)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
          <Card style={{ padding: "16px 17px" }}>
            <SectionTitle icon="calendar">Details</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <MetaItem label="Date & time">
                {fmtWeekday(meeting.startISO)} · {fmtTime(meeting.startISO)}
                {meeting.endISO ? `–${fmtTime(meeting.endISO)}` : ""}
              </MetaItem>
              {meeting.durationLabel && <MetaItem label="Duration">{meeting.durationLabel}</MetaItem>}
              <MetaItem label="Cadence">{recurrenceLabel(meeting.recurrence)}</MetaItem>
              {meeting.location && <MetaItem label="Location">{meeting.location}</MetaItem>}
              <MetaItem label="Related area">
                <CategoryBadge category={meeting.category} />
              </MetaItem>
            </div>
          </Card>
          <Card style={{ padding: "16px 17px" }}>
            <SectionTitle icon="user">Facilitator</SectionTitle>
            {meeting.facilitator ? (
              <PersonChip name={meeting.facilitator.name} sub="Facilitator" size={34} />
            ) : (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>No facilitator assigned.</span>
            )}
          </Card>
          <Card style={{ padding: "16px 17px" }}>
            <SectionTitle icon="people" count={meeting.attendees.length}>
              Attendees
            </SectionTitle>
            {meeting.attendees.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {meeting.attendees.map((p) => (
                  <PersonChip key={p.id} name={p.name} size={28} />
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>No attendees added yet.</span>
            )}
          </Card>
        </div>
      </div>

      {drawer && (
        <AddFollowUpDrawer
          meeting={{ id: meeting.id, title: meeting.title, startISO: meeting.startISO, category: meeting.category, facilitatorId: meeting.facilitator?.id }}
          people={people}
          defaultCreate={drawer.create}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

type RunFn = (fn: () => Promise<unknown>) => void;

function SectionBlock({ title, icon, count, right, children }: { title: string; icon: MeetingIconName; count?: number; right?: ReactNode; children: ReactNode }) {
  return (
    <Card style={{ padding: "17px 18px" }}>
      <SectionTitle icon={icon} count={count} right={right}>
        {title}
      </SectionTitle>
      {children}
    </Card>
  );
}

function HealthStat({ icon, value, label, danger }: { icon: MeetingIconName; value: string | number; label: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 16px", borderLeft: "1px solid var(--border)" }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: danger ? "var(--danger-bg)" : "var(--ypp-purple-100)", color: danger ? "var(--danger-fg)" : "var(--ypp-purple-600)" }}>
        <MeetingIcon name={icon} size={16} />
      </span>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: danger ? "var(--danger-fg)" : "var(--ypp-ink)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <TinyLabel>{label}</TinyLabel>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ypp-ink)" }}>{children}</div>
    </div>
  );
}

// --- Agenda -----------------------------------------------------------------

function AgendaSection({ meeting, pending, run }: { meeting: MeetingDetailDTO; pending: boolean; run: RunFn }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <SectionBlock
      title="Agenda"
      icon="list"
      count={meeting.agendaCount}
      right={
        <MeetingButton size="sm" variant="ghost" icon="plus" onClick={() => setAdding((v) => !v)}>
          Add item
        </MeetingButton>
      }
    >
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            run(() => addAgendaItem({ meetingId: meeting.id, title }));
            setTitle("");
            setAdding(false);
          }}
          style={{ display: "flex", gap: 8, marginBottom: 12 }}
        >
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New agenda item…" style={fieldStyle} />
          <MeetingButton type="submit" icon="plus" disabled={!title.trim() || pending}>
            Add
          </MeetingButton>
        </form>
      )}
      {meeting.agenda.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {meeting.agenda.map((a) => (
            <AgendaItem key={a.id} item={a} meetingId={meeting.id} pending={pending} run={run} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="list" title="No agenda items yet" body="Add the talking points so the meeting stays on track." />
      )}
    </SectionBlock>
  );
}

function AgendaItem({ item, meetingId, pending, run }: { item: AgendaItemDTO; meetingId: string; pending: boolean; run: RunFn }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const done = item.status === "DISCUSSED" || item.status === "CONVERTED";
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <button
          onClick={() => run(() => setAgendaItemStatus({ id: item.id, status: item.status === "DISCUSSED" ? "OPEN" : "DISCUSSED" }))}
          aria-label="Toggle discussed"
          disabled={pending}
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            flex: "0 0 auto",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1.5px solid ${done ? "var(--success-fg)" : "var(--border)"}`,
            background: done ? "var(--success-fg)" : "var(--surface)",
            color: "#fff",
          }}
        >
          {done && <MeetingIcon name="check" size={13} stroke={3} />}
        </button>
        <div style={{ flex: 1, minWidth: 0, cursor: item.notes ? "pointer" : "default" }} onClick={() => item.notes && setNotesOpen((v) => !v)}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ypp-ink)", textDecoration: item.status === "DEFERRED" ? "line-through" : "none", opacity: item.status === "DEFERRED" ? 0.6 : 1 }}>
            {item.title}
          </div>
          {item.notes && !notesOpen && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.notes}</div>
          )}
        </div>
        {item.owner && <Avatar name={item.owner.name} size={24} />}
        <AgendaStatusBadge status={item.status} />
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Agenda item options"
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <MeetingIcon name="list" size={15} />
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
              <div style={{ position: "absolute", right: 0, top: 36, zIndex: 31, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, boxShadow: "0 12px 30px -8px rgba(28,20,60,.22)", padding: 5, minWidth: 180 }}>
                <MenuOpt icon="check" label="Mark discussed" onClick={() => { run(() => setAgendaItemStatus({ id: item.id, status: "DISCUSSED" })); setMenuOpen(false); }} />
                <MenuOpt icon="clock" label="Defer" onClick={() => { run(() => setAgendaItemStatus({ id: item.id, status: "DEFERRED" })); setMenuOpen(false); }} />
                {!item.convertedActionId && (
                  <MenuOpt icon="bolt" label="Convert to action" onClick={() => { run(() => convertAgendaItemToAction(item.id)); setMenuOpen(false); }} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {notesOpen && item.notes && (
        <div style={{ padding: "0 14px 13px 48px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>{item.notes}</div>
      )}
    </div>
  );
}

function MenuOpt({ icon, label, onClick }: { icon: MeetingIconName; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", background: "none", border: "none", padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 7 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rail)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      <MeetingIcon name={icon} size={14} />
      {label}
    </button>
  );
}

// --- Notes ------------------------------------------------------------------

function NotesSection({ meeting, pending, run }: { meeting: MeetingDetailDTO; pending: boolean; run: RunFn }) {
  const [notes, setNotes] = useState(meeting.notesText ?? "");
  const dirty = notes !== (meeting.notesText ?? "");
  return (
    <SectionBlock
      title="Notes"
      icon="doc"
      right={
        dirty ? (
          <MeetingButton size="sm" icon="check" disabled={pending} onClick={() => run(() => saveMeetingNotes({ meetingId: meeting.id, notes }))}>
            Save
          </MeetingButton>
        ) : undefined
      }
    >
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Capture meeting notes, summary, and key discussion points…"
        rows={4}
        style={{ ...fieldStyle, resize: "vertical", fontSize: 14, lineHeight: 1.6 }}
      />
    </SectionBlock>
  );
}

// --- Decisions --------------------------------------------------------------

function DecisionsSection({ meeting, people, pending, run }: { meeting: MeetingDetailDTO; people: PersonOption[]; pending: boolean; run: RunFn }) {
  const [adding, setAdding] = useState(false);
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [decidedById, setDecidedById] = useState(meeting.facilitator?.id ?? "");
  return (
    <SectionBlock
      title="Decisions"
      icon="checkCircle"
      count={meeting.decisionCount}
      right={
        <MeetingButton size="sm" variant="ghost" icon="plus" onClick={() => setAdding((v) => !v)}>
          Log decision
        </MeetingButton>
      }
    >
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!decision.trim()) return;
            run(() => addDecision({ meetingId: meeting.id, decision, rationale, decidedById: decidedById || undefined }));
            setDecision("");
            setRationale("");
            setAdding(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 12, padding: 13, border: "1px solid var(--border)", borderRadius: 12, background: "var(--rail)" }}
        >
          <textarea autoFocus value={decision} onChange={(e) => setDecision(e.target.value)} rows={2} placeholder="What was decided?" style={{ ...fieldStyle, resize: "vertical" }} />
          <input value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why (optional)" style={fieldStyle} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={decidedById} onChange={(e) => setDecidedById(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
              <option value="">Decided by…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <MeetingButton type="submit" icon="check" disabled={!decision.trim() || pending}>
              Log
            </MeetingButton>
          </div>
        </form>
      )}
      {meeting.decisions.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {meeting.decisions.map((d) => (
            <DecisionCard key={d.id} dec={d} pending={pending} run={run} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="checkCircle" title="No decisions logged yet" body="Capture the calls made in this meeting so the team has a clear record." />
      )}
    </SectionBlock>
  );
}

function DecisionCard({ dec, pending, run }: { dec: DecisionDTO; pending: boolean; run: RunFn }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--success-fg)", borderRadius: 12, padding: "14px 16px", background: "var(--surface)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--success-bg)", color: "var(--success-fg)", marginTop: 1 }}>
          <MeetingIcon name="checkCircle" size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ypp-ink)", lineHeight: 1.4 }}>{dec.decision}</div>
          {dec.rationale && (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>Why: </span>
              {dec.rationale}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {dec.decidedBy && <Avatar name={dec.decidedBy.name} size={20} />}
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {dec.decidedBy ? `Decided by ${dec.decidedBy.name}` : "Decision"}
            </span>
            {dec.linkedActionId && (
              <Pill tone="purple" style={{ fontSize: 11 }}>
                <MeetingIcon name="bolt" size={11} />
                Linked action
              </Pill>
            )}
          </div>
        </div>
        <button
          onClick={() => run(() => deleteDecision(dec.id))}
          aria-label="Delete decision"
          disabled={pending}
          style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", padding: 2, flex: "0 0 auto" }}
        >
          <MeetingIcon name="x" size={15} />
        </button>
      </div>
    </div>
  );
}

// --- Follow-ups -------------------------------------------------------------

function FollowUpsSection({ meeting, pending, run, onAdd }: { meeting: MeetingDetailDTO; pending: boolean; run: RunFn; onAdd: () => void }) {
  const overdue = meeting.overdueFollowUps;
  return (
    <SectionBlock
      title="Follow-Ups"
      icon="flag"
      count={meeting.followUps.length}
      right={
        <MeetingButton size="sm" variant="outline" icon="plus" onClick={onAdd}>
          Add follow-up
        </MeetingButton>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {overdue > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 600, color: "var(--danger-fg)", background: "var(--danger-bg)", border: "1px solid #f3cccc", borderRadius: 10, padding: "9px 13px" }}>
            <MeetingIcon name="alert" size={15} />
            {overdue} follow-up{overdue > 1 ? "s are" : " is"} overdue — convert to tracked actions so they don&rsquo;t slip.
          </div>
        )}
        {meeting.followUps.length ? (
          meeting.followUps.map((f) => <FollowUpCard key={f.id} f={f} pending={pending} run={run} />)
        ) : (
          <EmptyState compact icon="flag" title="No follow-ups yet" body="Add follow-ups to assign owners and keep momentum after the meeting." />
        )}
      </div>
    </SectionBlock>
  );
}

function FollowUpCard({ f, pending, run }: { f: FollowUpDTO; pending: boolean; run: RunFn }) {
  const du = dueText(f.dueISO);
  const done = f.effectiveStatus === "completed";
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10, opacity: done ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <button
          onClick={() => run(() => setFollowUpStatus({ id: f.id, status: done ? "OPEN" : "COMPLETED" }))}
          aria-label="Mark complete"
          disabled={pending}
          style={{ width: 22, height: 22, borderRadius: 999, flex: "0 0 auto", marginTop: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${done ? "var(--success-fg)" : "var(--border)"}`, background: done ? "var(--success-fg)" : "var(--surface)", color: "#fff" }}
        >
          {done && <MeetingIcon name="check" size={13} stroke={3} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ypp-ink)", lineHeight: 1.35, textDecoration: done ? "line-through" : "none" }}>{f.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {f.owner && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Avatar name={f.owner.name} size={20} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{f.owner.name}</span>
              </span>
            )}
            <FollowUpStatusBadge status={f.effectiveStatus} />
            <PriorityBadge priority={f.priority} />
            <CategoryBadge category={f.area} withIcon={false} style={{ fontSize: 11 }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: du.overdue ? "var(--danger-fg)" : "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <MeetingIcon name="clock" size={12} />
              {du.label}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingLeft: 33, flexWrap: "wrap" }}>
        {f.linkedActionId ? (
          <Link
            href={`/actions/${f.linkedActionId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--ypp-purple-700)", background: "var(--ypp-purple-50)", border: "1px solid var(--ypp-purple-200)", borderRadius: 999, padding: "4px 11px", textDecoration: "none" }}
          >
            <MeetingIcon name="link" size={13} />
            Tracked in Action Tracker
            <MeetingIcon name="arrowUpR" size={12} />
          </Link>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MeetingIcon name="alert" size={13} style={{ color: "var(--warn-fg)" }} />
            Not yet tracked
          </span>
        )}
        <div style={{ display: "flex", gap: 7 }}>
          {!f.linkedActionId && (
            <MeetingButton size="sm" variant="outline" icon="bolt" disabled={pending} onClick={() => run(() => convertFollowUpToAction(f.id))}>
              Convert to Action
            </MeetingButton>
          )}
          {!done && (
            <MeetingButton size="sm" variant="ghost" icon="check" disabled={pending} onClick={() => run(() => setFollowUpStatus({ id: f.id, status: "COMPLETED" }))}>
              Complete
            </MeetingButton>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Linked actions ---------------------------------------------------------

function LinkedActionsSection({ actions }: { actions: LinkedActionDTO[] }) {
  return (
    <SectionBlock
      title="Linked Actions"
      icon="bolt"
      count={actions.length}
      right={
        <Link href="/actions/all" style={{ textDecoration: "none" }}>
          <MeetingButton size="sm" variant="ghost" iconRight="arrowUpR">
            Action Tracker
          </MeetingButton>
        </Link>
      }
    >
      {actions.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {actions.map((a) => (
            <LinkedAction key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="bolt" title="No linked actions" body="Follow-ups you convert to the Action Tracker will appear here, linked both ways." />
      )}
    </SectionBlock>
  );
}

function LinkedAction({ a }: { a: LinkedActionDTO }) {
  const du = dueText(a.deadlineISO);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", background: "var(--surface)", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ypp-purple-100)", color: "var(--ypp-purple-600)" }}>
        <MeetingIcon name="bolt" size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ypp-ink)" }}>{a.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {a.owner && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{a.owner.name}</span>}
          <Pill tone={a.status === "COMPLETE" ? "success" : a.status === "OVERDUE" ? "danger" : "neutral"} style={{ fontSize: 11 }}>
            {a.status.replace(/_/g, " ").toLowerCase()}
          </Pill>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: du.overdue ? "var(--danger-fg)" : "var(--muted)" }}>{du.label}</span>
        </div>
      </div>
      <Link href={`/actions/${a.id}`} style={{ textDecoration: "none" }}>
        <MeetingButton size="sm" variant="outline" iconRight="arrowUpR">
          Open
        </MeetingButton>
      </Link>
    </div>
  );
}

function recurrenceLabel(r: string | null): string {
  if (!r) return "One-time";
  const map: Record<string, string> = { WEEKLY: "Weekly", BIWEEKLY: "Bi-weekly", MONTHLY: "Monthly", NONE: "One-time" };
  return map[r] ?? r;
}
